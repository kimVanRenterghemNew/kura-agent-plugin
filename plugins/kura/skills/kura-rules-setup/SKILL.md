---
name: kura-rules-setup
description: >-
  Installs the Kura working rules in ANY repository, in any language (C#, Kotlin, Java, TypeScript, Python, Go, ...):
  behaviour rules for agents (test first, honest commits, design patterns over if-ladders, ports and adapters) and strict
  code validations as a ratchet (file and function size, complexity, status branches, else-if chains, layer rules,
  adapters only in the composition root, a contract test per adapter). Asks per rule whether the user wants it and
  generates the config for that repo. Use when setting up Kura rules, "kura rules", code quality gates or architecture checks.
---

# Kura rules setup

Kura and lady-lens keep their code in shape with rules that are **written down** (for agents) and **enforced** (by
tests that fail). This skill brings both to another repo. The enforcement is language-neutral: one checker
(`.kura/rules-check.mjs`, Node 18+) reads the source text of any language and takes function complexity from
[lizard](https://github.com/terryyin/lizard) (C#, Kotlin, Java, JS/TS, Python, Go, Rust, Swift, PHP, Ruby, ...).

Templates: `${CLAUDE_PLUGIN_ROOT}/skills/kura-rules-setup/templates/` (`rules-check.mjs`, `rules.json`).

**The ratchet**: at install the current violations are recorded in `.kura/baseline.json`. From then on a NEW violation
fails, and a FIXED one must be removed from the baseline (`baseline` only lowers or removes entries). So an existing
repo gets the rules today without a big clean-up first, and it can only get better.

**Never overwrite** an existing `AGENTS.md`, `CLAUDE.md`, lint config or analyzer settings: add a marked block.

---

## Step 1: Detect the repo (no questions yet)

| Fact | How |
|---|---|
| Languages and source roots | `git ls-files` → extensions and top folders (`src/`, `app/`, `lib/`, a `*.sln` with projects, Gradle modules) |
| Test files | test projects (`*.Tests.csproj`), `src/test/`, `tests/`, `*.test.ts`, `test_*.py`, `*_test.go` |
| Layers / modules | folder or namespace names: `Domain`, `Application`, `Infrastructure`, `Adapters`, `Ports`, `Api`, `Web`, `Composition`/`Program`/`Startup`/DI module |
| Adapters and their tests | classes/files under `Infrastructure`/`Adapters`, test files named `*Contract*` |
| Check command and hooks | `package.json` `check`, `dotnet test`, `gradle check`, `pytest`, `.githooks/`, husky, CI workflow |
| Python + lizard | `python -m lizard --version`, else propose `pip install lizard` |
| Agent instructions | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |

## Step 2: Ask (AskUserQuestion, multi-select, detected values as the recommended options)

### Question A: which behaviour rules do you want the agents to follow?

| # | Rule (written into AGENTS.md as is) |
|---|---|
| A1 | **Test first**: no bug fix without a failing test first, at the lowest level that shows the bug. |
| A2 | **Test the test**: every check, guard or validation has a case it MUST reject. |
| A3 | **Never weaken a test** (skip, loosen an assert, raise a baseline) without saying so in the commit. |
| A4 | **Honest commit message**: what changes in behaviour (a behaviour change is never "refactor") and what was not verified. |
| A5 | **Behaviour first**: tests describe what the user can do, not how the code does it. |
| A6 | **Build on what exists**: search the repo before writing a helper, tool or abstraction. |
| A7 | **Measure first**: before making something faster, measure, one change per comparison. |
| A8 | **Fast path**: a change that touches only docs needs no test-first step and no checks. |
| A9 | **Scratch stays out of git**: probes in the scratchpad or an ignored `scratch/`. |
| A10 | **Short, factual answers**: say what was verified and what was not. |
| A11 | **Design patterns over if-ladders**: behaviour comes from composition (Strategy / lookup table, State machine, Pipeline / Chain of Responsibility, Decorator, Dispatcher), not from branching on a status. Nesting depth ≤ 2. |
| A12 | **Fail closed**: when no rule matches, return a tagged error (`{ code: "NO_RULE_MATCHED" }` or the language's equivalent), never a silent default. |
| A13 | **No ambient globals in logic**: clock, environment, console/logger, file system and network come in as parameters or constructor dependencies. |
| A14 | **Composition over inheritance**: objects from factories or constructors with collaborators, no deep class hierarchies. |
| A15 | **Ports and adapters**: every port has one shared contract test that runs over every adapter (a real one and an in-memory one), a new adapter only counts when it passes. Adapters are wired in the composition root only. |
| A16 | **A module has one public API**: other modules use only that (an `index` file, a public interface, `internal` for the rest). No dumping-ground folders (`utils`, `helpers`, `common`). |

### Question B: which validations must the code pass? (each one is a ratchet)

| # | Check (`rules.json` key) | What fails | Default |
|---|---|---|---|
| B1 | `fileLines` | a source file over `max` lines | 300 |
| B2 | `complexity` | a function with cyclomatic complexity over `max` (lizard) | 10 |
| B3 | `functionLines` | a function over `max` lines of code (lizard) | 40 |
| B4 | `parameters` | a function with more than `max` parameters (lizard) | 5 |
| B5 | `statusBranches` | more `==`/`switch`/`when` on a status, state, mode, phase or kind per file (A11) | pattern in template |
| B6 | `elseIf` | more `else if` / `elif` per file (dispatch chains → lookup table, A11) | – |
| B7 | `dumpFolders` | a folder named `utils`, `helpers`, `common`, ... (A16) | list in template |
| B8 | `dependencies` | a forbidden import between layers, or an adapter used outside the composition root (A15) | Domain ↛ Infrastructure |
| B9 | `contracts` | an adapter whose name no contract test mentions (A15) | adapters under `Infrastructure/` |
| B10 | `agentsPaths` | `AGENTS.md` names a file that does not exist | – |

Then confirm what you could not detect with certainty, one short question each:
- B2–B4: the norms (stricter is better for new code, the baseline protects old code).
- B8: the layers (`files` = path regex, `imports` = regex on the import / `using` / package name) and the rules
  (`{ from, to }` = from may not use to, `{ to, onlyFrom: [...] }` = only these layers may use to).
- B9: which files are adapters, and how contract tests are named.

## Step 3: Generate

1. **Behaviour rules (A)**: add the chosen rules, verbatim from the table, to `AGENTS.md` between
   `<!-- kura-rules:start -->` and `<!-- kura-rules:end -->`, each with what enforces it (a B check, the pre-commit, or
   "review"). Make `CLAUDE.md` import it (`@AGENTS.md`) when it does not yet.
2. **Validations (B)**, only when at least one is chosen:
   - Copy `templates/rules-check.mjs` to `.kura/rules-check.mjs` unchanged.
   - Copy `templates/rules.json` to `.kura/rules.json`, fill in `source`, `exclude`, `tests`, `roots`, `lizard`
     (`["lizard"]` or `["python", "-m", "lizard"]`), and keep in `checks` only the chosen ones, with the confirmed values.
   - `node .kura/rules-check.mjs baseline` → `.kura/baseline.json` (commit it).
3. **Run it on every change**, in what the repo already has (ask which):
   - the check command (`npm run check`, a `check` task in Gradle, a step in the `dotnet test` CI job),
   - the git pre-commit of `kura-hooks-setup` (hook 8: its check command runs `node .kura/rules-check.mjs check`),
   - CI: one step `node .kura/rules-check.mjs check` (needs Node and `pip install lizard`).
   - Optional: one test in the repo's own framework that runs the checker and asserts exit code 0, so `dotnet test`,
     `gradle test` or `pytest` fails too (xUnit: `Process.Start("node", ".kura/rules-check.mjs check")`).
4. When a lint tool or analyzer is already set up, mention which B checks it could also do (ESLint `complexity`,
   .NET `CA1502`, detekt `CyclomaticComplexMethod`, ruff `C901`), do not change it unasked.

## Step 4: Verify (all must pass before you report done)

```bash
node .kura/rules-check.mjs selftest   # "selftest ok": every check rejects what it is there to catch
node .kura/rules-check.mjs check      # "rules: green" right after the baseline
```

Then show the user per check: on/off, the norm, and how many baseline entries it starts with (the clean-up list).
Tell them: fix a violation → run `node .kura/rules-check.mjs baseline` to lower it, switch on a check later →
`node .kura/rules-check.mjs baseline --add`, never edit the baseline upwards by hand.
