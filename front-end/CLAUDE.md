# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (port 3001 by default)
pnpm build        # tsc -b && vite build
pnpm type-check   # tsc -b --noEmit
pnpm lint         # eslint
```

Add shadcn components with:
```bash
pnpm dlx shadcn@latest add <component>
```

## Architecture

**Entry point:** `src/main.tsx` — mounts the provider tree and declares all routes.

**Provider order (outermost → innermost):**
`ThemeProvider` (next-themes) → `LanguageProvider` → `BrowserRouter` → `QueryClientProvider` → `AuthProvider` → routes

### Authentication (`src/context/AuthContext.tsx`)

- Access token stored in **React state (in-memory only)** — never localStorage.
- Refresh token sent via **HttpOnly cookie** automatically.
- On mount, `AuthContext` fires a React Query `useQuery` to `POST /auth/refresh` to restore the session.
- `refetchInterval: 13 * 60 * 1000` — proactively refreshes the access token 2 minutes before its 15-minute expiry, keeping the session alive without user action.
- Login, register, and logout are React Query mutations that update `queryClient.setQueryData(["session"], ...)`.
- `updateUserName(name)` patches the cached session without a round-trip (used after a successful profile update).
- `getAccessToken()` returns the current in-memory access token.

### API client (`src/lib/api.ts`)

- `apiFetch<T>` is the single authenticated fetch wrapper. It:
  1. Sends `Authorization: Bearer <token>` and `credentials: include`.
  2. On 401, calls `refreshSession()` (deduplicated singleton promise via `inflightRefresh`) and retries once with the new token. Calls `onRefreshed(session)` so `AuthContext` can update its query cache.
  3. On 402, throws `PaywallError` (a typed subclass of `Error`).
- All domain functions (`fetchPresets`, `sendChat`, etc.) are thin wrappers around `apiFetch`.

### Internationalization (`src/context/LanguageContext.tsx`)

- `LanguageContext` holds the current `lang` (`'en' | 'es' | 'pt'`), persisted in `localStorage`.
- `useLanguage()` hook returns `{ lang, setLang, t }`.
- `t(key: TranslationKey)` looks up the string in `src/lib/translations.ts`, which exports a typed `translations` map for all three languages.
- Every UI string must use `t()` — no hard-coded English strings in components.

### Routing (`src/routes/`)

- `ProtectedRoute.tsx` — shows a spinner while `authLoading`, then redirects to `/login` if `!isAuthenticated`, otherwise renders `<Outlet />`. **The redirect guard is active.**
- `Login.tsx` — public route, shadcn `Tabs` for login/register. `react-hook-form` + zod v4. Use `z.email()` top-level (not `z.string().email()`).
- `Home.tsx` — main chat + preview page (see below).
- `Templates.tsx` — saved templates grid page.
- `Profile.tsx` — display name, change password, delete account.
- `Settings.tsx` — language selector, default model and preset.

### Home page (`src/routes/Home.tsx`)

**Mobile-first:** A `mobileTab` state (`'chat' | 'preview'`) drives a tab bar visible only on mobile (`md:hidden`). On desktop, chat panel (380px fixed, `shrink-0`) + preview panel (flex, fills remaining space) are shown side by side.

**Race condition pattern:** `loadOpRef = useRef(0)` is incremented on every new-chat reset or conversation load. Async operations capture `loadOpRef.current` before awaiting and check it after — if it changed, the user already switched context, so the stale response is discarded without updating state.

**Paywall:**
- On `PaywallError`, sets `paywalled=true` (persisted as `paywalled_${user.id}` in localStorage) and shows an `AlertDialog` with features list + "Contact us" CTA.
- When `paywalled=true`, the chat input area is replaced with a banner; no further sends are possible.

**Preset validation:** After presets load, validates the stored `selectedPreset` still exists. If not, clears it. If none is selected and "Empresa Demo" exists, auto-selects it.

**Conversations:** Sidebar lists all conversations (`useQuery(["conversations"])`). Clicking one calls `handleLoadConversation(id)` which fetches `ConversationWithMessages` and restores messages + `template_html`. Delete conversation removes it from the sidebar and resets to new chat if it was active.

**Template actions:**
- **Save**: `createTemplate` or `updateTemplate` (if `currentTemplateId` is set).
- **Download**: creates a `Blob` with `type: "text/html;charset=utf-8"` and triggers a file download.
- **Inline rename**: click on the template name above the preview to edit it in-place. Commits on Enter / blur, cancels on Escape.

### Templates page (`src/routes/Templates.tsx`)

Grid of `TemplateCard` components. Each card has:
- `TemplateThumbnail`: a scaled `<iframe>` preview using `srcdoc`.
- Inline rename (pencil icon, visible on hover).
- **Preview**: opens template HTML as a blob URL in a new tab (`window.open(url, '_blank')`). Blob uses `charset=utf-8`.
- **Download**: same Blob pattern, triggers `<a download>` click.
- **Delete**: calls `deleteTemplate` with a per-id loading spinner.

### Sidebar components

Two distinct sidebars exist — do not mix them:
- `AppSidebar` (`src/components/home/AppSidebar.tsx`) — used only on Home. Shows conversation history + account nav. Receives conversations as props.
- `NavSidebar` (`src/components/NavSidebar.tsx`) — used on Templates, Profile, Settings. No conversation list.

Both are wrapped in `SidebarProvider` in their respective route components.

### Theming

`ThemeProvider` from `next-themes` applies `dark` / `light` class to `<html>`. `ModeToggle` exposes Light / Dark / System options. Colors use shadcn indigo palette with oklch CSS variables in `src/index.css`.

### Shadcn setup

- Style: `radix-vega`, icon library: `lucide`
- Config: `components.json` at root
- All shadcn components go in `src/components/ui/`
- Custom components go in `src/components/` (or `src/components/home/`, `src/components/templates/`)
- TailwindCSS v4 (plugin-based, no `tailwind.config.js`); config lives entirely in `src/index.css`

### Path aliases

`@/` maps to `src/`. Configured in both `vite.config.ts` (resolve.alias) and `tsconfig.app.json` (paths). Both configs include `"ignoreDeprecations": "6.0"` to suppress the TS6 `baseUrl` deprecation warning.

## Required env vars

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL (e.g. `http://localhost:3000`) |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for the login CAPTCHA (public, safe to expose client-side) |

Set in `.env` for local dev; see `.env.example`.
