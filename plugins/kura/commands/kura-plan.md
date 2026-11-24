---
description: Start Kura backlog planning and intake only (open-questions.md, inbox recording, and micro-task decomposition)
---

Execute the **Kura Backlog Planning & Intake Workflow** as defined in `kura-backlog-planning`:

Task: $ARGUMENTS

### Execution:
1. Ensure the user's request is recorded in `backlog/inbox.md`.
2. Inspect codebase using lady-lens (`glob`, `grep`, `searchView`).
3. If assumptions or trade-offs exist: manage `open-questions.md` and clarify with the user.
4. Decompose the request into:
   - **Main Story (Epic)**
   - **Sub-stories**
   - **Micro-Tasks** with real paths verified via lady-lens (`exists` / `glob`) and max 2 code examples.
5. Formulate Seam Decisions (Ports & Adapters, SOLID, DDD records).
