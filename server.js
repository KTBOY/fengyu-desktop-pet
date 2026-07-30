// 临时静态服务器 + /save 保存端点，仅用于浏览器预览抠图效果（打包时已排除）
const http = require('http');
const fs = require('fs');
const path = require('path');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const b64 = body.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync(path.join(__dirname, 'preview.png'), Buffer.from(b64, 'base64'));
        res.writeHead(200); res.end('ok');
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(__dirname, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8123, () => console.log('preview on http://localhost:8123'));
