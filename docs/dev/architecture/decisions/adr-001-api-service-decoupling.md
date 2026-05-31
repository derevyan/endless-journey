# ADR-001: API Service Decoupling

## Status

Accepted

## Date

2026-01-08

## Context

The Journey Builder API violated documented architecture guidelines:

1. Routes imported from `@journey/db` directly in some areas.
2. Services used standalone functions instead of schema-backed interfaces.
3. Existing no-op factories in `@journey/schemas` were unused in API tests.
4. API modules were tightly coupled, making DI and testing difficult.

The documented guidance stated:

- Routes should be thin HTTP handlers with no direct DB access.
- Services should own business logic and implement shared interfaces.
- Test helpers should use no-op implementations for deterministic behavior.

## Decision

We will:

1. Create API-specific interfaces (`IApi*Service`) that extend runtime interfaces.
2. Implement API services as classes with constructor-injected dependencies.
3. Provide a service container for request-scoped dependency injection.
4. Remove direct DB imports from routes in favor of `createServicesFromContext`.
5. Use no-op factories and API test helpers for route testing.

## Consequences

### Positive

- Routes follow the documented thin-handler pattern.
- Services are independently testable and mockable.
- API modules align with engine DI practices.
- Cross-module coupling is reduced and explicit.

### Negative

- Migration required refactoring multiple modules.
- Slightly more boilerplate in route handlers.
- Developers must learn the service container pattern.

### Neutral

- No runtime performance impact.
- Bundle size unchanged.

## Implementation

Phases:

1. Variable Service - proof of concept
2. Service Container - infrastructure
3. Route Updates - variables module
4. All Modules - full migration
5. Documentation - this ADR and guide updates
