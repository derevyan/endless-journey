# Badge Collection Guide

Centralized badge components live in `apps/web/src/shared/components/ui/badges/`.
Use these instead of ad-hoc `<span>` styling or inline variant mappers.

## Base Badge

```tsx
import { Badge } from "@/shared/components/ui/badges";

<Badge variant="outline" size="sm">Preview</Badge>
```

### Variants

- `default`
- `secondary`
- `destructive`
- `outline`
- `info`
- `success`
- `warning`
- `error`

### Sizes

- `xs`
- `sm`
- `default`
- `md`

## Specialized Badges

```tsx
import {
  EntityStatusBadge,
  EventTypeBadge,
  LogLevelBadge,
  RoleBadge,
  LabelBadge,
  TagBadge,
  VariableTypeBadge,
  StatusDotBadge,
  CountBadge,
  HttpMethodBadge,
} from "@/shared/components/ui/badges";
```

### EntityStatusBadge

```tsx
<EntityStatusBadge status="active" entityType="journey" size="sm" />
```

### EventTypeBadge

```tsx
<EventTypeBadge type={event.type} size="sm" />
```

### LogLevelBadge

```tsx
<LogLevelBadge level="warn" size="md" />
```

### RoleBadge

```tsx
<RoleBadge role="admin" size="md" />
```

### LabelBadge

```tsx
<LabelBadge label="production" size="sm" />
```

### CountBadge

```tsx
<CountBadge count={3} size="sm" />
```

### HttpMethodBadge

```tsx
<HttpMethodBadge method="POST" size="sm" />
```

## Migration Notes

- Import badges from `@/shared/components/ui/badges`.
- Avoid duplicating mappings or styles in feature components.
- Prefer `EntityStatusBadge` over feature-specific status badges.
