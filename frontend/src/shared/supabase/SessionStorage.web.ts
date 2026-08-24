// Web は supabase-js の既定どおり localStorage を使う。
// XSS 時の奪取リスクは「XSS を作り込まない」方針で担保する
// (docs/security.md 8、docs/frontend-design.md 9)。
import type { SupportedStorage } from '@supabase/supabase-js';

export const sessionStorage: SupportedStorage = {
  getItem: (key: string) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
  setItem: (key: string, value: string) => {
    globalThis.localStorage?.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    globalThis.localStorage?.removeItem(key);
    return Promise.resolve();
  },
};
