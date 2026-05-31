# Architecture Analysis: packages/{packageName}

## 🎯 Mission
Analyze the architecture and design of `packages/{packageName}` to identify technical debt, complexity, and opportunities for simplification.

## 🛡️ Execution Standards
- **Golden Rules Check**: Verify adherence to DRY, logging, and error handling rules.
- **Simplicity over Complexity**: Every proposed change must make the system easier to understand.

## 🚀 Workflow

### 1. Deep Dive Analysis
- Examine source code in `packages/{packageName}/src`.
- Review internal dependencies and interfaces.
- Identify "Hotspots": Complex areas with many responsibilities.

### 2. The Report
Create a detailed report and working plan in `docs/dev/proposals/active/analyse-{packageName}_[DATE]`.

#### Required Sections (README.md):
- **Problem Statement**: What is wrong or could be better?
- **Motivation**: Why change this now?
- **Solution Overview**: High-level approach.
- **Open Questions**: Anything needing user input.

#### Working Plan (01-phase.md):
- Step-by-step instructions on what to edit, add, or remove.

## ✅ Output
Notify the user with the path to the newly created proposal folder.
