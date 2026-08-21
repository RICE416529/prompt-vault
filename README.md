# AI创作资产库 · Vault Studio

Windows 桌面软件，基于 Electron 封装。
本地 IndexedDB 存储所有素材与配置，**不上云**，适合长期积累创作资产。

## 功能概览
- **提示词工作台**：收藏库 / 拼装台 / 图库 / 数据管理
- **资产库**：人物 / 场景 / 色板 / 提示词等「集」+ 集内子资产，支持分类、标签、双语、中英互译
- **导出整理**：导入素材 → 拖拽排序 → 批量重命名 → 一键复制导出到目标文件夹
- **完整备份 / 导入合并**：全库 JSON 导出，按 uid 并集去重导入，适合多台电脑间用 U 盘同步

## 目录结构
| 文件 | 说明 |
|---|---|
| `main.js` | Electron 主进程（本地静态服务器 + 文件管理 IPC） |
| `index.html` | 前端主程序（单文件，含全部 UI 与逻辑） |
| `pinyin-pro.esm.js` | 拼音库（镜号转首字母用） |
| `version.txt` | 版本号 |
| `package.json` | 依赖与打包配置 |
| `resources/` | 图标等资源 |

## 开发模式运行
1. 安装 Node.js（https://nodejs.org，LTS 即可）
2. 在本文件夹打开终端，执行：
   ```
   npm install
   npm start
   ```

## 打包成安装包
```
npm install
npm run dist
```
会在 `dist/` 下生成 `AI创作资产库-Setup-x.x.x.exe`（NSIS 安装包）。
> 打包必须在 Windows 上执行。

## 数据存储
所有数据存在本机 IndexedDB（Electron 用户数据目录），**不上云**。
多台电脑之间同步请用软件内的「📦 完整备份 / 📥 导入合并」功能。
