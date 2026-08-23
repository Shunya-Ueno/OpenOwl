// docs/frontend-design.md 10: web.output は "single"(SPA)のため、
// Expo Router の app/+html.tsx は効かない(per-route の静的生成でしか使われない)。
// 代わりに実行時に <head> へ PWA 用タグを差し込む。冪等にする
// (Fast Refresh / 再マウントで重複挿入しない)。

function ensureMeta(name: string, content: string): void {
  if (document.querySelector(`meta[name="${name}"]`)) return;
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.appendChild(meta);
}

function ensureLink(rel: string, href: string): void {
  if (document.querySelector(`link[rel="${rel}"]`)) return;
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

export function injectHeadTags(): void {
  if (typeof document === 'undefined') return;

  ensureMeta('theme-color', '#3654F0');
  ensureMeta('mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'default');
  ensureLink('manifest', '/manifest.webmanifest');
  ensureLink('apple-touch-icon', '/icons/icon-192.png');
}
