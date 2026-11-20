---
description: Set up opt-in Kura agent hooks (lens search guard, blocked commands, quiet test enforcement, inbox, and snapshot)
---

Execute the **Kura Hooks Setup Skill** as defined in `kura-hooks-setup`:

1. Detect the repository stack (Node/npm, .NET, Python, etc.) and git configuration.
2. Ask the user per hook which ones they want enabled for this repo.
3. Generate the tailored `.claude/hooks/repo-hooks.mjs` and `.githooks/pre-commit`.
4. Run the built-in selftest (`node .claude/hooks/repo-hooks.mjs selftest`) to verify the configuration.
