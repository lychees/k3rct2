// 静态文件服务器 + WebSocket 多人房间(同一进程同一端口)。
// 用法: node serve.mjs           (端口环境变量 PORT, 默认 8765)
//        RESET=1 node serve.mjs   (删除联机存档,开新公园)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { WebSocketServer } from 'ws';
import { SimHost } from './server/simhost.js';

const root = path.dirname(url.fileURLToPath(import.meta.url));
const port = process.env.PORT ? Number(process.env.PORT) : 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const saveFile = path.join(root, 'park-save.json');
if (process.env.RESET && fs.existsSync(saveFile)) fs.unlinkSync(saveFile);
const host = new SimHost({ saveFile });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/ws')) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => host.attachWebSocket(ws));
});

server.listen(port, () => console.log(`Serving on http://localhost:${port}  (多人联机: 同一 URL,选"多人联机")`));
