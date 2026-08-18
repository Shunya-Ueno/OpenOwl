/** 秒数を「あと5分」「あと2時間」のような日本語の目安表示に変換する。 */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return 'あとわずか';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `あと${minutes}分`;
  const hours = Math.ceil(minutes / 60);
  return `あと${hours}時間`;
}
