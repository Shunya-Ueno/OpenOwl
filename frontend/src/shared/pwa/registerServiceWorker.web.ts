// docs/frontend-design.md 10.1, 10.3。本番ビルドの Web のみで登録する。
// 新しい SW が waiting になったら呼び出し側(RootLayout)にバナー表示を促す。

export interface ServiceWorkerUpdate {
  readonly activateAndReload: () => void;
}

export function registerServiceWorker(onUpdateAvailable: (update: ServiceWorkerUpdate) => void): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // ユーザーが「更新する」を押した(=SKIP_WAITING を送った)ときだけ true にする。
  // sw.js は初回インストール時にも clients.claim() を呼ぶため、初回訪問でも
  // controllerchange は発火する。このフラグが無いと、初回訪問者が入力中の内容が
  // 消える不要なリロードが毎回発生してしまう。
  let refreshing = false;
  let hasReloaded = false;

  globalThis.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            const hasExistingController = Boolean(navigator.serviceWorker.controller);
            if (installing.state === 'installed' && hasExistingController) {
              onUpdateAvailable({
                activateAndReload: () => {
                  refreshing = true;
                  installing.postMessage({ type: 'SKIP_WAITING' });
                },
              });
            }
          });
        });
      })
      .catch(() => {
        // 登録失敗は致命的ではない(アプリはネットワーク優先で動く)。無視する。
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing || hasReloaded) return;
      hasReloaded = true;
      globalThis.location.reload();
    });
  });
}
