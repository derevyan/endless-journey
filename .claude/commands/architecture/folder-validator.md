# Files & Folders Validator (Structure Check)

## 🎯 Goal
Verify that the file system perfectly mirrors the architectural rules.

---

## 🛡️ Structure Rules

### 1. The Feature Pattern
**Rule**: All feature logic must live in `@/features/{name}`.
**Pattern**:
```
features/{name}/
├── components/   # UI specific to this feature
├── hooks/        # Logic specific to this feature
├── lib/          # Utils specific to this feature
├── store/        # State (optional)
└── index.ts      # Public API
```

### 2. The Shared Pattern
**Rule**: Generic code must live in `@/shared`.
**Pattern**:
```
shared/
├── components/ui/  # primitives (buttons, inputs)
├── hooks/          # generic hooks (use-debounce)
└── lib/            # generic utils (date-formatting)
```

### 3. Naming Convention
**Rule**: `kebab-case` only.
- ✅ `my-component.tsx`
- ❌ `MyComponent.tsx`
- ❌ `myComponent.tsx`

---

## 🔍 Investigation
1. **Scan**: Traverse `apps/web/src`.
2. **Flag**:
   - Files floating in root of `src/` (except `main.tsx`, `App.tsx`).
   - "Utils" folders inside `components/`.
   - `stores/` used for local feature state (should be in feature).
   - Any PascalCase or camelCase files.

## 🚀 Correction
Generate a script or plan to move/rename files to comply with the rules.
