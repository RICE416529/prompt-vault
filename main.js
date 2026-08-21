// AI创作资产库 · 桌面版主进程
// 做法：本地起一个最小静态服务器（http://127.0.0.1:固定端口 18745），
// 加载 index.html，从而拿到正常的 http 源，IndexedDB 才能可靠持久化
// （端口必须固定，否则换端口等于换源，旧数据就看不到了）。
const { app, BrowserWindow, dialog, shell, ipcMain, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = __dirname;
let mainWin = null;

// 库根路径持久化在 userData（Electron 用户数据目录），避免每次都重选
function vaultRootConfig(){ return path.join(app.getPath('userData'), 'vault-root.json'); }
function loadVaultRoot(){
  try { const j = JSON.parse(fs.readFileSync(vaultRootConfig(),'utf8')); return j && j.root ? j.root : ''; }
  catch(e){ return ''; }
}
function saveVaultRoot(p){
  try { fs.writeFileSync(vaultRootConfig(), JSON.stringify({ root: p || '' })); } catch(e){}
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2':'font/woff2'
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        if (urlPath === '/') urlPath = '/index.html';
        const filePath = path.join(ROOT, path.normalize(urlPath));
        // 防目录穿越：只允许访问应用目录内的文件
        if (!filePath.startsWith(ROOT)) {
          res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('forbidden');
          return;
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404');
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
          res.end(data);
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('server error');
      }
    });
    // 关键：用固定端口（18745），保证每次启动的源 http://127.0.0.1:18745 一致，
    // 这样 IndexedDB（按源持久化）才不会因随机端口变成新源而"清空"用户数据。
    // 若端口被占用则顺延尝试，最多到 18745+20。
    const tryListen = (port) => {
      server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && port < 18745 + 20) {
          tryListen(port + 1);
        } else {
          reject(err || new Error('无法绑定本地端口'));
        }
      });
      server.listen(port, '127.0.0.1', () => {
        const p = server.address().port;
        console.log('[vault] 本地服务已启动：http://127.0.0.1:' + p + '/');
        resolve('http://127.0.0.1:' + p + '/');
      });
    };
    tryListen(18745);
  });
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0d0614',
    // 用 hidden 标题栏 + 自定义深色 overlay，与应用主体颜色统一
    // （HTML 里再叠一个居中标题 div，系统按钮区在右上）
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d0614',          // 默认皮肤 BC 玻璃霓虹的标题栏底色
      symbolColor: '#ffe9f6',    // 系统按钮（最小化/最大化/关闭）颜色
      height: 32                 // 高度（HTML 标题栏 div 同步这个值）
    },
    title: 'AI创作资产库',
    icon: (() => { const p = path.join(__dirname, 'resources', 'icon.png'); return fs.existsSync(p) ? p : undefined; })(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadURL(url);
  win.webContents.on('console-message', (e, level, message) => { if(level>=2) console.log('[render-error] L'+level+': '+message); });
  // F12 打开/关闭开发者工具，方便排错
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });
  mainWin = win;
  return win;
}

// ===== 应用级 IPC =====
ipcMain.handle('app:setTitleBarOverlay', (e, overlay) => {
  try {
    if (mainWin && mainWin.setTitleBarOverlay) {
      mainWin.setTitleBarOverlay(overlay);
      return { ok: true };
    }
    return { ok: false, error: 'not supported' };
  } catch(err){ return { ok: false, error: String(err) }; }
});

