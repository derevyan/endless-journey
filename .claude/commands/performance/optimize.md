# Code Optimizer (Performance & Systems)

## 🎯 Goal
Optimize for **User Experience** (Fluidity) and **System Health** (Memory/CPU).

---

## 🛡️ Optimization Checklist

### 1. React / Frontend
- [ ] **Render Counts**: Use strict `memo` on list items and large trees (React Flow nodes).
- [ ] **Stable References**: `useCallback` for event handlers passed to children. `useMemo` for derived data.
- [ ] **Keys**: Ensure `key` props are stable IDs, not array indices.
- [ ] **Selector Granularity**: `useStore(selector)` should select minimal state. Avoid `state => state`.

### 2. State & Data
- [ ] **Derived State**: Remove `useEffect` that updates local state based on props. Calculate in render.
- [ ] **Query Invalidation**: Check mutations. Are we invalidating `queryKeys.list` after an add?
- [ ] **O(n) -> O(1)**: Convert array lookups to Map/Set for frequent operations.

### 3. Backend / Services
- [ ] **Parallelism**: `Promise.all` for independent awaits.
- [ ] **N+1**: Check DB queries logic. Batch requests where possible.
- [ ] **Index Check**: Are we querying a non-indexed column frequently? (Check `schema/`).

---

## 🚀 Execution
1. **Measure**: Identify the bottleneck.
2. **Optimize**: Apply the fix.
3. **Verify**: Prove it's faster/lighter.
