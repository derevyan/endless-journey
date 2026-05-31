# Service Interfaces

> Complete reference for all service interfaces in the SharedServiceContext.

## Overview

All service interfaces are defined in `packages/schemas/src/runtime/services/` and exported from `@journey/schemas`. Each interface follows a consistent pattern:

- **Primary methods** are required (core functionality)
- **Advanced methods** are optional (implementations may omit them)
- **All methods are async** (return Promises)

---

## Core Services

These services are always available in `SharedServiceContext`.

### IVariableService

Manages scoped variables (`journey`, `user`, `global`).

```typescript
import type { VariableScope, VariableOperation, VariableAction } from "@journey/schemas";

interface IVariableService {
  // Required
  getAll(scope: VariableScope): Promise<Record<string, unknown>>;
  executeAction(action: VariableAction): Promise<void>;

  // Optional
  getValue?(scope: VariableScope, key: string): Promise<unknown>;
  setValue?(scope: VariableScope, key: string, value: unknown): Promise<void>;
  executeOperation?(scope: VariableScope, operation: VariableOperation): Promise<void>;
  delete?(scope: VariableScope, key: string): Promise<void>;
  exists?(scope: VariableScope, key: string): Promise<boolean>;
}
```

**VariableAction shape:**

```typescript
type VariableAction = {
  journeyOperations?: VariableOperation[];
  globalOperations?: VariableOperation[];
  userOperations?: VariableOperation[];
};
```

**Variable Scopes:**

| Scope     | Lifetime             | Description                            |
| --------- | -------------------- | -------------------------------------- |
| `journey` | Per journey instance | Variables specific to a user's journey |
| `user`    | Per user             | Persistent user preferences            |
| `global`  | Organization-wide    | Shared configuration                   |

**Note:** Session data is exposed in template namespaces (e.g. `{{session.*}}`), not as a variable scope.

### ITemplateService

Handles template substitution with variable replacement.

```typescript
import type { TemplateContext, TemplateOptions } from "@journey/schemas";

interface ITemplateService {
  // Required
  substitute(template: string, context: Record<string, unknown>): string;

  // Optional
  resolve?(template: string, context: TemplateContext, options?: TemplateOptions): Promise<string>;
  resolveSync?(template: string, context: TemplateContext, options?: TemplateOptions): string;
  hasVariables?(template: string): boolean;
  extractVariables?(template: string): string[];
  validateVariables?(template: string, context: TemplateContext): string[];
  getValueAtPath?(path: string, context: TemplateContext): unknown;
}
```

### IMessengerService

Sends messages to users across channels.

```typescript
import type {
  ButtonConfig,
  Media,
  MessageOptions,
  ButtonOptions,
  MediaOptions,
  SendResult,
} from "@journey/schemas";

interface IMessengerService {
  // Required
  sendMessage(
    content: string,
    buttons?: ButtonConfig[],
    media?: Media,
    options?: MessageOptions
  ): Promise<SendResult>;

  // Optional
  sendButtons?(buttons: ButtonConfig[], options?: ButtonOptions): Promise<SendResult>;
  sendMedia?(media: Media, options?: MediaOptions): Promise<SendResult>;
  editMessage?(messageId: string, content: string, options?: MessageOptions): Promise<SendResult>;
  deleteMessage?(messageId: string): Promise<SendResult>;
  sendTypingIndicator?(durationMs?: number): Promise<void>;
}
```

---

## Optional Services

Check availability with `context.services.has("serviceName")` before calling.

### IMemoryService

Semantic memory storage for AI context.

```typescript
import type { SaveMemoryParams, MemorySearchResult, MemoryResult } from "@journey/schemas";

interface IMemoryService {
  save(params: SaveMemoryParams): Promise<void>;
  search(query: string, limit?: number): Promise<MemorySearchResult[]>;
  getRecent(limit?: number): Promise<MemoryResult[]>;
  get(key: string): Promise<MemoryResult | null>;
  delete(key: string): Promise<boolean>;
  exists?(key: string): Promise<boolean>;
  getAll?(): Promise<MemoryResult[]>;
  clear?(): Promise<void>;
}
```

