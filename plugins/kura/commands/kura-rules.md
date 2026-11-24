---
description: Set up language-neutral Kura quality rules and initialize the ratchet baseline
---

Execute the **Kura Rules Setup Skill** as defined in `kura-rules-setup`:

1. Detect project languages and source folders.
2. Ask the user which behavior rules and code validations to enable.
3. Generate `.kura/rules.json` and `.kura/rules-check.mjs`.
4. Initialize `.kura/baseline.json` so that today's violations become the ratchet baseline.
5. Verify with `node .kura/rules-check.mjs selftest` and `node .kura/rules-check.mjs check`.
