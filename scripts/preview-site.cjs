'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { root, publicFiles, sourceFiles } = require('./site-files.cjs');

function build() {
  const result = spawnSync(process.execPath, ['scripts/build-site-v18.cjs'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'v18 빌드에 실패했습니다.\n');
    return false;
  }
  process.stdout.write(result.stdout);
  return true;
}

if (!build()) process.exit(1);
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};
const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405);
    response.end();
    return;
  }
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!publicFiles.includes(file)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  try {
    const body = fs.readFileSync(path.join(root, 'dist', file));
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    console.error('Preview file could not be read:', error);
    response.writeHead(500);
    response.end('Preview file could not be read.');
  }
});
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT가 올바르지 않습니다.');
server.listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${server.address().port}/`));

let timer;
const watchers = [];
if (process.argv.includes('--watch')) {
  for (const file of sourceFiles()) {
    watchers.push(fs.watch(path.join(root, file), () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (build()) console.log('수정본을 만들었습니다. 브라우저를 새로고침하면 반영됩니다.');
      }, 250);
    }));
  }
}
function stop() {
  clearTimeout(timer);
  for (const watcher of watchers) watcher.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
