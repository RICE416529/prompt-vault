# 一键部署到 GitHub Pages
# 前置：先登录 GitHub CLI（二选一）
#   方式 A：浏览器一次性授权  ->  gh auth login
#   方式 B：用令牌登录        ->  $env:GH_TOKEN="ghp_xxx"; gh auth login --with-token
# 然后在本文件夹下右键「使用 PowerShell 运行」此脚本即可。
$ErrorActionPreference = "Stop"
$repo = "prompt-vault"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "未检测到 gh，请先安装：winget install --id GitHub.cli" -ForegroundColor Yellow
  exit 1
}
if (gh auth status 2>&1 | Select-String -Quiet "You are not logged") {
  Write-Host "请先登录 GitHub（gh auth login），完成后再运行本脚本。" -ForegroundColor Yellow
  exit 1
}

$owner = gh api user --jq .login
Write-Host "已登录为：$owner"

if (-not (gh repo view "$owner/$repo" 2>$null)) {
  gh repo create $repo --public --source . --push --branch main
} else {
  Write-Host "仓库已存在，直接推送…"
  git push -u origin main
}

try {
  gh api -X POST "/repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" | Out-Null
} catch {
  Write-Host "Pages 可能已开启，或请在仓库 Settings > Pages 手动选择 main 分支根目录。" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "部署完成！稍等约 1 分钟生效。" -ForegroundColor Green
Write-Host "分享链接：https://$owner.github.io/$repo/"
