import { useMutation, useQueryClient } from '@tanstack/react-query';
import { synonymsApi } from '../infrastructure/EdgeFunctionSynonymsApi';
import { queryKeys } from '../../../shared/query/queryKeys';
import type { GenerateSynonymsInput } from '../infrastructure/SynonymsApi';

/**
 * ADR-0012: useQuery ではなく mutation として扱う。自動再取得(フォーカス復帰・
 * 再マウント・再接続)による意図しない課金を避けるため。
 * retry: false は queryClient の既定値(docs/frontend-design.md 5.6)。
 */
export function useGenerateSynonyms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateSynonymsInput) => synonymsApi.generate(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups() });
      // result.term.text(サーバー側で正規化された表示形)をキーにする。
      // 遷移先の /synonyms/[word] も同じ値で useStoredSynonyms を呼ぶため、
      // 画面遷移直後に再フェッチせずこのキャッシュがそのまま使われる。
      queryClient.setQueryData(queryKeys.storedSynonyms(result.term.text), result);
    },
  });
}
