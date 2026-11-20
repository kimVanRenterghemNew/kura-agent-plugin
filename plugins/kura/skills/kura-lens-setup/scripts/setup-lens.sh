#!/usr/bin/env bash
# setup-lens.sh: Automated installation and configuration for lady-lens (Linux / macOS / POSIX)
set -euo pipefail

REPO_PATH="${1:-$(pwd)}"
START_DAEMON="${2:-false}"

echo "===================================================="
echo "  Lady-Lens Automated Setup & Verification (POSIX)"
echo "===================================================="

# 1. Check or install globally via npm
if ! command -v lens >/dev/null 2>&1; then
    echo -e "\n[1/4] Installing lady-lens globally via npm..."
    npm install -g lady-lens
    
    # Check again
    if ! command -v lens >/dev/null 2>&1; then
        echo "Error: Failed to locate 'lens' after npm install -g. Ensure npm global bin is on PATH." >&2
        exit 1
    fi
    echo "✓ lady-lens successfully installed!"
else
    echo -e "\n[1/4] lady-lens is already installed at: $(command -v lens)"
fi

lens v

# 2. Register repository
echo -e "\n[2/4] Registering repository in lady-lens: $REPO_PATH"
lens add "$REPO_PATH" || echo "Warning: repository registration returned non-zero"
echo "✓ Repository registered!"

# 3. Connect AI agents & install skill
echo -e "\n[3/4] Registering MCP server and skill in detected AI agents..."
lens install || echo "Warning: lens install returned non-zero"
lens install --skill || echo "Warning: lens install --skill returned non-zero"
echo "✓ MCP configuration and lady-lens skill installed!"

# 4. Sync graph & optional daemon
echo -e "\n[4/4] Synchronizing repository graph..."
lens sync || echo "Warning: lens sync returned non-zero"
echo "✓ Graph synchronized!"

if [ "$START_DAEMON" = "true" ] || [ "$START_DAEMON" = "--daemon" ]; then
    echo -e "\nStarting background daemon on http://127.0.0.1:4318/mcp..."
    lens mcp -d
    lens status
fi

echo -e "\nSetup completed successfully!"
