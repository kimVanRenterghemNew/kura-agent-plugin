#!/usr/bin/env node
/**
 * quiet.mjs - Polyglot Quiet Command & Test Runner for Kura Agents
 *
 * Why this exists:
 * AI coding agents easily overflow their context windows and waste budget when running
 * noisy test suites, builds, or linters.
 *
 * quiet.mjs runs noisy commands quietly:
 * - Full output is always written to disk: outputs/quiet/<kind>.log
 * - Terminal gets a short, high-signal summary (totals, only failed tests/errors)
 * - Returns the exact exit code of the executed command.
 *
 * Usage:
 *   node quiet.mjs test              # Node tests (Vitest / Jest / node:test)
 *   node quiet.mjs dotnet [args...]  # .NET tests (dotnet test)
 *   node quiet.mjs pytest [args...]  # Python tests (pytest)
 *   node quiet.mjs lint              # ESLint / linter
 *   node quiet.mjs run -- <cmd...>   # Any command quietly (e.g. dotnet build)
 *   node quiet.mjs selftest          # Built-in verification
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const MAX_LINES = 25;

export const clean = (output) => String(output ?? '').replace(/\u001b\[[0-9;]*m/g, '').split(/\r?\n/);

/** Vitest / Jest: totals + each FAIL with its error. */
export function summarizeNodeTest(output) {
    const lines = clean(output);
    const totals = lines.filter(line => /^\s*(?:Test Files|Tests|Suites)\s{2}/i.test(line)).map(line => line.trim());
    const fails = [...new Set(lines.flatMap((line, at) => {
        const failed = line.match(/^\s*FAIL\s+(.+)$/i);
        if (!failed) return [];
        const error = lines.slice(at + 1, at + 30).find(next => /^\s*\w*Error\b/.test(next));
        return [`FAIL ${failed[1].trim()}${error ? `\n     ${error.trim()}` : ''}`];
    }))];
    const ok = totals.length > 0 && !totals.some(line => /\bfailed\b/i.test(line)) && fails.length === 0;
    return { ok, lines: fails.length ? [...fails, ...totals] : totals };
}

/** .NET: dotnet test summary and failed test cases. */
export function summarizeDotnetTest(output) {
    const lines = clean(output);
    const summaryLine = lines.find(line => /Passed!\s+-\s+Failed:/i.test(line) || /Failed!\s+-\s+Failed:/i.test(line) || /Total tests:/i.test(line));
    const fails = lines.filter(line => /^\s*Failed\s+\S+/i.test(line) || /Error Message:/i.test(line)).slice(0, MAX_LINES);
    const hasFail = lines.some(line => /Failed!\s+-/i.test(line) || /Failed:\s+[1-9]/i.test(line));
    return {
        ok: !hasFail && Boolean(summaryLine),
        lines: fails.length ? [...fails, summaryLine ?? 'Tests completed with failures'] : (summaryLine ? [summaryLine.trim()] : ['dotnet test completed'])
    };
}

