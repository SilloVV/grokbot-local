# Windows one-click installer for Vrac.
# Double-click install.bat at the repo root (this file is invoked from there).
# Installs Node/Git/Ollama via winget if missing. Does NOT install Docker, Visual Studio, or Rust.

$ErrorActionPreference = "Continue"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $RepoRoot

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot ".env.example"))) {
    Write-Fail @"
This does not look like the Vrac repo (missing .env.example in $RepoRoot).
Clone https://github.com/SilloVV/Vrac.git and double-click install.bat from the repo root.
"@
}


function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if ($machine -and $user) {
        $env:Path = "$machine;$user"
    } elseif ($machine) {
        $env:Path = $machine
    } elseif ($user) {
        $env:Path = $user
    }
}

function Test-Cmd {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Install-Winget {
    param(
        [string]$Id,
        [string]$Label
    )
    if (-not (Test-Cmd "winget")) {
        Write-Fail "$Label is missing and winget is not available. Install $Label manually, then re-run install.bat."
    }
    Write-Step "Installing $Label via winget ($Id)"
    & winget install -e --id $Id --accept-package-agreements --accept-source-agreements
    $code = $LASTEXITCODE
    # 0 = success; -1978335189 (0x8A15002B) = already installed
    if ($code -ne 0 -and $code -ne -1978335189) {
        Write-Warn "winget install $Id exited $code"
    }
    Refresh-Path
}

function Get-NodeMajor {
    if (-not (Test-Cmd "node")) { return 0 }
    $raw = (& node -v 2>$null)
    if (-not $raw) { return 0 }
    if ($raw -match "v?(\d+)") { return [int]$Matches[1] }
    return 0
}


# --- Node.js 20+ ---
$nodeMajor = Get-NodeMajor
if ($nodeMajor -lt 20) {
    if ($nodeMajor -gt 0) {
        Write-Warn "Node v$nodeMajor found; need 20+. Installing Node.js LTS."
    }
    Install-Winget -Id "OpenJS.NodeJS.LTS" -Label "Node.js LTS"
    $nodeMajor = Get-NodeMajor
    if ($nodeMajor -lt 20) {
        Write-Fail "Node.js 20+ is required. Install it from https://nodejs.org then re-run install.bat in a new terminal."
    }
}
Write-Host "Node $(node -v)"

# --- Git ---
if (-not (Test-Cmd "git")) {
    Install-Winget -Id "Git.Git" -Label "Git"
    if (-not (Test-Cmd "git")) {
        Write-Fail "Git is not on PATH after install. Close this window, open a new terminal, and re-run install.bat."
    }
}
Write-Host "Git $(git --version)"

# --- Ollama ---
$ollamaExe = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
if (-not (Test-Cmd "ollama") -and -not (Test-Path -LiteralPath $ollamaExe)) {
    Install-Winget -Id "Ollama.Ollama" -Label "Ollama"
    Refresh-Path
}
if (-not (Test-Cmd "ollama") -and -not (Test-Path -LiteralPath $ollamaExe)) {
    Write-Warn "Ollama is not on PATH. Test models will be skipped. Install from https://ollama.com, start it, then: node scripts/pull-models.mjs"
} else {
    Write-Host "Ollama found"
}


# Optional heavy tools: print next steps, do not install.
if (-not (Test-Cmd "docker")) {
    Write-Host ""
    Write-Host "Docker is not installed. Chat still works without it." -ForegroundColor DarkYellow
    Write-Host "  For the per-persona sandbox/VM later, install Docker Desktop:"
    Write-Host "  https://www.docker.com/products/docker-desktop/"
}
if (-not (Test-Cmd "rustc") -and -not (Test-Cmd "cargo")) {
    Write-Host ""
    Write-Host "Rust is not on PATH. The Tauri desktop will be skipped." -ForegroundColor DarkYellow
    Write-Host "  Later: get Rust from https://rustup.rs then run:"
    Write-Host "    pnpm --filter @grokbot/desktop dev"
    Write-Host "  On Windows, Tauri also needs WebView2 and MSVC C++ tools:"
    Write-Host "    https://v2.tauri.app/start/prerequisites/"
}

Write-Step "Enabling pnpm via corepack"
& corepack enable
if ($LASTEXITCODE -ne 0) {
    Write-Fail "corepack enable failed. Is Node.js 20+ installed and on PATH?"
}
& corepack prepare pnpm@9 --activate
if ($LASTEXITCODE -ne 0) {
    Write-Fail "corepack prepare pnpm@9 --activate failed."
}

Write-Step "Writing .env if needed"
& node scripts/setup.mjs
if ($LASTEXITCODE -ne 0) { Write-Fail "scripts/setup.mjs failed." }

Write-Step "Installing workspace packages (pnpm install)"
& pnpm install
if ($LASTEXITCODE -ne 0) { Write-Fail "pnpm install failed." }

Write-Step "Pulling test models (qwen2.5:0.5b + qwen3.5:4b — not 27B)"
& node scripts/pull-models.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Could not pull models (is Ollama running?). The API will still start."
    Write-Warn "Later: start Ollama, then run: node scripts/pull-models.mjs"
}

Write-Step "Starting Vrac"
& node scripts/start.mjs
if ($LASTEXITCODE -ne 0) { Write-Fail "start failed." }
