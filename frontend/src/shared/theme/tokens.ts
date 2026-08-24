/**
 * UI トークンの唯一の置き場所。コンポーネントに生の値を直書きしない。
 * docs/frontend-design.md 11.2。テーマはライトのみ（MVP）。
 */

export const colors = {
  background: '#FFFFFF',
  backdrop: '#EDEEF0', // MobileFrame の左右余白（デスクトップ幅で見えるだけ）
  surface: '#F7F7F8',
  border: '#E1E2E5',
  text: '#1A1A1E',
  textMuted: '#6B6D76',
  textInverse: '#FFFFFF',
  primary: '#3654F0',
  primaryPressed: '#2A42C4',
  danger: '#D6412F',
  dangerSurface: '#FBEAE7',
  warningSurface: '#FFF6E5',
  warningText: '#8A5A00',
  success: '#1E8E5A',
  disabled: '#C7C8CE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  // 入力欄はこれ未満にしない: iOS Safari が 16px 未満でフォーカス時に自動ズームする
  // (docs/frontend-design.md 10.5)。
  input: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
} as const;

export const layout = {
  maxContentWidth: 480, // docs/frontend-design.md 11.1
  minTapTarget: 44,
} as const;
