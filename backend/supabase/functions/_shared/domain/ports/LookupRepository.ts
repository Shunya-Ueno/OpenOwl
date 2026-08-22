export interface LookupRepository {
  /**
   * キャッシュヒット(TTL内・TTL切れの縮退応答の双方)時に履歴を記録する。
   * record_cached_lookup RPC 経由。
   */
  recordCacheHit(userId: string, termId: string, generationId: string): Promise<void>;
}
