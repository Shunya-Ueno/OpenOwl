// ネイティブでは Service Worker の概念がない。同名モジュールを no-op にすることで
// 呼び出し側はプラットフォームを意識しなくてよい(docs/frontend-design.md 10.1)。
import type { ServiceWorkerUpdate } from './registerServiceWorker.web';

export type { ServiceWorkerUpdate };

export function registerServiceWorker(_onUpdateAvailable: (update: ServiceWorkerUpdate) => void): void {
  // no-op
}
