import type { PartOfSpeech } from '../domain/Synonym';

const LABELS: Record<PartOfSpeech, string> = {
  noun: '名詞',
  verb: '動詞',
  adjective: '形容詞',
  adverb: '副詞',
  other: 'その他',
};

export function partOfSpeechLabel(value: PartOfSpeech | null): string | null {
  return value ? LABELS[value] : null;
}
