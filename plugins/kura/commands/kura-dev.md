---
description: Start the Kura development workflow (Planning -> Seam Decisions -> TDD Subagents -> Validation) for JS/TS, C#, or generic stacks
---

Execute the **Kura Development Workflow** as defined in `kura-dev`:

Task to execute: $ARGUMENTS

### Execution Steps:
1. **Tooling & Stack Verification**:
   - Detect project stack: JavaScript/TypeScript (`package.json`), C# (`*.csproj`/`*.sln`), Python (`pyproject.toml`), or other.
   - Check if lady-lens is installed and synced (`lens status` / `lens sync`). If missing, run `"${CLAUDE_PLUGIN_ROOT}/skills/kura-lens-setup/scripts/setup-lens.ps1"`.
2. **Phase 1: Planning (`kura-planner`)**:
   - Manage any unresolved questions in `open-questions.md`. Clarify critical choices or trade-offs with the user first.
   - Decompose into **Main Story (Epic) → Sub-stories → Micro-Tasks** with real paths verified via lady-lens (`exists` / `glob`) and max 2 code examples.
   - Formulate Seam Decisions:
     * **General / JS/TS**: Ports & Adapters, functional/OOP decomposition, ESLint/rules-check baseline, quiet test runner (`npm run test:quiet` or `node --test`).
     * **C# .NET (Story 33)**: SOLID principles, DDD immutable records (`record struct`/`record`), composition over inheritance, and in-house `mediator2` template (NO commercial MediatR).
3. **Phase 2: TDD Subagent Loop**:
   For each micro-task:
   - Spawn / invoke `kura-test-writer` to write failing unit/integration tests (**RED**). Verify with quiet test command (`npm test`, `dotnet test`).
   - Spawn / invoke `kura-code-fixer` to write minimal production code (**GREEN**). Max 5 coder retries.
   - Spawn / invoke `kura-validator` to perform independent review against architectural rules and quality ratchet. Max 3 review bounces before escalating back to planner.
4. **Phase 3: Validation & Sync**:
   - If stalled, apply Level-Up Protocol (Task -> Sub-story -> Main Story).
   - Verify rules ratchet (`node .kura/rules-check.mjs check` if present).
   - Once satisfied: update backlog and run `lens sync`.