### ICrmService

CRM pipeline and contact management.

```typescript
import type {
  Pipeline,
  PipelineStage,
  ContactData,
  NoteMetadata,
  UserPipelinePosition,
} from "@journey/schemas";

interface ICrmService {
  // Required
  updateClientPosition(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;

  // Optional - Pipeline management
  addToPipeline?(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;
  removeFromPipeline?(clientId: string, pipelineId: string): Promise<void>;
  moveToStage?(clientId: string, stageId: string, notes?: string): Promise<void>;
  updatePosition?(userId: string, pipelineId: string, position: number): Promise<void>;

  // Optional - Deal management
  setDealValue?(userId: string, pipelineId: string, value: number, currency?: string): Promise<void>;
  assignOwner?(userId: string, pipelineId: string, ownerId: string): Promise<void>;

  // Optional - Contact management
  updateContact?(userId: string, contactData: ContactData): Promise<void>;
  createNote?(userId: string, content: string, metadata?: NoteMetadata): Promise<void>;

  // Optional - Read operations
  getPipelines?(): Promise<Pipeline[]>;
  getUserPipeline?(userId: string, pipelineId: string): Promise<UserPipelinePosition | null>;
  getUserPipelines?(userId: string): Promise<UserPipelinePosition[]>;
  getStages?(pipelineId: string): Promise<PipelineStage[]>;
  getDefaultPipeline?(): Promise<Pipeline | null>;
  getNotes?(userId: string, limit?: number): Promise<Array<{ content: string; createdAt: Date; metadata?: NoteMetadata }>>;
}
```

### ITagService

User tag management.

```typescript
import type { TagAction, TagResult, Tag } from "@journey/schemas";

interface ITagService {
  // Required
  executeTagAction(add?: string[], remove?: string[]): Promise<void>;
  getTags(): Promise<string[]>;

  // Optional
  addTags?(tags: string[]): Promise<string[]>;
  removeTags?(tags: string[]): Promise<string[]>;
  executeAction?(action: TagAction): Promise<TagResult>;
  hasTag?(tag: string): Promise<boolean>;
  hasAllTags?(tags: string[]): Promise<boolean>;
  hasAnyTag?(tags: string[]): Promise<boolean>;
  setTags?(tags: string[]): Promise<void>;
  clearTags?(): Promise<void>;
  getAllAvailableTags?(): Promise<Tag[]>;
}
```

### IMindstateService

Mindstate tracking and analysis.

```typescript
interface IMindstateService {
  getParameterValue(clientId: string, mindstateKey: string, parameterName: string): Promise<unknown>;
  getState?(userId: string): Promise<Record<string, unknown> | null>;
  updateState?(userId: string, updates: Record<string, unknown>): Promise<void>;
  analyzeAndUpdate?(userId: string, conversation: string[]): Promise<void>;
}
```

### IDlqService

Dead letter queue for failed operations.

```typescript
interface IDlqService {
  sendToDlq(params: { messageId: string; error: string; payload: unknown; retryCount?: number }): Promise<void>;
  retry?(messageId: string): Promise<boolean>;
}
```

### IExpressionService

Expression evaluation for conditions.

```typescript
interface IExpressionService {
  evaluate(expression: string, context: Record<string, unknown>): unknown;
  isTruthy(expression: string, context: Record<string, unknown>): boolean;
  validate?(expression: string): boolean;
}
```

### IFollowUpService

Follow-up message scheduling.

```typescript
interface IFollowUpService {
  schedule(params: {
    userId: string;
    nodeId: string;
    delaySeconds: number;
    message?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;
  cancel(followUpId: string): Promise<void>;
  cancelAllForUser(userId: string): Promise<void>;
}
```

### ICacheService

Redis-backed caching layer.

