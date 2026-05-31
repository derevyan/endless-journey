# New Feature Scaffolder: {featureName}

## 🎯 Mission
Create a new feature module following the strict "Feature-First" architecture. Use via `/new-feature {featureName}`.

## 🛠️ Execution Steps

### 1. Create Directory Structure
```bash
mkdir -p apps/web/src/features/{FeatureName}/{components,hooks,lib,store}
```

### 2. Create Public API (Barrel)
Create `apps/web/src/features/{FeatureName}/index.ts`:
```typescript
export { {PascalCaseFeatureName}Page } from "./pages/{FeatureName}-page";
// export { use{PascalCaseFeatureName} } from "./hooks";
```

### 3. Create Main Page Component
Create `apps/web/src/features/{FeatureName}/pages/{FeatureName}-page.tsx`:
```typescript
import { PageHeader } from "@/features/dashboard/components/page-header";

export function {PascalCaseFeatureName}Page() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="{FeatureName Display Name}"
        description="Feature description goes here"
      />
      <div className="p-6">
        <h2 className="text-lg font-semibold">Welcome to {FeatureName Display Name}</h2>
      </div>
    </div>
  );
}
```

### 4. Create Route File
Create `apps/web/src/routes/_dashboard.{FeatureName}.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { {PascalCaseFeatureName}Page } from "@/features/{FeatureName}";

export const Route = createFileRoute("/_dashboard/{FeatureName}")({
  component: {PascalCaseFeatureName}Page,
});
```

### 5. Update Navigation (Manual Step)
> [!IMPORTANT]
> The sidebar does not auto-update.
> Add the new item to `apps/web/src/features/dashboard/components/sidebar-data.ts`.

## ✅ Validation
- Run `pnpm typecheck` to ensure route generation picks it up.
