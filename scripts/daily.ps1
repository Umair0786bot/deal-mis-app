# Deal MIS daily run without Claude: ingest new exports from Downloads, rebuild, print the update, verify, push.
# Usage (PowerShell, from deal-mis\):  .\scripts\daily.ps1        (add -NoPush to skip git)
param([switch]$NoPush)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PYTHONIOENCODING = 'utf-8'
$today = (Get-Date).ToString('yyyy-MM-dd')
python scripts/update_data.py --today $today
python scripts/bundle.py
node scripts/status.cjs | Tee-Object -FilePath dist/status.txt
node scripts/verify.cjs
if (-not $NoPush) { git add -A; git commit -m "Daily update $today"; git push }
Write-Host "Done. Update text saved to dist\status.txt. The shared artifact is republished with /deal-publish in Claude Code."
