# AI创作资产库 · 开发接手日志（AI_HANDOFF_LOG）

> 给下一个接手的 AI 看的一手记录。作者：rice（Windows / RTX3070Ti）。
> 本软件原名「AI创作库 / PromptVault」，已改名为 **AI创作资产库 / Vault Studio**。
> 仓库当前地址：`https://github.com/RICE416529/prompt-vault`（待换号重传 / 改名）。

---

## 1. 本次会话完成的改动（2026-08-22）

### A. 导出整理面板（#view-export）改造
1. **顶部 tab 顺序互换**：…资产库 · 数据 · 导出整理 → …资产库 · **导出整理 · 数据**（导出整理提前）。
2. **移除「📂 导入文件（多选）」按钮**（用户认为没必要）。导入方式保留两种：①「从成片库选择」下拉；② 拖文件进面板。
3. **项目下拉旁新增「＋ 新建项目」按钮**：`openExportNewProjectModal()` 弹窗输入名称 → 写入 `projects` 表 → 刷新导出面板项目下拉（自动选中新建项）+ 同步资产库 `populateProjects()`（不依赖资产库当前选中项）。
4. **取消「复制/剪切」选项**：导出固定为 `copy`，工具栏标注「导出方式：复制（源文件保留原位）」；`exportDoExport` 不再读 radio，直接调 `filemgr.copy`，toast 统一「复制成功」。**再也不会因剪切弄丢源素材**。
5. **清空不删源文件**：`ex-clear` 确认弹窗写明「仅移除清单，不删除任何原始文件」。导入到面板也只是读取/复制，从不移动/删除源文件。
6. **Bug 修复**：新建空项目后从「从成片库选择」导入别的项目成片，原本会被项目筛选隐藏（看起来「点选没反应」）。现导入时把素材 `projectId` 设为 `curExProject || a.projectId`（与拖放一致），导入后立即可见。

### B. 标题 / 品牌
- 桌面 README 标题 →「AI创作资产库（桌面版）」。
- `package.json`：`name=prompt-vault-studio`，`productName=「AI创作资产库」`，`description` 更新。
- `main.js`：BrowserWindow `title=「AI创作资产库」`，菜单「关于」文案更新。
- `index.html`：`<title>AI创作资产库</title>`、`brand` 显示「AI创作资产库 Vault Studio」已就位。
- ⚠️ 数据库名仍叫 `promptvault`（`DB_NAME='promptvault'`）——**故意保留**，改名会让旧数据丢失，勿动。

### C. 清理旧网页版残留 + 同步
- `D:\PromptVault`（git 仓库）内删除旧网页版部署脚本：`_rc_check.js` / `serve.bat` / `deploy.ps1`。
- 新增 `.gitignore`（忽略 `node_modules/`、`dist/`、`build.log` 等）。
- 已把桌面版最新源码同步进 `D:\PromptVault`：`index.html` `main.js` `pinyin-pro.esm.js` `version.txt` `package.json` `README.md` `sync.ps1` `resources/`。

---

