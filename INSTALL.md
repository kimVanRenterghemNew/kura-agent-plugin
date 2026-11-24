# Kura Agent Plugin — Installation & Getting Started Guide

`kura-agent-plugin` is a polyglot AI development harness for **Claude Code**, **Antigravity (AGY)**, and **Gemini CLI**. It equips coding agents with:
- **`lady-lens` AST Code Graph**: Zero-hallucination code search and verified file paths.
- **Strict 4-Agent TDD Workflow** (`/kura-dev`): Red-Green-Refactor with isolated planner, test-writer, code-fixer, and validator subagents.
- **Language-Specific Architectures**: Hexagonal Architecture (Ports & Adapters) for JS/TS and SOLID, DDD records, and `mediator2` for C# .NET.
- **Quiet Test Runner & Output Firewall**: Full command logs written to disk (`outputs/quiet/*.log`) with compact, high-signal summaries in terminal to prevent context window bloat.
- **Opt-in Hooks & Ratchet Rules**: Search guards, blocked noisy commands, session briefing, and code quality thresholds.

---

## 1. Plugin Installation

### Option A: Install in Claude Code (Marketplace / Plugin Directory)
Install directly from the marketplace or local plugin directory:
```bash
# Add as a Claude Code plugin
claude plugin add kura-agent-plugin

# Or run with local plugin directory:
claude --plugin-dir /path/to/kura-agent-plugin
```

### Option B: Install in Antigravity / Gemini CLI
Copy or symlink the plugin into your custom plugins directory:
```powershell
# Windows
Copy-Item -Path "plugins\kura" -Destination "$env:USERPROFILE\.gemini\config\plugins\kura" -Recurse -Force
```
```bash
# Linux / macOS
cp -r plugins/kura ~/.gemini/config/plugins/kura
```

---

## 2. Setting Up Kura in Any Repository (Polyglot)

Kura works across **any stack** (Node.js/TypeScript, C# .NET, Python, Go, Java). Follow these steps to prepare your workspace:

### Step 1: Initialize `lady-lens` Code Graph
Install and register your project with the `lady-lens` MCP tooling:
```bash
# 1. Install lady-lens globally
npm install -g lady-lens

# 2. Register current repository
lens add .

# 3. Register MCP configurations for Claude Code & VS Code
lens install
lens install --skill

# 4. Synchronize graph database
lens sync
```
*Note: In Claude Code, you can also run `/kura` or use the `kura-lens-setup` skill.*

---

### Step 2: Configure the Quiet Test Runner

Noisy test runners (`npm test`, `dotnet test`) easily consume thousands of tokens on passing tests. Kura uses a **Quiet Runner**: full verbose logs go to `outputs/quiet/<kind>.log`, while only test counts and failures are reported to the agent.

#### For Node.js / TypeScript (or when Node is available):
Copy `quiet.mjs` into your project:
```bash
node plugins/kura/skills/kura-dev/templates/quiet.mjs selftest
```
Add to your `package.json`:
```json
{
  "scripts": {
    "test:quiet": "node scripts/quiet.mjs test",
    "test:dotnet": "node scripts/quiet.mjs dotnet",
    "quiet": "node scripts/quiet.mjs run --"
  }
}
```
*Tip: If Node.js is installed on your machine, `node quiet.mjs run -- <any command>` works universally across all languages (including C#, Python, or Go).*

#### For C# .NET (Native Windows / PowerShell without Node):
Use the native PowerShell runner `quiet.ps1`:
```powershell
# Run .NET tests quietly:
.\scripts\quiet.ps1 dotnet

# Or run any command quietly:
.\scripts\quiet.ps1 run dotnet build
```
Or configure your native test commands:
```bash
dotnet test --logger "console;verbosity=minimal"
```

#### For Python:
```bash
pytest -q --tb=short
```

---

### Step 3: Install Guardrail Hooks (`/kura-hooks`)
Run `/kura-hooks` in your agent session. It detects your repository and prompts you to install:
1. **Lens Search Guard**: Prevents agents from doing blind shell greps across large directories.
2. **Blocked Commands**: Blocks noisy unbuffered commands (`npm test` or raw `dotnet test`) and points agents to the quiet runner.
3. **Lens Sync Hook**: Automatically synchronizes the code graph after `write` or `edit` operations.
4. **Session Briefing & Inbox**: Carries user context across sessions without prompt loss.
5. **Git Pre-commit Hook**: Runs quiet verification before commits.

---

### Step 4: Configure Architecture Rules (`/kura-rules`)
Run `/kura-rules` to configure the code quality ratchet:
- Maximum file length & function line count.
- Cyclomatic complexity ceilings.
- Anti-pattern blocks (no else-if ladders, no raw primitive ID obsession in .NET).
- Ports & Adapters integrity (adapters only in the composition root).

---

## 3. Daily Development Commands

Once installed, use these native slash commands in your AI agent:

| Command | Purpose | When to Use |
|---|---|---|
| `/kura-dev <task>` | **Full 4-Agent TDD Workflow** | Building features, fixing bugs, or refactoring with strict Red-Green-Validate role separation. |
| `/kura-plan <feature>` | **Backlog & Seam Planning** | Upfront requirements breakdown, `open-questions.md`, and Ports & Adapters architecture design. |
| `/kura-ponytail <task>` | **Lazy Senior Dev Mode** | Smallest complete diff, zero over-engineering, ruthless YAGNI. |
| `/kura-rules` | **Code Ratchet Setup** | Setting up or checking code quality thresholds. |
| `/kura-hooks` | **Agent Hooks Setup** | Configuring output firewalls, pre-commit checks, and lens sync hooks. |
| `/kura` | **Interactive Hub** | Main menu for selecting and running Kura workflows. |

---

## 4. Verification

Verify that your plugin templates and scripts are functioning correctly:
```bash
npm test
```
This runs the selftests for `rules-check.mjs`, `hooks.mjs`, and `quiet.mjs`.