// ===== 粗剪（Rough Cut）相关 IPC =====
function getFFmpegPath(){
  const local = path.join(__dirname, 'resources', 'ffmpeg', 'ffmpeg.exe');
  if (fs.existsSync(local)) return local;
  const sys = 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe';
  if (fs.existsSync(sys)) return sys;
  return 'ffmpeg'; // 回退 PATH
}
function registerRoughcutHandlers(){
  const tmpDir = path.join(app.getPath('userData'), 'roughcut-tmp');
  fs.mkdirSync(tmpDir, { recursive:true });
  function roughOutDir(){
    const root = loadVaultRoot();
    const d = root ? path.join(root, '粗剪输出') : path.join(app.getPath('userData'), 'roughcut-output');
    fs.mkdirSync(d, { recursive:true });
    return d;
  }
  ipcMain.handle('roughcut:ffmpegPath', () => getFFmpegPath());
  ipcMain.handle('roughcut:saveBlob', async (e, payload) => {
    try {
      const name = String((payload && payload.name) || 'clip').replace(/[\\/:*?"<>|\r\n\t]+/g,'_');
      const ext = ((payload && payload.ext) || 'mp4').toString().replace(/[^\w]/g,'');
      const fileName = name + '.' + ext;
      const full = path.join(tmpDir, fileName);
      const data = payload && payload.data;
      let buf;
      if (data instanceof Uint8Array) buf = Buffer.from(data);
      else if (data instanceof ArrayBuffer) buf = Buffer.from(new Uint8Array(data));
      else if (data && Array.isArray(data.data)) buf = Buffer.from(data.data);
      else buf = Buffer.from(data || []);
      fs.writeFileSync(full, buf);
      return { ok:true, path: full, size: buf.length };
    } catch(err){ return { ok:false, error: String(err) }; }
  });
  ipcMain.handle('roughcut:cut', async (e, payload) => {
    try {
      const src = payload && payload.src;
      if (!src || !fs.existsSync(src)) return { ok:false, error:'源文件不存在: '+src };
      const inSec = Number(payload && payload.inSec);
      const outSec = Number(payload && payload.outSec);
      if (!(outSec > inSec)) return { ok:false, error:'出点必须大于入点（in='+inSec+' out='+outSec+'）' };
      const dur = (outSec - inSec).toFixed(3);
      const ff = getFFmpegPath();
      const dir = roughOutDir();
      const base = path.basename(src, path.extname(src));
      const outName = (payload && payload.outName && String(payload.outName).trim())
        ? String(payload.outName).replace(/[\\/:*?"<>|\r\n\t]+/g,'_')
        : (base + '_片段');
      const outPath = path.join(dir, outName + '.mp4');
      let args;
      if (payload && payload.mode === 'precise') {
        args = ['-y', '-i', src, '-ss', String(inSec), '-t', dur, '-c', 'copy', outPath];
      } else {
        args = ['-y', '-ss', String(inSec), '-i', src, '-t', dur, '-c', 'copy', outPath];
      }
      await new Promise((resolve, reject) => {
        execFile(ff, args, { windowsHide:true, maxBuffer: 64*1024*1024 }, (err, stdout, stderr) => {
          if (err) return reject(new Error((err.message||'')+' || '+(stderr||'').slice(-2000)));
          resolve(stdout);
        });
      });
      if (!fs.existsSync(outPath)) return { ok:false, error:'输出文件未生成' };
      return { ok:true, outPath, size: fs.statSync(outPath).size };
    } catch(err){ return { ok:false, error: String((err && err.message) || err) }; }
  });
  ipcMain.handle('roughcut:concat', async (e, payload) => {
    try {
      const segs = payload && payload.segments;
      if (!segs || !segs.length) return { ok:false, error:'没有可拼接的片段' };
      const ff = getFFmpegPath();
      const dir = roughOutDir();
      const listPath = path.join(tmpDir, 'concat_list.txt');
      const lines = segs.map(s => "file '" + String(s).replace(/'/g, "'\\''") + "'");
      fs.writeFileSync(listPath, lines.join('\n'));
      const name = (payload && payload.outName && String(payload.outName).trim())
        ? String(payload.outName).replace(/[\\/:*?"<>|\r\n\t]+/g,'_') : '拼接成片';
      const outPath = path.join(dir, name + '.mp4');
      const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outPath];
      await new Promise((resolve, reject) => {
        execFile(ff, args, { windowsHide:true, maxBuffer: 64*1024*1024 }, (err, stdout, stderr) => {
          if (err) return reject(new Error((err.message||'')+' || '+(stderr||'').slice(-2000)));
          resolve(stdout);
        });
      });
      if (!fs.existsSync(outPath)) return { ok:false, error:'拼接输出未生成' };
      return { ok:true, outPath, size: fs.statSync(outPath).size };
    } catch(err){ return { ok:false, error: String((err && err.message) || err) }; }
  });
  ipcMain.handle('roughcut:openFolder', async (e, p) => {
    const d = p || roughOutDir();
    try { return shell.openPath(d); } catch(err){ return String(err); }
  });
  // 通用 ffmpeg 调用：payload={args:[...不含输出], outName, ext} → 输出落到粗剪输出目录
  ipcMain.handle('roughcut:ffmpeg', async (e, payload) => {
    try {
      const args = (payload && payload.args) || [];
      const outName = (payload && payload.outName && String(payload.outName).trim())
        ? String(payload.outName).replace(/[\\/:*?"<>|\r\n\t]+/g,'_') : ('ffmpeg_'+Date.now());
      const ext = ((payload && payload.ext) || 'mp4').toString().replace(/[^\w]/g,'');
      const outPath = path.join(roughOutDir(), outName + '.' + ext);
      const full = args.concat([outPath]);
      const ff = getFFmpegPath();
      await new Promise((resolve, reject) => {
        execFile(ff, full, { windowsHide:true, maxBuffer: 256*1024*1024 }, (err, stdout, stderr) => {
          if (err) return reject(new Error((err.message||'')+' || '+(stderr||'').slice(-2000)));
          resolve(stdout);
        });
      });
      if (!fs.existsSync(outPath)) return { ok:false, error:'输出文件未生成' };
      return { ok:true, outPath, size: fs.statSync(outPath).size };
    } catch(err){ return { ok:false, error: String((err && err.message) || err) }; }
  });
}

// ===== 文件存储相关 IPC（仅桌面版；库根持久化在 userData） =====
function registerVaultHandlers(){
  ipcMain.handle('vault:pickRoot', async () => {
    const r = await dialog.showOpenDialog({ title:'选择库根目录', properties:['openDirectory','createDirectory'] });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });
  ipcMain.handle('vault:openFolder', async (e, p) => { if (p) return shell.openPath(p); return ''; });
  ipcMain.handle('vault:getRoot', async () => loadVaultRoot());
  ipcMain.handle('vault:setRoot', async (e, p) => { saveVaultRoot(p); return p; });
  ipcMain.handle('vault:ensureDir', async (e, rel) => {
    const root = loadVaultRoot(); if (!root) return false;
    try { fs.mkdirSync(path.join(root, rel || ''), { recursive:true }); return true; } catch(e){ return false; }
  });
  ipcMain.handle('vault:writeFile', async (e, rel, data) => {
    const root = loadVaultRoot(); if (!root) return false;
    try {
      const full = path.join(root, rel || '');
      fs.mkdirSync(path.dirname(full), { recursive:true });
      let buf;
      if (data instanceof Uint8Array) buf = Buffer.from(data);
      else if (data instanceof ArrayBuffer) buf = Buffer.from(new Uint8Array(data));
      else if (data && data.type === 'Buffer' && Array.isArray(data.data)) buf = Buffer.from(data.data);
      else buf = Buffer.from(data);
      fs.writeFileSync(full, buf);
      return true;
    } catch(e){ console.error('vault:writeFile failed', e); return false; }
  });
}

function registerFilemgrHandlers(){
  ipcMain.handle('filemgr:selectFiles', async () => {
    const r = await dialog.showOpenDialog({ title:'选择素材（可多选）', properties:['openFile','multiSelections'], filters:[{name:'视频/音频', extensions:['mp4','mov','webm','mkv','avi','m4v','mts','flv','mp3','wav','m4a','aac','ogg','flac']}] });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return [];
    return r.filePaths.map(p => ({ name: path.basename(p), path: p }));
  });
  ipcMain.handle('filemgr:selectDir', async () => {
    const r = await dialog.showOpenDialog({ title:'选择导出文件夹', properties:['openDirectory','createDirectory'] });
    if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
    return r.filePaths[0];
  });
  ipcMain.handle('filemgr:readBlob', async (e, src) => {
    try { if (!fs.existsSync(src)) return null; const b = fs.readFileSync(src); return Array.from(new Uint8Array(b)); } catch(err){ return null; }
  });
  ipcMain.handle('filemgr:writeBlob', async (e, dst, data) => {
    try { fs.mkdirSync(path.dirname(dst), { recursive:true }); let buf; if (data instanceof Uint8Array) buf=Buffer.from(data); else if (data instanceof ArrayBuffer) buf=Buffer.from(new Uint8Array(data)); else buf=Buffer.from(data); fs.writeFileSync(dst, buf); return true; } catch(err){ return false; }
  });
  ipcMain.handle('filemgr:copy', async (e, src, dst) => {
    try { if (!fs.existsSync(src)) return false; fs.mkdirSync(path.dirname(dst), { recursive:true }); fs.copyFileSync(src, dst); return true; } catch(err){ return false; }
  });
  ipcMain.handle('filemgr:move', async (e, src, dst) => {
    try { if (!fs.existsSync(src)) return false; fs.mkdirSync(path.dirname(dst), { recursive:true }); fs.copyFileSync(src, dst); fs.unlinkSync(src); return true; } catch(err){ return false; }
  });
  ipcMain.handle('filemgr:exists', async (e, p) => { try { return fs.existsSync(p); } catch(_){ return false; } });
}

app.whenReady().then(async () => {
  registerVaultHandlers();
  registerFilemgrHandlers();
  registerRoughcutHandlers();
  installChineseMenu(); // 应用菜单汉化
  const url = await startServer();
  createWindow(url);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== 应用菜单（全部中文化） =====
function installChineseMenu(){
  const isMac = process.platform === 'darwin';
  const openVaultRootItem = {
    label: '打开库根目录',
    click: () => { const r = loadVaultRoot(); if (r) shell.openPath(r); }
  };
  const reloadAndClear = {
    label: '重新加载（清缓存）',
    accelerator: 'CmdOrCtrl+Shift+R',
    click: (item, win) => { if (win) win.webContents.reloadIgnoringCache(); }
  };
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        openVaultRootItem,
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    }] : []),
    {
      label: '文件',
      submenu: [
        { label: '打开库根目录', click: openVaultRootItem.click },
        { label: '在资源管理器中显示输出', click: () => {
            const d = require('path').join(app.getPath('userData'), 'roughcut-output');
            shell.openPath(d);
          }
        },
        { type: 'separator' },
        { label: '保存当前页面（带时间戳）', accelerator: 'CmdOrCtrl+S',
          click: (item, win) => { if (win) win.webContents.executeJavaScript('history.replaceState(null,"",location.pathname+"?_="+Date.now());'); }
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { label: '查找', accelerator: 'CmdOrCtrl+F',
          click: (item, win) => { if (win) win.webContents.executeJavaScript('document.querySelector("input[type=search], input[placeholder*=搜]") && document.querySelector("input[type=search], input[placeholder*=搜]").focus();'); }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        reloadAndClear,
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: '前置所有窗口' }] : [
          { role: 'close', label: '关闭' }
        ])
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '快捷键', click: (item, win) => { if (win) win.webContents.executeJavaScript('alert("常用快捷键：\\nF12 开发者工具\\nCtrl+Shift+R 硬刷新\\nCtrl+S 保存当前页\\nCtrl+F 查找\\nF11 全屏切换")'); } },
        { label: '关于 AI创作资产库', click: (item, win) => { if (win) win.webContents.executeJavaScript('alert("AI创作资产库 · Vault Studio\\n本地 IndexedDB 创作工具\\n版本：桌面版 1.0")'); } }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