## 2. 当前关键目录
| 路径 | 说明 |
|---|---|
| `D:\PromptVaultApp\` | **桌面版工作目录**，含 `node_modules`（electron 31.7.7 + electron-builder 24.13.3）。**打包 exe 必须在这里跑**（只有这里装了打包依赖）。 |
| `D:\PromptVault\` | git 仓库（网页+桌面源码），远程 `https://github.com/RICE416529/prompt-vault.git`。**这是要上传的目录**（不含 node_modules/dist）。 |
| `C:\Users\rice\AppData\Roaming\prompt-vault-studio\` | 用户库数据（IndexedDB、blob_storage、roughcut-tmp 等），app 沙盒，非系统文件。 |

---

## 3. 怎么打包成可安装 exe（⚠️ 重点：GitHub 在国内直连超时）

**现象**：electron-builder 打包要下载 electron 二进制 + NSIS，都来自 `github.com`，国内直连 `connectex: ... failed to respond` 超时失败。

**已验证可行的方案（在 `D:\PromptVaultApp` 下）：**

1. 本机**没有独立 node/npm**，用 Electron 内置 Node 跑 electron-builder：
   ```bat
   set ELECTRON_RUN_AS_NODE=1
   D:\PromptVaultApp\node_modules\electron\dist\electron.exe build.cjs
   ```
   > 必须用**程序化 API**（`build.cjs` 里 `require('electron-builder').build(...)`），
   > 不要直接 `electron electron-builder --win nsis`——cli 会再 spawn 一个 node 子进程，环境无 node 会静默失败。

2. **两个镜像环境变量必须设**（已验证 npmmirror 可达，status 200）：
   ```bat
   set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
   set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
   ```

3. **已知坑（务必避开）**：
   - ❌ **不要**在 config 里设 `electronDist` 指向 `node_modules/electron/dist` —— 会触发 `ENOTDIR, not a directory` 拷贝错误。让 electron-builder 自己用 `ELECTRON_MIRROR` 下载 electron 31.7.7 即可。
   - ⏱ 打包耗时 >60s，命令工具超时会被杀导致 `dist` 不生成。用 `Start-Process -NoNewWindow` 后台跑 + 轮询 `build.log`，或在 `build.cjs` 里用 `fs.writeFileSync` 写进度日志（已采用）。
   - 目标 `nsis`（安装包），输出 `D:\PromptVaultApp\dist\AI创作资产库-Setup-x.x.x.exe`。

`build.cjs` 已放在 `D:\PromptVaultApp\build.cjs`（已按上面的镜像方案修正，可直接用）。

---

## 4. 给下一个 AI 的待办清单
1. **打包 exe**：按第 3 节在 `D:\PromptVaultApp` 跑 `build.cjs`，确认 `D:\PromptVaultApp\dist\` 生成 `AI创作资产库-Setup-*.exe`。
2. **上传 GitHub**：
   - 仓库目录 `D:\PromptVault`（已同步最新源码、已加 `.gitignore`、已删旧部署脚本）。
   - `git add -A && git commit -m "AI创作资产库 桌面版 1.0（导出整理改造+中文菜单+NSIS打包）" && git push`。
   - 把 `dist/` 里的 `Setup.exe` 传到 **GitHub Releases**，朋友才能直接下载安装（仓库源码不含 node_modules，double-click 跑不起来）。
   - 在 GitHub 仓库 **Settings** 把仓库名/描述改成「AI创作资产库 / Vault Studio」，与软件名一致。
3. 用户本机库已清空（见第 5 节），打开即空库、可正式使用。

---

## 5. 用户库清空（已完成）
- 用户要求：「把我之前测试用的导入进去的东西都删掉」「我现在的库里面的东西也清空 我就可以正式使用了」。
- 操作：关闭 PromptVaultApp → 删除 `C:\Users\rice\AppData\Roaming\prompt-vault-studio\IndexedDB\` 与 `roughcut-tmp\` → 重新打开即空库。
- 这只是删 app 沙盒数据，**不是**系统/个人文件，安全。

---

## 6. 已知限制 / 架构要点
- 桌面版用**固定端口 18745** 起本地静态服务，IndexedDB 按源（origin）持久化。**切勿改端口**，否则旧数据"消失"（看起来像清空）。
- 网页版（GitHub Pages）与桌面版共用同一套 `index.html`；网页版**无 `window.filemgr`**，导出整理的「真实文件导出」只在桌面版可用，网页版仅预览/排序。
- 资产库结构、提示词资产去重合并、中英互译、皮肤切换等详见 `index.html` 内注释；长期约定见 `MEMORY.md`。
- 本地副本两份要保持一致：`D:\PromptVault`（仓库）↔ `D:\PromptVaultApp`（桌面工作目录，含 node_modules）。改完前端后两处都要更新。
