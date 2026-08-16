# Prompt Vault - deploy / update helper
# Repo already created: https://github.com/RICE416529/prompt-vault
# GitHub Pages already enabled -> https://rice416529.github.io/prompt-vault/
param()
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# 1) (optional) sync latest build from your working copy, e.g.:
#    Copy-Item -Force 'C:\Users\rice\WorkBuddy\20260816154705\index.html' .

# 2) commit & push. GitHub Pages rebuilds automatically from main.
git add -A
$msg = Read-Host "Commit message (Enter = default timestamp)"
if (-not $msg) { $msg = "update $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
git commit -q -m $msg
git push
Write-Host "Pushed to main. GitHub Pages will rebuild shortly."

<#
FIRST-TIME DEPLOY (on a fresh machine) — reference only:
  gh auth login
  gh repo create prompt-vault --public --source . --push -y
  # enable Pages (write body without BOM!)
  '{"source":{"branch":"main","path":"/"},"build_type":"legacy"}' |
     Out-File -Encoding ascii body.json
  gh api -X POST repos/RICE416529/prompt-vault/pages --input body.json
  Remove-Item body.json
#>
