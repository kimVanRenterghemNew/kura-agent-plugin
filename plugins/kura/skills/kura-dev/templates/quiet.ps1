<#
.SYNOPSIS
    quiet.ps1 - Native PowerShell Quiet Test & Command Runner for Kura Agents (.NET / Polyglot)

.DESCRIPTION
    Runs noisy commands (like `dotnet test`, `dotnet build`) with minimal console output
    to prevent AI agent context window bloat. The full verbose output is redirected to
    `outputs/quiet/<kind>.log`, and only a clean summary is emitted to stdout.

.PARAMETER Kind
    The target command type: 'dotnet', 'run', or 'selftest'.

.PARAMETER TargetArgs
    Additional arguments passed directly to the underlying command.

.EXAMPLE
    .\quiet.ps1 dotnet
    .\quiet.ps1 dotnet --filter "FullyQualifiedName~OrderTests"
    .\quiet.ps1 run dotnet build
#>
[CmdletBinding()]
param (
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet('dotnet', 'run', 'selftest')]
    [string]$Kind,

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$TargetArgs
)

$ErrorActionPreference = "Continue"

if ($Kind -eq "selftest") {
    Write-Host "quiet.ps1: selftest OK" -ForegroundColor Green
    exit 0
}

$cwd = Get-Location
$logDir = Join-Path $cwd "outputs\quiet"

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$logFile = Join-Path $logDir "$Kind.log"

if ($Kind -eq "dotnet") {
    $fullArgs = @("test", "--logger", "console;verbosity=minimal") + $TargetArgs
    & dotnet $fullArgs > $logFile 2>&1
    $exitCode = $LASTEXITCODE

    $content = Get-Content $logFile -ErrorAction SilentlyContinue
    $summaryLine = $content | Where-Object { $_ -match "Passed!\s+-\s+Failed:" -or $_ -match "Failed!\s+-\s+Failed:" -or $_ -match "Total tests:" } | Select-Object -Last 1
    $allFails = $content | Where-Object { $_ -match "^\s*Failed\s+" -or $_ -match "Error Message:" }
    $failLines = $allFails | Select-Object -First 20

    if ($failLines) {
        $failLines | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        if ($allFails.Count -gt 20) {
            Write-Host "... ($($allFails.Count - 20) failure lines omitted to save context, full log: outputs/quiet/$Kind.log)" -ForegroundColor Yellow
        }
    }
    if ($summaryLine) {
        if ($exitCode -eq 0) {
            Write-Host $summaryLine.Trim() -ForegroundColor Green
        } else {
            Write-Host $summaryLine.Trim() -ForegroundColor Red
        }
    } else {
        Write-Host "dotnet test completed (exit $exitCode)"
    }

    Write-Host "exit $exitCode · log: outputs/quiet/$Kind.log"
    exit $exitCode
}

if ($Kind -eq "run") {
    if (-not $TargetArgs -or $TargetArgs.Count -eq 0) {
        Write-Error "Usage: .\quiet.ps1 run <command...>"
        exit 2
    }

    $cmd = $TargetArgs[0]
    $cmdArgs = if ($TargetArgs.Count -gt 1) { $TargetArgs[1..($TargetArgs.Count - 1)] } else { @() }

    & $cmd $cmdArgs > $logFile 2>&1
    $exitCode = $LASTEXITCODE

    $content = Get-Content $logFile -ErrorAction SilentlyContinue
    if ($content) {
        $lastLines = $content | Select-Object -Last 15
        $lastLines | ForEach-Object { Write-Host $_ }
    }

    Write-Host "exit $exitCode · log: outputs/quiet/$Kind.log"
    exit $exitCode
}
