# CLAUDE.md

**Facturia** — a chat-based SaaS tool where users describe a Paraguayan invoice template in natural language and AI (DeepSeek V3 or R1) generates it as live HTML. Targets non-technical users needing facturas for Paraguay's SIFEN/SET system.

## Monorepo structure

```
ai_template_builder/
├── back-end/    # Node 22 + Express 5 + TypeScript + PostgreSQL (see back-end/CLAUDE.md)
├── front-end/   # React 19 + Vite + shadcn/ui + TailwindCSS v4 (see front-end/CLAUDE.md)
├── dev.sh       # starts both services for local development
└── memory/      # project memory files (Claude Code context)
```

## Running locally

```bash
./dev.sh   # starts back-end (port 3000) and front-end (port 3001) concurrently
```

Or start each separately — see `back-end/CLAUDE.md` and `front-end/CLAUDE.md` for their individual commands.

## Full feature inventory

### Authentication & Security
- Register / login / logout with JWT: 15-min access tokens stored **in React memory only** (never localStorage) + 7-day HttpOnly cookie refresh tokens
- Refresh token rotation on every use (single-use, JTI stored in DB — prevents replay attacks)
- Constant-time bcrypt comparison prevents user enumeration via timing side-channels
- Login is gated by a Cloudflare Turnstile CAPTCHA (verified server-side against `TURNSTILE_SECRET_KEY`) plus IP-based rate limiting (`express-rate-limit`, 10 attempts / 15 min); registration has its own 5 / 15 min limiter
- `helmet()` sets standard security headers on all API responses; Docker containers run as the unprivileged `node` user, not root
- Auto-refresh at 13-min intervals (`refetchInterval`); 401 interception retries once with a fresh token (deduped via singleton `inflightRefresh` promise)
- Role system: `admin | user` — admins bypass the paywall; role is embedded in the JWT access payload
- `ProtectedRoute` shows a spinner while auth loads, then redirects unauthenticated users to `/login`

### Company Presets
- Full CRUD via a right-slide shadcn **Sheet** drawer (`PresetSheet.tsx`)
- Paraguay-specific fields: business name (razón social), **RUC** (validated: `/^\d+-\d$/`), **timbrado** (validated: 8 digits), address, city, phone, email
- **Logo upload**: client converts file to base64 data URL (max 1 MB); stored as-is in the DB; displayed as a thumbnail in the preset list; injected into generated templates via `LOGO_PLACEHOLDER` substitution
- Demo preset ("Empresa Demo S.A.") auto-created on every new user registration, with full sample Paraguay fields
- After presets load, validates that the stored `selectedPreset` still exists; auto-selects the demo preset if nothing is selected
- Toast notifications (sonner) on create / update / delete

### AI Invoice Generation
- Chat interface: user types a natural-language description, AI returns a JSON object `{ message?, templateHtml? }`
- **Two models**: DeepSeek V3 (`deepseek-chat`) and DeepSeek R1 Reasoner (`deepseek-reasoner`) — selectable in the input bar, persisted to `localStorage`
- System prompt auto-injects selected preset company data (name, RUC, timbrado, address, etc.)
- **Logo injection**: AI includes `<img src="LOGO_PLACEHOLDER">` — backend replaces it with the actual base64 data before returning the response
- **Edit mode**: when a template already exists in the conversation, the current HTML is passed back with strict minimal-patch instructions — the model edits, not regenerates
- **Mandatory Paraguay invoice requirements** always enforced: Condición de Venta (Contado/Crédito field), IVA breakdown columns (Exentas / Gravado 5% / Gravado 10%), totals block with IVA rows
- R1 compatibility: `response_format: json_object` omitted for R1; markdown fence extractor fallback parses JSON if R1 wraps in code blocks
- **Paywall**: 1 free AI prompt per non-admin user. Enforced atomically: `UPDATE users SET ai_prompts_used = ai_prompts_used + 1 WHERE id = $1 AND ai_prompts_used < 1 RETURNING id`. Returns HTTP 402 `{ error: 'trial_exhausted' }` on miss.

### Generation Animation (while AI is loading)
- `TemplateGenerating` component renders a realistic fake-invoice skeleton in the preview panel
- Skeleton lines use a shimmer sweep animation (`template-shimmer`) with staggered `animationDelay` values
- A scanning beam (`template-scan-beam`) sweeps vertically over the document card
- Bouncing `...` dots + pinging status indicator + "Crafting your template" label
- Ambient gradient glow behind the card
- Dark-mode variant of all skeleton colors
- When the template arrives: `template-fade-in` (opacity 0→1, scale 0.98→1, 350ms ease-out)

### Conversation Management
- All conversations persisted in the DB with `title`, `preset_id`, `template_html`, and a messages sub-table
- Sidebar lists all conversations; clicking restores the full message history and template HTML
- Trash icon (appears on hover) to delete a conversation
- If the active conversation is deleted, app resets to a new chat
- **Race condition guard**: `loadOpRef = useRef(0)` is incremented on every new-chat reset or conversation load — async operations capture the counter before awaiting and discard stale responses if it changed

