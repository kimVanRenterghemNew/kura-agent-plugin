# setup-lens.ps1: Automated installation and configuration for lady-lens
[CmdletBinding()]
param (
    [string]$RepoPath = (Get-Location).Path,
    [switch]$StartDaemon = $false
)

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Lady-Lens Automated Setup & Verification" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Check or install globally via npm
$lensCmd = Get-Command lens -ErrorAction SilentlyContinue

if (-not $lensCmd) {
    Write-Host "`n[1/4] Installing lady-lens globally via npm..." -ForegroundColor Yellow
    npm install -g lady-lens
    
    # Refresh PATH environment variable for the current PowerShell session
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath,$userPath"
    
    $lensCmd = Get-Command lens -ErrorAction SilentlyContinue
    if (-not $lensCmd) {
        Write-Error "Failed to locate 'lens' after 'npm install -g lady-lens'. Ensure npm global bin is on your PATH."
        exit 1
    }
    Write-Host "✓ lady-lens successfully installed!" -ForegroundColor Green
} else {
    Write-Host "`n[1/4] lady-lens is already installed at: $($lensCmd.Source)" -ForegroundColor Green
}

# Print version
& lens v

# 2. Register repository
Write-Host "`n[2/4] Registering repository in lady-lens: $RepoPath" -ForegroundColor Yellow
try {
    & lens add $RepoPath
    Write-Host "✓ Repository registered!" -ForegroundColor Green
} catch {
    Write-Warning "Repository registration returned: $_"
}

# 3. Connect AI agents & install skill
Write-Host "`n[3/4] Registering MCP server and skill in detected AI agents..." -ForegroundColor Yellow
try {
    # Registers MCP stdio in agents found (VS Code, Claude Code, Gemini/Antigravity, Cursor)
    & lens install
    # Installs the lady-lens workflow skill & policy
    & lens install --skill
    Write-Host "✓ MCP configuration and lady-lens skill installed!" -ForegroundColor Green
} catch {
    Write-Warning "Agent registration returned: $_"
}

# 4. Sync graph & optional daemon
Write-Host "`n[4/4] Synchronizing repository graph..." -ForegroundColor Yellow
try {
    & lens sync
    Write-Host "✓ Repository graph successfully synchronized!" -ForegroundColor Green
} catch {
    Write-Warning "Sync returned: $_"
}

if ($StartDaemon) {
    Write-Host "`n[+] Starting lady-lens background daemon (HTTP MCP on 4318, UI on 4317)..." -ForegroundColor Cyan
    & lens mcp -d
    & lens status
}

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "  Lady-Lens is ready! Use lens list / lens status" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
