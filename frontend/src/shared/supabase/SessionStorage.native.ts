// ADR-0013: expo-secure-store は 1 値あたり約 2048 バイトの制限があり、
// Supabase のセッション JSON(access token + refresh token + user)はこれを
// 超えうる。超えると保存が黙って失敗し、「再起動するとログアウトしている」
// という再現しにくい不具合になるため、分割して保存する。
import * as SecureStore from 'expo-secure-store';
import type { SupportedStorage } from '@supabase/supabase-js';

// SecureStore の実測上限(約2048バイト)より十分小さい値にし、
// マルチバイト文字(JSON エスケープ後も含む)による見積もり誤差を吸収する。
const CHUNK_SIZE = 1500;

function chunksCountKey(key: string): string {
  return `${key}.__chunks`;
}

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

async function getItem(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(chunksCountKey(key));
  if (!countRaw) return null;

  const count = Number.parseInt(countRaw, 10);
  if (!Number.isFinite(count) || count <= 0) return null;

  const chunks: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
    if (chunk === null) {
      // 欠損がある = 壊れた状態。中途半端な値を返さず null にする。
      return null;
    }
    chunks.push(chunk);
  }
  return chunks.join('');
}

async function setItem(key: string, value: string): Promise<void> {
  // 既存の(より多い)チャンクが残らないよう、書き込み前に一度削除する。
  await removeItem(key);

  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }

  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
  await SecureStore.setItemAsync(chunksCountKey(key), String(chunks.length));
}

async function removeItem(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(chunksCountKey(key));
  const count = countRaw ? Number.parseInt(countRaw, 10) : 0;

  if (Number.isFinite(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
    );
  }
  await SecureStore.deleteItemAsync(chunksCountKey(key));
}

export const sessionStorage: SupportedStorage = { getItem, setItem, removeItem };
