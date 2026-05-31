# Documentation Update & Audit: apps/{appName}

## 🎯 Mission
Sync the documentation with reality for `apps/{appName}`. **Code is truth; docs are often lies.** Your job is to make them agree.

## 🛡️ Execution Standards
- **Location**: All docs go to `docs/{appName}/` or `docs/dev/architecture/`.
- **References**: `apps/{appName}/README.md` should only contain links to the real docs.
- **Accuracy**: Verify every claim against the code.

## 🚀 Workflow

### 1. The Audit (Scan & Verify)
- Read `apps/{appName}` source code.
- Read existing docs in `docs/{appName}/`.
- Identify "Drift": Where does code disagree with docs?
- Identify "Gaps": What features are undocumented?

### 2. The Update (Fix the Docs)
- Update `docs/{appName}/README.md` and sub-files.
- Create new docs for undocumented features.
- Update diagrams in `docs/dev/architecture/diagrams`.

### 3. The Proposal (Improve the Code)
While scanning, if you find bugs, complexity, or "smells":
- **Create Proposal**: `docs/dev/proposals/active/improve-{appName}_[DATE]/`
- **Structure**:
    - `README.md`: Problem, Solution, Pros/Cons, Open Questions.
    - `01-phase.md`: Detailed working plan.
- **Do not fix code now**. Just document the plan.
