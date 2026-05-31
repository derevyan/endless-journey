# New Proposal Scaffolder: {proposalName}

## 🎯 Mission

Create a comprehensive proposal structure with detailed analysis, working plan, and tracking documents. Use via `/new-proposal {proposalName}`.

## 🛠️ Execution Steps

### 1. Analyze Codebase

Before generating files, analyze the existing code related to the proposal. Do not write code yet, just understand the current state.

### 2. Create Proposal Directory

Create a new directory: `docs/dev/proposals/active/{proposalName}_{YYYY-MM-DD}/`

### 3. Generate Main Proposal File (README.md)

Create `docs/dev/proposals/active/{proposalName}_{YYYY-MM-DD}/README.md`:

```markdown
# Proposal: {Proposal Title}

> Date: {Today}
> Status: DRAFT
> Author: {AgentName}

## 1. Executive Summary

High-level overview of the proposal.

## 2. Problem Statement & Motivation

Detailed explanation of why this is needed.

- **Current State Analysis**: Findings from existing code analysis.
- **Motivation**: Why change is necessary.

## 3. Proposed Solution

Detailed technical approach and architecture.

## 4. Open Questions

> ❗ **Action Required**: Please review and answer these questions to guide the implementation.

### Q1: {Question Title}

- **Context**: Why is this important?
- **Impact**: How does it affect the app?
- **Pros/Cons**:
  - Option A: ...
  - Option B: ...
- **Answer**: [ Placeholder for user answer ]

_(Repeat for all open questions)_

## 5. Implementation Phases Overview

- [ ] [Phase 1: {Phase Name}](./01-phase-1.md)
- [ ] [Phase 2: {Phase Name}](./02-phase-2.md)
- [ ] ...
```

### 4. Generate Phase Files

For each phase of the implementation, create a separate file (e.g., `01-phase-1.md`, `02-phase-2.md`) in the same folder:

```markdown
# Phase {N}: {Phase Name}

> Status: PENDING

## Objectives

What will be achieved in this phase?

## Detailed Steps & Checklist

### Step 1: {Step Name}

- **Target Files**:
  - `path/to/file.ts` (Edit/Create/Delete)
- **Action Items**:
  - [ ] Detailed instruction on what to add
  - [ ] Detailed instruction on what to remove
  - [ ] Detailed instruction on what to change
- **Verification**:
  - [ ] How to verify this step

### Step 2: ...
```

## ✅ Usage

1. Analyze the codebase.
2. Create the directory structure and files.
3. Run `notify_user` to request a review of the proposal from the lead developer.
