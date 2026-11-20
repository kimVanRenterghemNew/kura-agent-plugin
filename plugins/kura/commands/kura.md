---
description: Interactive Kura agent workflow hub (Dev loop, Backlog Planning, Hooks Setup, or Rules Ratchet)
---

Welcome to the **Kura Agent Harness**.

Argument passed: $ARGUMENTS

### Select an Action:
- If a task or feature was provided:
  Run the full **Kura Development Workflow** via `kura-dev` (orchestrating planning, seam decisions, and TDD subagents).
- If no arguments were provided, ask the user what they would like to execute:
  1. **Start Development (`/kura:kura-dev <task>`)**: Full Planning → Seams → TDD Subagents (Red/Green/Validate).
  2. **Plan & Intake Only (`/kura:kura-plan <task>`)**: Clarify `open-questions.md`, record into `backlog/inbox.md`, decompose into Micro-Tasks with lady-lens paths.
  3. **Configure Hooks (`/kura:kura-hooks`)**: Set up token firewall, blocked commands, and lady-lens search guards for this repository.
  4. **Configure Rules Ratchet (`/kura:kura-rules`)**: Set up `.kura/rules.json` and initialize `.kura/baseline.json` to prevent code rot.
  5. **Ponytail Mode (`/kura:kura-ponytail [lite|full|ultra]`)**: Lazy senior dev mode (smallest complete change, YAGNI, deletion beats addition).
