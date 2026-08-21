# 同步网页版最新前端到桌面版，并补上 Electron 防自动更新守卫（幂等，可反复运行）
$ErrorActionPreference = 'Stop'
$src  = 'D:\PromptVault'
$dest = $PSScriptRoot

Copy-Item "$src\index.html"        -Destination "$dest\index.html"        -Force
Copy-Item "$src\pinyin-pro.esm.js" -Destination "$dest\pinyin-pro.esm.js" -Force
Copy-Item "$src\version.txt"       -Destination "$dest\version.txt"       -Force

# 用字面量替换（.Replace 不走正则），给桌面副本补守卫
$html = Get-Content "$dest\index.html" -Raw -Encoding UTF8
if (-not $html.Contains('__ELECTRON_GUARD__')) {
  $old = "(function(){`n  try{"
  $new = "(function(){`n  try{`n    if(navigator.userAgent.indexOf('Electron')>=0) return; // __ELECTRON_GUARD__`n"
  $html = $html.Replace($old, $new)
  Set-Content "$dest\index.html" -Value $html -Encoding UTF8 -NoNewline
  Write-Host '已同步并补上 Electron 守卫'
} else {
  Write-Host '已同步（守卫已存在，跳过）'
}
