import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/lib/useAuth';
import { queryKeys } from '@/shared/lib/queryKeys';
import { synonymApiClient } from '../api/SynonymApiClient';

/**
 * 類義語生成は useQuery ではなく useMutation にする(重要な設計判断)。
 *
 * useQuery は画面復帰・再マウント・フォーカス復帰で自動的に再フェッチする。
 * このエンドポイントは呼ぶたびに search_history へ課金対象になりうる行を書くため、
 * 「勝手に再実行される」性質と根本的に相性が悪い。ユーザーの明示的な操作でのみ
 * 発火する useMutation が正しい(docs/frontend/state-management.md)。
 */
export function useGenerateSynonyms() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (word: string) => synonymApiClient.generate(word),
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: queryKeys.searchHistory(user.id) });
      }
    },
  });
}
