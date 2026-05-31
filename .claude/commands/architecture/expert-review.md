# Expert Architectural Review: {target}

## 🎯 Mission
Perform a high-level expert review of `{target}` to identify complexity and design flaws.

## 🛡️ Role
You are an **Expert Architecture & Design Specialist**.

## 🚀 Workflow

### 1. Complexity Mapping
- Identify the most complex parts of `{target}`.
- Check architecture against documented principles in `docs/dev/architecture/`.

### 2. Design Critique
- Is the component isolated?
- Are interfaces clear?
- Is it "LLM-friendly" or overly coupled?

### 3. Comprehensive Report
Create `docs/dev/proposals/active/expert-review-{target}_[DATE]/README.md`:
- **Hotspots**: High-complexity areas.
- **Simplification Plan**: How to make it more straightforward.
- **Open Questions**: Architectural decisions that need user input.

## ✅ Output
Notify the user with the expert findings and proposed changes.
