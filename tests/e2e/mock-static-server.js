const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = Number(process.env.MOCK_STATIC_PORT || 8080);
const staticRoot = path.resolve(__dirname, '../../src/main/resources/static');
const fixtureRoot = path.resolve(__dirname, '../fixtures');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safeJoin(root, requestPath) {
  const resolved = path.resolve(root, '.' + requestPath);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function resolveFile(urlPath) {
  if (urlPath === '/' || urlPath === '') {
    return path.join(staticRoot, 'index.html');
  }
  if (urlPath === '/transfer-test.html') {
    return path.join(fixtureRoot, 'transfer-test.html');
  }

  const candidate = safeJoin(staticRoot, urlPath);
  if (!candidate) return null;

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const indexFile = path.join(candidate, 'index.html');
    if (fs.existsSync(indexFile)) return indexFile;
  }

  return null;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  const filePath = resolveFile(requestUrl.pathname);

  if (!filePath) {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');

  fs.createReadStream(filePath)
    .on('error', () => {
      res.statusCode = 500;
      res.end('Internal Server Error');
    })
    .pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Mock static server listening at http://${HOST}:${PORT}`);
});
