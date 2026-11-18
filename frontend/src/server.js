const fs = require('fs');
const http = require('http');
const path = require('path');

const publicDirectory = path.resolve(__dirname, '..', 'public');
const frontendPort = Number(process.env.FRONTEND_PORT || process.env.PORT) || 5173;
const backend = new URL(process.env.BACKEND_URL || 'http://127.0.0.1:5000');
const backend = new URL(API_TARGET);
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function proxyApi(request, response) {
  const upstream = http.request({
    hostname: backend.hostname,
    port: backend.port || 80,
    method: request.method,
    path: request.url,
    headers: { ...request.headers, host: backend.host },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    response.end(JSON.stringify({
      success: false,
      message: `Backend is unavailable at ${backend.origin}. Start the backend and try again.`,
    }));
  });
  request.pipe(upstream);
}

const server = http.createServer((request, response) => {
  if (request.url === '/api' || request.url.startsWith('/api/')) {
    proxyApi(request, response);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  const requestedPath = path.resolve(publicDirectory, `.${pathname}`);
  if (requestedPath !== publicDirectory && !requestedPath.startsWith(`${publicDirectory}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const filePath = pathname.endsWith('/') ? path.join(requestedPath, 'index.html') : requestedPath;
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(frontendPort, () => {
  console.log(`[frontend] Running at http://localhost:${frontendPort}`);
  console.log(`[frontend] Proxying /api to ${backend.origin}`);
});
