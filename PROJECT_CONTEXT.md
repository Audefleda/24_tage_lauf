# Project Context: 24 Tage Lauf

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | ^16 |
| Language | TypeScript (strict mode) | ^5 |
| Styling | Tailwind CSS | ^3.4 |
| UI Components | shadcn/ui (Radix UI) | latest |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) | ^2 |
| Forms | react-hook-form + Zod | latest |
| Linting | ESLint (eslint-config-next) | ^9 |
| Package Manager | npm | — |

## Folder Structure

```
/
├── src/
│   ├── app/                  # Next.js App Router pages & layouts
│   │   ├── layout.tsx        # Root layout (fonts, providers)
│   │   ├── page.tsx          # Home page
│   │   └── globals.css       # Global styles + Tailwind directives
│   ├── components/
│   │   └── ui/               # shadcn/ui components (do not edit manually)
│   ├── hooks/                # Custom React hooks
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client (singleton)
│   │   └── utils.ts          # Utility functions (cn, etc.)
├── public/                   # Static assets
├── docs/                     # PRD and production guides
├── features/                 # Feature specs (PROJ-X-name.md)
├── .env.local                # Local environment variables (git-ignored)
├── .env.local.example        # Template for required env vars
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
└── tsconfig.json             # TypeScript configuration (strict: true)
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for browser) | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, never expose to client) | Supabase Dashboard → Project Settings → API |

> **Important:** Never commit `.env.local` to git. The `SUPABASE_SERVICE_ROLE_KEY` must only be used in server-side code (API routes, Server Actions).

## Key Conventions

- **Routing:** All pages go in `src/app/` using the App Router file conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)
- **Components:** Use shadcn/ui components from `src/components/ui/` — never recreate them
- **Supabase client:** Import from `@/lib/supabase` — one singleton instance
- **Styling:** Use Tailwind utility classes; `cn()` from `@/lib/utils` for conditional classes
- **Validation:** Zod schemas + react-hook-form for all user-facing forms
- **Feature tracking:** New features start with `/requirements`, tracked in `features/INDEX.md`

## Next Steps

1. **Configure Supabase:** Create a project at [supabase.com](https://supabase.com), copy credentials to `.env.local`
2. **Define the product:** Fill in `docs/PRD.md` with vision, target users, and feature roadmap
3. **Create first feature:** Run `/requirements` with your feature description
4. **Follow the workflow:** requirements → architecture → frontend → backend → qa → deploy
