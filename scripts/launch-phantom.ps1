Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if (Test-Path $dockerBin) {
  $env:PATH = "$env:PATH;$dockerBin"
}

$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  [System.Windows.Forms.MessageBox]::Show(
    "Missing .env file at $envPath",
    "Phantom Launcher"
  ) | Out-Null
  exit 1
}

$envText = Get-Content $envPath -Raw
$anthropicMatch = [regex]::Match($envText, '(?m)^ANTHROPIC_API_KEY=(.*)$')
$anthropicKey = if ($anthropicMatch.Success) { $anthropicMatch.Groups[1].Value.Trim() } else { "" }

if ([string]::IsNullOrWhiteSpace($anthropicKey)) {
  Start-Process notepad.exe $envPath
  [System.Windows.Forms.MessageBox]::Show(
    "ANTHROPIC_API_KEY is not set in .env.`n`nAdd it, save the file, then launch Phantom again.",
    "Phantom Launcher"
  ) | Out-Null
  exit 1
}

Write-Host "[phantom] Starting Docker services..."
docker compose up -d | Out-Host

$healthUrl = "http://localhost:3100/health"
$uiUrl = "http://localhost:3100/ui/auto-login"
$deadline = (Get-Date).AddMinutes(3)
$ready = $false

while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 3
  }
}

if (-not $ready) {
  [System.Windows.Forms.MessageBox]::Show(
    "Phantom did not become healthy within 3 minutes.`n`nCheck docker logs phantom",
    "Phantom Launcher"
  ) | Out-Null
  exit 1
}

Start-Process $uiUrl
