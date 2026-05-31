# Developer Documentation

Documentation for Journey Builder developers.

## Architecture

### Core Architecture
- [**System Overview**](./architecture/system-overview.md) - High-level architecture, technology stack, patterns
- [**Project Structure**](./architecture/project-structure.md) - Folder organization, naming conventions, decision guide
- [**Data Flows**](./architecture/data-flows.md) - Key data flow diagrams (7 flows documented)
- [**Edge System**](./architecture/edge-system.md) - Three-tier edge system (regular, managed, virtual)

### Unified Services Architecture
The unified services layer provides consistent service access across the engine, LLM workflows, and tools.

- [**Unified Services Overview**](./architecture/unified-services/README.md) - SharedServiceContext architecture
- [**Service Interfaces**](./architecture/unified-services/service-interfaces.md) - All 11 service interface specifications
- [**Variable Namespaces**](./architecture/unified-services/variable-namespaces.md) - `{{vars.scope.key}}` template syntax
- [**Event Bridge**](./architecture/unified-services/event-bridge.md) - SSE → store event synchronization
- [**Permission Model**](./architecture/unified-services/permission-model.md) - Capability-based access control
- [**Type Conversion**](./architecture/unified-services/type-conversion.md) - Type coercion utilities
- [**Testing Patterns**](./architecture/unified-services/testing-patterns.md) - No-op factories and mocking

## Guides

- [**Component Organization**](./guides/component-organization.md) - Feature-first architecture, component categories
- [**Adding New Node Type**](./guides/adding-new-node-type.md) - Node plugin system, 4-file pattern
- [**Adding Node Features**](./guides/adding-node-features.md) - Feature flags for nodes
- [**Using Shared Services**](./guides/using-shared-services.md) - SharedServiceContext patterns and testing
- [**CRM Journey Integration**](./guides/crm-journey-integration.md) - CRM and journey integration
- [**Dashboard Builder**](./guides/dashboard-builder.md) - Building dashboard pages
- [**Plugin System**](./guides/plugin-system.md) - Node plugin architecture, adding new plugin types

## Other Docs

- [**Web App**](../web/README.md) - Web application overview
- [**API**](../api/README.md) - API documentation
- [**Engine**](../engine/README.md) - Journey engine
- [**LLM**](../llm/README.md) - LLM services, agents, middleware, tools
- [**Schemas**](../schemas/README.md) - Type definitions
- [**Logger**](../logger/README.md) - Logging system
- [**Database**](../db/README.md) - Database schema
- [**MCP**](../mcp/README.md) - MCP service client and types

## Quick Links

| Topic | Doc |
|-------|-----|
| Where does code go? | [Project Structure](./architecture/project-structure.md#decision-guide-where-does-this-code-go) |
| Adding a feature | [Component Organization](./guides/component-organization.md#adding-new-features) |
| Adding a node type | [Adding New Node Type](./guides/adding-new-node-type.md) |
| Store architecture | [Project Structure](./architecture/project-structure.md#stores----state-management) |
| Edge ID classes | [Edge System](./architecture/edge-system.md#edge-id-classes) |
| Naming conventions | [Project Structure](./architecture/project-structure.md#naming-conventions) |
| Service interfaces | [Unified Services](./architecture/unified-services/service-interfaces.md) |
| Variable access | [Variable Namespaces](./architecture/unified-services/variable-namespaces.md) |
| Testing with mocks | [Testing Patterns](./architecture/unified-services/testing-patterns.md) |
| Permission system | [Permission Model](./architecture/unified-services/permission-model.md) |
| Adding a plugin type | [Plugin System](./guides/plugin-system.md) |
