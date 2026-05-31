# Architecture Analysis: apps/{appName}

## 🎯 Mission
Analyze the architecture and design of `apps/{appName}` to identify technical debt, complexity, and opportunities for simplification.

## 🛡️ Execution Standards
- **Feature-First Pattern**: Ensure strict isolation of features.
- **Store Architecture**: Verify cross-store communication via event bus.

## 🚀 Workflow

### 1. Deep Dive Analysis
- Examine source code in `apps/{appName}/src`.
- Review feature organization and public APIs.
- Identify "Hotspots": Complex areas with many responsibilities.

### 2. The Report
Create a detailed report and working plan in `docs/dev/proposals/active/analyse-{appName}_[DATE]`.

#### Required Sections (README.md):
- **Problem Statement**: What is wrong or could be better?
- **Motivation**: Why change this now?
- **Solution Overview**: High-level approach.
- **Open Questions**: Anything needing user input.

#### Working Plan (01-phase.md):
- Step-by-step instructions on what to edit, add, or remove.

## ✅ Output
Notify the user with the path to the newly created proposal folder.
