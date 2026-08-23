// docs/frontend-design.md 10.1, 10.3。本番ビルドの Web のみで登録する。
// 新しい SW が waiting になったら呼び出し側(RootLayout)にバナー表示を促す。

export interface ServiceWorkerUpdate {
  readonly activateAndReload: () => void;
}

export function registerServiceWorker(onUpdateAvailable: (update: ServiceWorkerUpdate) => void): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

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
                activateAndReload: () => installing.postMessage({ type: 'SKIP_WAITING' }),
              });
            }
          });
        });
      })
      .catch(() => {
        // 登録失敗は致命的ではない(アプリはネットワーク優先で動く)。無視する。
      });

    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      globalThis.location.reload();
    });
  });
}
