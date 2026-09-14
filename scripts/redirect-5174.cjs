const http = require('http');

const server = http.createServer((req, res) => {
  const targetUrl = `http://localhost:5173${req.url || '/'}`;
  res.writeHead(302, {
    Location: targetUrl,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${targetUrl}"></head><body>Đang chuyển hướng sang <a href="${targetUrl}">${targetUrl}</a>...</body></html>`);
});

server.listen(5174, () => {
  console.log('[Redirect Server] Port 5174 is redirecting to http://localhost:5173/');
});
