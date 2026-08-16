# 提示词拼装台 (Prompt Vault)

一个**单文件、零后端**的提示词收藏 / 拆解 / 拼装小工具。数据全部存在你浏览器本地（IndexedDB），不上传任何服务器。

## 功能一览
- 收藏提示词（可附图片 / 视频），自动中英互译
- 把长提示词拆成可复用的「区块」并分类，区块可溯源到原始收藏
- 拼装台按分类智能排序，一键拼出「正向 / 负向」提示词，支持悬停定位高亮
- 分类与标签都能自己增 / 删 / 改名（⚙ 分类/标签）
- 图库（审美参考）、数据导入导出 JSON 备份

## 本地运行（必须走 http，不能直接双击打开）
浏览器在 `file://` 协议下会禁用 IndexedDB，数据库建不起来、功能失效。
请在该文件夹下启动一个本地静态服务，再用 http 访问：

    python -m http.server 8123

然后浏览器打开 http://localhost:8123/index.html

> Windows 用户也可直接双击 `serve.bat` 一键启动并打开页面。

## 分享给朋友
本工具已部署到 GitHub Pages，朋友直接打开下面的链接即可使用：

**https://rice416529.github.io/prompt-vault/**

注意：每人数据存在各自浏览器里，互不可见；要共享同一份数据需另接后端（当前未做）。
翻译功能走公共接口（Google gtx / MyMemory），需联网，无密钥、免费但有速率限制。

## 更新线上版本
代码在 `main` 分支，GitHub Pages 会从 `main` 根目录自动重建。改完 `index.html` 后：

    git add -A
    git commit -m "你的说明"
    git push

或在该文件夹下双击 `deploy.ps1`（会提示输入提交说明并自动推送）。
注意：GitHub Pages 重建通常需要 30~60 秒，硬刷新（Ctrl+Shift+R）避开浏览器缓存即可看到新版。
