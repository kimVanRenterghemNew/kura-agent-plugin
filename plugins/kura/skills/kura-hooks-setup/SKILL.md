---
name: kura-hooks-setup
description: >-
  Installs the Kura agent hooks (lady-lens search guard, blocked commands, lens sync after edits, session briefing,
  inbox of the user's requests, status-file guard, snapshot before compaction, git pre-commit check) in ANY repository.
  Asks the user per hook whether they want it and generates a version specific to that repo.
  Use when setting up Kura in a new repo, or when the user asks for "the Kura hooks" / "kura hooks installeren".
---

# Kura hooks setup

The Kura repo enforces its agent rules with hooks (`.claude/hooks/kura.mjs`, `.githooks/pre-commit.mjs`). Those files
are hard-wired to Kura (its folders, `npm run test:quiet`, `scripts/briefing.mjs`, Dutch file names). This skill installs
the same behaviour in another repo: detect the repo, ask per hook, fill in the templates next to this file, verify.

Templates: `${CLAUDE_PLUGIN_ROOT}/skills/kura-hooks-setup/templates/` (`hooks.mjs`, `pre-commit.mjs`, `pre-commit`).

**Never overwrite**: merge into an existing `.claude/settings.json`, keep existing hooks, and stop and ask when the repo
already has a git hook manager (husky, lefthook, pre-commit, `core.hooksPath` set).

---

## Step 1: Detect the repo (no questions yet)

Collect, from the repo root:

| Fact | How |
|---|---|
| Stack and test/check command | `package.json` scripts (`test`, `check`, `lint`, `test:quiet`), `*.sln`/`*.csproj` (`dotnet build`/`dotnet test`), `pyproject.toml` (`pytest -q`), `go.mod` (`go vet ./... && go test ./...`), `Makefile` |
| Top-level folders and key files | `git ls-files` → first path segment, keep folders with source, tests, docs, key files like `package.json`, `README.md`, `*.sln` |
| Not indexed (shell search is fine) | `.gitignore` entries that are folders (`node_modules`, `bin`, `obj`, `dist`, `out`, `coverage`, `.venv`) plus `.git` |
| lady-lens present | `lens v` succeeds, or `mcp__lady-lens__*` tools are available, repo registered (`lens list`) |
| Existing hooks | `.claude/settings.json` → `hooks`, `git config core.hooksPath`, `.husky/`, `lefthook.yml`, `.pre-commit-config.yaml` |
| Status / inbox files | an existing `backlog/`, `docs/`, `NOTES.md`, `TODO.md`, else propose `backlog/now.md` and `backlog/inbox.md` |
| Language of the user | the language they write in (for the confirmation words and file names) |

## Step 2: Ask per hook

First one multi-select question (AskUserQuestion, `multiSelect: true`) with the hooks below. Mark a hook
"(needs lady-lens)" and leave it out of the recommendation when lens is not present. Show per hook in one line what it
does **in this repo**, with the detected values (e.g. "blocks `grep` on `src/`, `tests/`, allowed in `bin/`, `obj/`").

| # | Hook | Event | What it does | Needs |
|---|---|---|---|---|
| 1 | Lens search guard | `PreToolUse` `Grep\|Glob\|Bash\|PowerShell` | Blocks repo search outside lady-lens | lady-lens |
| 2 | Blocked commands | `PreToolUse` `Bash\|PowerShell` | Blocks shell commands the agent may not run (a noisy test run, `git push`, `npm publish`, ...) and says what to do instead | – |
| 3 | Lens sync | `PostToolUse` `Edit\|Write\|MultiEdit` | Syncs the lens graph after each edit | lady-lens |
| 4 | Session briefing | `SessionStart` | Branch, uncommitted files, open inbox items, status file, optional style skill (e.g. caveman) | – |
| 5 | Inbox | `UserPromptSubmit` | Writes the user's structural discussions to the inbox file, so they do not get lost (short questions and commands stay out) | – |
| 6 | Status guard | `Stop` | Blocks the end of a turn when files changed and the status file is not updated today | – |
| 7 | Snapshot | `PreCompact` + `SessionEnd` | Writes branch, last commit and uncommitted files into the status file | – |
| 8 | Pre-commit check | git `pre-commit` | Runs the check command when code (not only notes) is staged | a check command |

Then, only for the chosen hooks, confirm the values you could not detect with certainty (one question each, the
detected value as the recommended first option):

- 2: which commands to block (multi-select), proposed for the detected stack, each with its message:
  - the noisy test run, when a quiet one exists (`npm test` → `npm run test:quiet`, `dotnet test` → `dotnet test --verbosity quiet`,
    `gradle test` → `gradle test --quiet`, `pytest` → `pytest -q`)
  - `git push` (the owner pushes), `npm publish` / `dotnet nuget push` / `gradle publish` (the owner publishes)
  - `git reset --hard`, `git clean -fd`, `rm -rf` (ask first)
- 4: briefing: built-in (default) or an existing repo command (e.g. `npm run session:init`), style skill path or none.
- 5: the minimum message length in words (`inboxMinWords`, default 12) and extra replies to ignore in the user's
  language (`inboxIgnore`, e.g. `ja`, `doe maar`, `ga verder` for a Dutch speaker).
- 5, 6, 7: the inbox file, the status file, the "updated" marker (default `Updated:`), the owner's name for the inbox title.
- 8: the check command (fast: build + fast tests + lint, never the whole slow suite) and which paths count as notes.

Hooks 6 and 7 share the status file, 5 and 6 share the inbox. When 6 is chosen without 5, leave the inbox part out of
its message (set `inboxFile: ''`).

## Step 3: Generate

1. Copy `templates/hooks.mjs` to `.claude/hooks/repo-hooks.mjs` (only when hook 1–7 is chosen). Fill in `CONFIG`:
   - `lensGuard`: true only for hook 1. `repoDirs`/`repoFiles`/`notIndexed`: the detected values.
   - `blockedCommands`: one `{ pattern, message }` per chosen command (`[]` when hook 2 is off). The pattern is a regex
     string (backslashes doubled), anchored to the start of a command segment like the template's test entry. The
     message says what to do instead, and must not match its own pattern (the selftest checks that).
   - the other keys from Step 2. Keep the code below `end CONFIG` unchanged.
2. Merge into `.claude/settings.json` only the entries of the chosen hooks (create the file when missing, keep other keys):

   ```json
   {
     "hooks": {
       "SessionStart":     [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs start" }] }],
       "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs prompt" }] }],
       "PreToolUse":  [{ "matcher": "Grep|Glob|Bash|PowerShell", "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs pre-tool" }] }],
       "PostToolUse": [{ "matcher": "Edit|Write|MultiEdit", "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs post-edit" }] }],
       "Stop":        [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs stop" }] }],
       "PreCompact":  [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs snapshot" }] }],
       "SessionEnd":  [{ "hooks": [{ "type": "command", "command": "node .claude/hooks/repo-hooks.mjs snapshot" }] }]
     }
   }
   ```

   Hook 1 and 2 share the `PreToolUse` entry. With only hook 2, use matcher `Bash|PowerShell`.
3. Hook 8: copy `templates/pre-commit` and `templates/pre-commit.mjs` to `.githooks/`, fill in `CONFIG`, then
   `git config core.hooksPath .githooks`. For a Node repo, offer to add `"prepare": "git config core.hooksPath .githooks"`
   to `package.json` so every clone gets it. With husky/lefthook/pre-commit present: add the check command there instead.
4. Add a short section to the repo's agent instructions (`AGENTS.md` or `CLAUDE.md`) that names each chosen rule, so
   agents without hooks (Copilot, Gemini, Codex) follow it by hand.

## Step 4: Verify (all must pass before you report done)

```bash
node .claude/hooks/repo-hooks.mjs selftest                                                    # "selftest ok"
echo '{"tool_name":"Grep","tool_input":{"pattern":"x"}}' | node .claude/hooks/repo-hooks.mjs pre-tool
echo $?                                                                                        # 2 with hook 1
echo '{"tool_name":"Bash","tool_input":{"command":"git status"}}' | node .claude/hooks/repo-hooks.mjs pre-tool
echo $?                                                                                        # 0
echo '{}' | node .claude/hooks/repo-hooks.mjs start                                           # prints the briefing
node .githooks/pre-commit.mjs
echo $?                                                                                        # 0 with nothing staged
```

For hook 2 also pipe each blocked command and its advice: the first exits 2, the second 0. Then tell the user to restart
Claude Code (or run `/hooks`) so the new hooks load, and list per hook: on/off and the values used.