/** ESLint / standard linter. */
export function summarizeLint(output) {
    const lines = clean(output);
    const problems = lines.filter(line => /^\s+\d+:\d+\s+(error|warning)\b/i.test(line));
    const count = lines.find(line => /\d+ problems? \(/i.test(line))?.trim();
    const ok = !problems.some(line => /\berror\b/i.test(line));
    return {
        ok,
        lines: problems.length ? [...problems.slice(0, MAX_LINES), count ?? `${problems.length} problems`] : [count ?? 'lint: clean']
    };
}

/** Generic tail: last 15 lines of any command. */
export function summarizeTail(output) {
    const lines = clean(output).filter(line => line.trim());
    return { ok: true, lines: lines.slice(-15) };
}

/** Command definitions per kind. */
export const KINDS = Object.freeze({
    test: {
        command: (args) => {
            const hasVitest = fs.existsSync(path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vitest.cmd' : 'vitest'));
            const binary = hasVitest ? (process.platform === 'win32' ? 'npx.cmd' : 'npx') : 'npm';
            const cmdArgs = hasVitest ? ['vitest', 'run', ...args] : ['test', '--', ...args];
            return [binary, ...cmdArgs];
        },
        summarize: summarizeNodeTest,
        shell: true
    },
    dotnet: {
        command: (args) => ['dotnet', 'test', '--logger', 'console;verbosity=minimal', ...args],
        summarize: summarizeDotnetTest,
        shell: true
    },
    pytest: {
        command: (args) => ['pytest', '-q', '--tb=short', ...args],
        summarize: summarizeTail,
        shell: true
    },
    lint: {
        command: (args) => ['npm', 'run', 'lint', ...args],
        summarize: summarizeLint,
        shell: true
    },
    run: {
        command: (args) => args,
        summarize: summarizeTail,
        shell: true
    }
});

/**
 * Execute a command quietly.
 * Writes stdout/stderr to outputs/quiet/<kind>.log and returns structured summary.
 */
export function runQuiet(kindName, args = [], options = {}) {
    const kind = KINDS[kindName];
    if (!kind) throw new Error(`Unknown kind: ${kindName}`);
    const [command, ...cmdArgs] = kind.command(args);
    const cwd = options.cwd ?? ROOT;
    const logDir = path.join(cwd, 'outputs', 'quiet');
    fs.mkdirSync(logDir, { recursive: true });
    const log = path.join(logDir, `${kindName}.log`);

    const fd = fs.openSync(log, 'w');
    const run = spawnSync(command, cmdArgs, {
        cwd,
        windowsHide: true,
        stdio: ['ignore', fd, fd],
        shell: Boolean(kind.shell)
    });
    fs.closeSync(fd);

    const rawOutput = fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
    const summary = kind.summarize(rawOutput);
    const ok = run.status === 0 && summary.ok;

    // Hard output cap: never dump more than MAX_LINES into agent context
    const lines = summary.lines.length > MAX_LINES
        ? [...summary.lines.slice(0, MAX_LINES), `... (${summary.lines.length - MAX_LINES} lines omitted to save context, full log: ${path.relative(cwd, log).replace(/\\/g, '/')})`]
        : summary.lines;

    return {
        ok,
        lines,
        status: run.status ?? 1,
        log: path.relative(cwd, log).replace(/\\/g, '/')
    };
}

/** Built-in selftest for test assertions. */
export function selftest() {
    const sampleVitestPass = `
 ✓ test/unit.test.js (2)
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  120ms
`;
    const vitestRes = summarizeNodeTest(sampleVitestPass);
    if (!vitestRes.ok || !vitestRes.lines.some(l => l.includes('2 passed'))) {
        throw new Error('selftest: summarizeNodeTest pass failed');
    }

    const sampleDotnetPass = `
Passed!  - Failed:     0, Passed:    12, Skipped:     0, Total:    12, Duration: 420 ms - App.Tests.dll (net8.0)
`;
    const dotnetRes = summarizeDotnetTest(sampleDotnetPass);
    if (!dotnetRes.ok || !dotnetRes.lines[0].includes('Passed:    12')) {
        throw new Error('selftest: summarizeDotnetTest pass failed');
    }

    const sampleDotnetFail = `
Failed!  - Failed:     1, Passed:    11, Skipped:     0, Total:    12, Duration: 510 ms - App.Tests.dll (net8.0)
Failed OrderTests.CalculateTotal_ShouldThrow_WhenEmpty
Error Message: Expected InvalidOperationException but none was thrown.
`;
    const dotnetFailRes = summarizeDotnetTest(sampleDotnetFail);
    if (dotnetFailRes.ok || !dotnetFailRes.lines.some(l => l.includes('CalculateTotal_ShouldThrow_WhenEmpty'))) {
        throw new Error('selftest: summarizeDotnetTest fail detection failed');
    }

    return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [kindName, ...args] = process.argv.slice(2);
    if (kindName === 'selftest') {
        selftest();
        console.log('quiet.mjs: selftest OK');
        process.exit(0);
    }
    if (!kindName || !Object.hasOwn(KINDS, kindName)) {
        console.error(`Usage: node quiet.mjs <test|dotnet|pytest|lint|run|selftest> [args...]`);
        process.exit(2);
    }
    if (kindName === 'run' && !args.length) {
        console.error('Usage: node quiet.mjs run -- <command...>');
        process.exit(2);
    }

    const result = runQuiet(kindName, args);
    for (const line of result.lines) {
        console.log(line);
    }
    console.log(`exit ${result.status} · log: ${result.log}`);
    process.exit(result.ok ? 0 : 1);
}