### Template Preview & Actions
- Split-pane: 380px fixed chat panel (left) + flex preview panel (fills remaining width)
- Live `<iframe srcDoc={templateHtml}>` with `key={templateHtml}` to force re-render on new templates; sandboxed with `allow-same-origin`
- **Save**: creates a new template record or updates the existing one (if `currentTemplateId` is set)
- **Download**: creates a Blob (`text/html;charset=utf-8`) and triggers an `<a download>` click
- **Open in new tab**: creates a blob URL, opens with `window.open`, revokes after 10 s
- **Inline rename**: click the template name above the preview → editable input, commits on Enter/blur, cancels on Escape; auto-patches the DB if already saved
- Toast notifications on save and rename success

### Template Library (`/templates`)
- Responsive card grid: 1 → 2 → 3 → 4 columns on sm / lg / xl breakpoints
- `TemplateThumbnail`: scaled `<iframe srcDoc>` that renders a live preview of each template
- `TemplateCard`: thumbnail + creation date + inline rename (pencil icon on hover) + Preview (new tab) + Download + Delete (per-card loading spinner)
- Toast notification on delete

### Mobile Responsiveness
- Mobile-first: Chat / Preview tab switcher visible only on mobile (`md:hidden`)
- Green dot on the Preview tab when a template exists
- Desktop: side-by-side panels; chat panel has `shrink-0` fixed width

### User Profile (`/profile`)
- Change display name — updates the `AuthContext` session cache without a page reload
- Change password — current + new + confirm, 6-char minimum, client-side validation
- Delete account — two-step confirmation; cascades all data in DB; handles edge case where logout may fail after the user row is gone

### Settings (`/settings`)
- **Language selector**: EN / ES / PT toggle buttons; instant switch, persisted to `localStorage`
- **Default AI model**: persisted to `localStorage`, pre-selected on new chats
- **Default preset**: persisted to `localStorage`; Settings page flashes a ✓ icon on each change (no explicit save button needed)

### Internationalization
- `LanguageContext` + `lib/translations.ts`: typed `TranslationKey` (TypeScript enforces no missing keys)
- ~80+ keys covering every UI string — login, sidebar, chat, paywall, presets, templates, profile, settings, errors
- Zero hard-coded strings in components (all via `t(key)`)
- Language persisted to `localStorage` across sessions

### Theming
- `ThemeProvider` (next-themes): Light / Dark / System (`ModeToggle`)
- Custom indigo/blue-purple palette using `oklch` CSS variables (perceptually uniform)
- Dark mode is a separate `.dark` CSS variable block — full contrast inversion
- Custom animations (shimmer, scan, fade-in) adapt colors per theme

### Paywall UX
- On 402 response: `PaywallError` thrown by `apiFetch`, caught in `handleSend`
- Paywalled flag stored as `paywalled_${user.id}` in `localStorage` (survives refresh)
- Chat input is replaced by a styled banner ("Free trial used")
- `AlertDialog` with gradient header, Sparkles icon, feature checklist, "Contact us to unlock" CTA

### Sidebar Architecture
Two distinct sidebars — do not mix:
- `AppSidebar` — Home page only: conversations list + Templates / Presets / Profile / Settings / Sign out nav
- `NavSidebar` — Templates, Profile, Settings pages: navigation only (no conversation list)
Both are wrapped in `SidebarProvider` in their respective route components.

## Key design decisions

- **Paywall**: Non-admin users get exactly 1 free AI prompt. Enforced atomically server-side (`ai_prompts_used` column). Client caches the paywalled state per user in `localStorage`.
- **AI model**: DeepSeek V3 (`deepseek-chat`) and R1 (`deepseek-reasoner`) via OpenAI-compatible SDK. R1 does not support `response_format: json_object`.
- **Token strategy**: 15-min JWT access tokens in React memory + 7-day HttpOnly cookie refresh tokens. Frontend auto-refreshes at 13-min intervals and intercepts 401s.
- **Paraguay focus**: Templates target Paraguay's SIFEN invoice format. Company presets hold RUC, timbrado, and other Paraguay-specific fields. AI system prompt enforces IVA breakdown and Condición de Venta.
- **Languages**: Full EN / ES / PT i18n via `LanguageContext` + `translations.ts`. No hard-coded UI strings.
- **Logo**: Base64 data URL stored in DB. AI uses a `LOGO_PLACEHOLDER` token; backend substitutes the real image before returning.

## Tech stack summary

| Layer | Technology |
|---|---|
| Runtime | Node 22, TypeScript (ESM, `moduleResolution: nodenext`) |
| HTTP framework | Express 5 |
| Database | PostgreSQL via `pg.Pool` singleton |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| AI | OpenAI SDK → DeepSeek API (V3 + R1) |
| Validation | Zod v4 (back-end + front-end) |
| Frontend framework | React 19 + Vite 8 |
| Styling | TailwindCSS v4 (plugin-based) + shadcn/ui (radix-vega style) |
| Component icons | Lucide React |
| Server state | TanStack React Query v5 |
| Forms | react-hook-form + zod |
| Routing | React Router v7 |
| Theming | next-themes |
| Toasts | Sonner |
| Font | Inter Variable (@fontsource-variable) |
| Testing | Vitest + supertest (43 integration tests, real DB) |
| CI | GitHub Actions (2 jobs: backend + frontend) |
| Containerisation | Docker (multi-stage), 3 compose files (base / QA / prod) |

## See also

- `back-end/CLAUDE.md` — backend architecture, modules, env vars, migrations, testing
- `front-end/CLAUDE.md` — frontend architecture, routing, auth, i18n, component structure
- `memory/project_state.md` — detailed feature status and what remains to be built
