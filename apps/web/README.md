# Journey Web App

React-based web application for building, simulating, and managing journeys.

**Stack:** React 19 · Vite 6 · TanStack (Router/Query/Store/Form) · Tailwind CSS v4 · Radix UI + shadcn/ui · @xyflow/react.

```bash
pnpm dev:web                          # start the dev server (port 3000)
pnpm --filter @journey/web lint       # CI enforces --max-warnings 0
pnpm --filter @journey/web test:unit  # Vitest unit tests
pnpm --filter @journey/web test:e2e   # Playwright e2e
```

**Documentation:** See [docs/web/README.md](/docs/web/README.md)
