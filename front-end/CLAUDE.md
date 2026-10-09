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
`ThemeProvider` (next-themes) → `LanguageProvider` → `BrowserRouter` → `AppClerkProvider` → `QueryClientProvider` → `AuthProvider` → `ChatProvider` → routes

`AppClerkProvider` (`src/components/AppClerkProvider.tsx`) sits inside the router so Clerk navigates with React Router (`routerPush`/`routerReplace`), follows the app language (`@clerk/localizations` `esES` / `ptBR`), uses the `shadcn` theme from `@clerk/ui/themes` (CSS imported in `index.css`), and bundles Clerk's UI via `ui={ui}` instead of loading it from Clerk's CDN.

### Authentication (`src/context/AuthContext.tsx`)

- Clerk owns the session (sign-in, sign-up, Google, email verification, token refresh). `AuthContext` wraps it for the rest of the app.
- Once Clerk reports a signed-in user, `useQuery(["me", clerkUserId])` calls `GET /me`, which also provisions the local account. `user` is the app's own user (`{ id, email, name, role }`; `id` is the local UUID used for `localStorage` keys).
- Exposes `user`, `isAuthenticated` (app account loaded), `isSignedIn` (Clerk session), `authLoading`, `accountError` (`email_not_verified` / `account_conflict` / `unknown` when `/me` refuses), `logout()` (Clerk `signOut` + `queryClient.clear()`), `updateUserName(name)`.

### API client (`src/lib/api.ts`)

- `apiFetch<T>` is the single authenticated fetch wrapper. It:
  1. Gets the current Clerk session token with the standalone `getToken()` from `@clerk/react` (cached ~60 s tokens, refreshed by Clerk) and sends `Authorization: Bearer <token>`. No cookies are sent.
  2. On 401, retries once with `getToken({ skipCache: true })`.
  3. On 402, throws `PaywallError`; other failures throw `ApiError` (has `.status`).
- All domain functions (`fetchPresets`, `sendChat`, etc.) are thin wrappers around `apiFetch` and take no token argument.

### Internationalization (`src/context/LanguageContext.tsx`)

- `LanguageContext` holds the current `lang` (`'en' | 'es' | 'pt'`), persisted in `localStorage`.
- `useLanguage()` hook returns `{ lang, setLang, t }`.
- `t(key: TranslationKey)` looks up the string in `src/lib/translations.ts`, which exports a typed `translations` map for all three languages.
- Every UI string must use `t()` — no hard-coded English strings in components.

### Routing (`src/routes/`)

- `ProtectedRoute.tsx` — spinner while `authLoading`; redirects to `/login` if not signed in with Clerk; shows an account-error screen (with sign out) if signed in but `/me` refused; otherwise renders `<Outlet />`.
- `Login.tsx` — public, mounted at `/login/*` (`mode="sign-in"`) and `/sign-up/*` (`mode="sign-up"`). Branded frame around Clerk's `<SignIn>` / `<SignUp>` (path routing; splat routes are required for nested steps like `/sign-up/verify-email-address`).
- `Home.tsx` — main chat + preview page (see below).
- `Templates.tsx` — saved templates grid page.
- `Profile.tsx` — display name, a Security card that opens Clerk's user profile (password, email, Google, sessions) via `openUserProfile()`, delete account.
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
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (public). `npx clerk@latest env pull --file .env` writes it — remove the `CLERK_SECRET_KEY` line that command also adds; secrets never belong in the frontend env |

Set in `.env` for local dev; see `.env.example`.
