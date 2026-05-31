# @journey/schemas

Single source of truth for Zod schemas, TypeScript types, and shared contracts
used across the Journey platform.

Includes:

- Node, journey, session, user-activity, and event schemas
- Service interfaces (`SharedServiceContext`), permissions, and no-op factories
- Automation triggers/events, content split/merge, and simulator types
- Mindstate + CRM schemas
- LLM provider/runtime config, model registry schemas, and app defaults
- Utilities (branded IDs, variable/value types, errors)

**Documentation:** See `docs/schemas/README.md`

**Entry points:** `@journey/schemas` (all exports), `@journey/schemas/api` (API input schemas)