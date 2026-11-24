---
name: kura-lens-setup
description: >-
  Installs, configures, and verifies the lady-lens code graph MCP tooling across developer machines and AI coding agents.
  Inspects the environment (Windows PowerShell vs Linux/macOS Bash) and generates or executes the appropriate setup script.
  Use when lady-lens is missing, when onboarding a new colleague/machine, or when setting up agent MCP registrations (lens install / lens install --skill).
---

# Lady-Lens Setup & Tooling Skill

This skill guides the automated or manual installation, configuration, and verification of `lady-lens` across developer machines and AI coding agents.

---

## 1. Environment-Specific Automated Setup

The agent detects the local operating system and shell environment before executing:

### On Windows (PowerShell)
```powershell
powershell -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/kura-lens-setup/scripts/setup-lens.ps1"
```
To also start the local background daemon (HTTP MCP on port 4318, UI dashboard on port 4317):
```powershell
powershell -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/kura-lens-setup/scripts/setup-lens.ps1" -StartDaemon
```

### On Linux / macOS / POSIX (Bash)
```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/kura-lens-setup/scripts/setup-lens.sh"
```
Or with daemon:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/kura-lens-setup/scripts/setup-lens.sh" "$(pwd)" true
```

---

## 2. Dynamic Setup Generation (Tailored to the Machine)

When running the setup interactively, the agent should inspect:
1. **OS**: Windows (`setup-lens.ps1`) vs Linux/macOS (`setup-lens.sh`).
2. **Package Manager**: checks `pnpm`, `npm`, `yarn`, or `bun`. If `pnpm` is the project standard, use `pnpm add -g lady-lens`.
3. **Repository Path**: uses current working directory.
4. **Daemon Port Availability**: verifies port 4318 and 4317 are free before starting the daemon.

---

## 3. Step-by-Step Manual Setup

If running commands individually:

### Step 1: Install globally via npm
Requires Node.js 18 or newer:
```bash
npm install -g lady-lens
lens v                         # Check version: confirms `lens` is on your PATH
```

### Step 2: Register your repository & build index
```bash
lens add .                     # Registers the repo and performs the initial graph sync
lens list                      # Verify it appears in the active repository list
```

### Step 3: Connect your AI agent(s)
```bash
lens install                   # Registers MCP entry (stdio) in all detected agents (Claude Code, VS Code, Gemini, Cursor)
lens install --skill           # Installs the lady-lens workflow skill & policy rules
```
*Note: Restart your agent or reload the IDE window after running `lens install`.*

### Step 4: (Optional) Background Daemon for HTTP / Web UI
```bash
lens mcp -d                    # Runs MCP server on http://127.0.0.1:4318/mcp and UI dashboard on http://127.0.0.1:4317
lens status                    # Inspect running daemon processes
lens stop                      # Stop background daemon
```

---

## 4. Verification Checklist

1. [ ] `lens v` outputs version number (confirms global installation).
2. [ ] `lens list` contains current repository path.
3. [ ] MCP config file for your agent contains `lady-lens` (e.g. `claude.json`, `settings.json`, or Antigravity MCP directory).
4. [ ] `lens status` confirms database is synced.