```typescript
import type { CacheOptions, CacheStats } from "@journey/schemas";

interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;

  getMany<T>(keys: string[]): Promise<Map<string, T>>;
  setMany<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void>;
  deleteMany(keys: string[]): Promise<number>;
  deletePattern(pattern: string): Promise<number>;

  ttl(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  touch(key: string, ttlSeconds: number): Promise<boolean>;

  getStats?(): Promise<CacheStats | null>;
  clear?(): Promise<void>;
  isHealthy(): Promise<boolean>;
}
```

### IJourneyService

Journey routing and session transfers.

```typescript
import type { StartJourneyOptions, StartJourneyResult, UserJourneySession, JourneyInfo, JourneyListFilters, EndSessionOptions } from "@journey/schemas";

interface IJourneyService {
  startUserInJourney(userId: string, journeyId: string, options?: StartJourneyOptions): Promise<StartJourneyResult>;
  getUserActiveJourneys(userId: string): Promise<UserJourneySession[]>;
  listJourneys(filters?: JourneyListFilters): Promise<JourneyInfo[]>;

  endUserSession?(userId: string, journeyId: string, options?: EndSessionOptions): Promise<boolean>;
  getJourneyInfo?(journeyId: string): Promise<JourneyInfo | null>;
  hasUserCompletedJourney?(userId: string, journeyId: string): Promise<boolean>;
}
```

---

## API Service Interfaces

API services extend the runtime interfaces with organization-scoped operations and are used by the API service container.

### Available API Interfaces

| Interface             | Used By                     | Notes                               |
| --------------------- | --------------------------- | ----------------------------------- |
| `IApiVariableService` | Variables routes            | Extends `IVariableService`          |
| `IApiTagService`      | Tags routes                 | Extends `ITagService`               |
| `IApiCrmService`      | CRM routes                  | Extends `ICrmService`               |
| `IApiChannelService`  | Channels routes             | Org + session scoped operations     |
| `IApiJourneyService`  | Journeys routes             | CRUD + versioning                   |
| `IApiUserService`     | Users routes                | Activity + listing                  |
| `IApiPromptService`   | Prompts routes              | Prompt repository                   |
| `IApiEventService`    | Event API routes            | Logs, stats, replay                 |
| `IApiUploadService`   | Uploads routes              | Media library                       |
| `IApiWorkflowService` | Workflows routes            | CRUD, approvals, emitters           |
| `IApiMindstateService`| Mindstates routes           | Definitions + analysis              |
| `IApiSimulatorService`| Simulator routes            | Sessions, personas, timers          |

### Example: IApiVariableService

```typescript
import type { IApiVariableService } from "@journey/schemas";

interface IApiVariableService extends IVariableService {
  getGlobalVariables(): Promise<GlobalVariable[]>;
  getJourneyVariables(journeyId: string): Promise<JourneyVariable[]>;
  getUserVariables(clientId: string): Promise<UserVariable[]>;
}
```

---

## Implementing a Service

When implementing a service for use in `SharedServiceContext`:

```typescript
// apps/api/src/modules/variables/services/variable-service.ts
import type { IVariableService, VariableScope, ICacheService } from "@journey/schemas";

export class VariableService implements IVariableService {
  constructor(private db: Database, private cache: ICacheService) {}

  async getAll(scope: VariableScope): Promise<Record<string, unknown>> {
    // Try cache first
    const cacheKey = `vars:${this.sessionId}:${scope}`;
    const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    // Fall back to database
    const result = await this.db.query.variables.findMany({
      where: { sessionId: this.sessionId, scope },
    });

    const vars = Object.fromEntries(result.map((v) => [v.key, v.value]));

    // Cache for next time
    await this.cache.set(cacheKey, vars, { ttlSeconds: 300 }); // 5 min TTL

    return vars;
  }

  // ... implement other methods
}
```

---

## See Also

- [SharedServiceContext](./README.md) - Architecture overview
- [Testing Patterns](./testing-patterns.md) - Using no-op implementations
- [Permission Model](./permission-model.md) - Access control
