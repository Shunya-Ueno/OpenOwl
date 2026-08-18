/**
 * デザイントークン。色・余白・タイポグラフィをここに集約し、
 * コンポーネント側でマジックナンバーの色や余白を直書きしない。
 *
 * MVP はライトテーマのみを対象とする(ダークモード対応は docs/frontend/screens.md
 * に記載がなく、スコープ外)。
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#F6F8FA',
  border: '#E2E5E9',
  textPrimary: '#1A1D21',
  textSecondary: '#5B6470',
  textInverse: '#FFFFFF',
  primary: '#2F6FED',
  primaryPressed: '#2558C4',
  danger: '#D64545',
  dangerSurface: '#FBEAEA',
  warning: '#B7791F',
  warningSurface: '#FFF6E5',
  success: '#1E824C',
  successSurface: '#E9F7EF',
  disabled: '#C7CCD1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
};
