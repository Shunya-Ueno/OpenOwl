// expo export の出力(dist/)を配信する、依存ゼロの静的サーバー。
//
// なぜ既製のサーバーパッケージを使わないか(docs/testing-ci.md 5.3):
//   - E2E のためだけに依存を増やしたくない
//   - やることが「実在すれば返す / 無ければ index.html」の 2 つしかない
//
// なぜ vercel.json のヘッダやリライトをここで再現しないか:
//   Vercel のルーティング構文を自前で再実装すると本番と乖離する。
//   vercel.json の正しさは実 Vercel のプレビューに対して e2e/preview/ が検証する。

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const ROOT = resolve(process.argv[2] ?? 'dist');
const PORT = Number(process.env.E2E_PORT ?? 4173);
const HOST = '127.0.0.1';

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'],
]);

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(
    `[serve-dist] ${ROOT}/index.html が見つかりません。先に \`npm run build:web\` を実行してください。`,
  );
  process.exit(1);
}

/** dist/ の外へ出るパスを弾く。..%2f のような細工を含めて resolve 後に検査する。 */
function resolveWithinRoot(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const candidate = resolve(join(ROOT, normalize(decoded)));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

async function readIfFile(path) {
  if (!path) return null;
  try {
    return await readFile(path);
  } catch {
    // ディレクトリや存在しないパスはここに来る。SPA フォールバックへ回す。
    return null;
  }
}

const server = createServer(async (request, response) => {
  const urlPath = new URL(request.url ?? '/', `http://${HOST}`).pathname;
  const resolved = resolveWithinRoot(urlPath);

  if (resolved === null) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  const fileBody = urlPath.endsWith('/') ? null : await readIfFile(resolved);

  if (fileBody !== null) {
    const type = CONTENT_TYPES.get(extname(resolved).toLowerCase()) ?? 'application/octet-stream';
    response.writeHead(200, { 'content-type': type }).end(fileBody);
    return;
  }

  // SPA フォールバック。web.output: "single" のため、ルーティングは
  // アプリシェルを読み込んだあとクライアント側で解決される
  // (docs/deployment.md 1.2)。
  const shell = await readIfFile(join(ROOT, 'index.html'));
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(shell);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve-dist] ${ROOT} を http://${HOST}:${PORT} で配信中`);
});
