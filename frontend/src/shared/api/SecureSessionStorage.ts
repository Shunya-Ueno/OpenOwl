import * as SecureStore from 'expo-secure-store';

/**
 * expo-secure-store は1値あたり約2KBまでという制限がある。
 * Supabase のセッション JSON(JWT を含む)はこれを超えることがあるため、
 * 値をチャンクに分割して保存する(docs/frontend/state-management.md)。
 *
 * supabase-js の `SupportedStorage` インターフェース(getItem/setItem/removeItem)
 * に適合させ、`createClient` の `auth.storage` にそのまま渡せるようにしている。
 */
export class SecureSessionStorage {
  // 2KB 制限に対する安全側の値(キー名やチャンク管理用のオーバーヘッドを見込む)。
  private static readonly CHUNK_SIZE = 1800;
  private static readonly CHUNK_COUNT_SUFFIX = '.__chunks';

  async getItem(key: string): Promise<string | null> {
    const chunkCountRaw = await SecureStore.getItemAsync(this.chunkCountKey(key));

    if (chunkCountRaw === null) {
      // 分割されていない旧形式の値、または未保存。
      return SecureStore.getItemAsync(key);
    }

    const chunkCount = Number.parseInt(chunkCountRaw, 10);
    if (Number.isNaN(chunkCount) || chunkCount <= 0) {
      return null;
    }

    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(this.chunkKey(key, i));
      if (chunk === null) {
        // 一部のチャンクが欠落している。壊れた状態で結合しても意味がないため
        // セッションなしとして扱う(=再ログインを要求する)。
        return null;
      }
      chunks.push(chunk);
    }
    return chunks.join('');
  }

  async setItem(key: string, value: string): Promise<void> {
    // 新しい値を書く前に、古いチャンク(件数が変わりうる)を必ず消しておく。
    // そうしないと、値が短くなった際に末尾の古いチャンクが断片として残る。
    await this.removeItem(key);

    const chunkCount = Math.ceil(value.length / SecureSessionStorage.CHUNK_SIZE) || 1;
    for (let i = 0; i < chunkCount; i++) {
      const start = i * SecureSessionStorage.CHUNK_SIZE;
      const chunk = value.slice(start, start + SecureSessionStorage.CHUNK_SIZE);
      await SecureStore.setItemAsync(this.chunkKey(key, i), chunk);
    }
    await SecureStore.setItemAsync(this.chunkCountKey(key), String(chunkCount));
  }

  async removeItem(key: string): Promise<void> {
    const chunkCountRaw = await SecureStore.getItemAsync(this.chunkCountKey(key));
    const previousCount = chunkCountRaw ? Number.parseInt(chunkCountRaw, 10) : 0;

    for (let i = 0; i < previousCount; i++) {
      await SecureStore.deleteItemAsync(this.chunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(this.chunkCountKey(key));
    // 旧形式(非分割)の値が残っている可能性にも備える。
    await SecureStore.deleteItemAsync(key);
  }

  private chunkKey(key: string, index: number): string {
    return `${key}.${index}`;
  }

  private chunkCountKey(key: string): string {
    return `${key}${SecureSessionStorage.CHUNK_COUNT_SUFFIX}`;
  }
}
