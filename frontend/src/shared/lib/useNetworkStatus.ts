import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * NetInfo を TanStack Query の onlineManager に接続する。
 * アプリ起動時に一度だけ呼び出す(app/_layout.tsx)。
 * オフライン中に useQuery/useMutation の無駄な自動リトライが起きるのを防ぐ。
 *
 * `setEventListener` 自体は購読解除関数を返さない(onlineManager が内部で
 * setup 関数のライフサイクルを管理するため)。渡した setup 関数が返す
 * NetInfo の購読解除は onlineManager 側が責任を持つ。
 */
export function setupNetworkStatusListener(): void {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  });
}

/** オフラインバナーの表示などに使う、画面側の接続状態フック。 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  }, []);

  return { isOnline };
}
