import type { ExpoConfig } from 'expo/config';

// 動的設定(app.json ではなく app.config.ts)にしているのは、Google Sign-In の
// iOS URL スキーム(GOOGLE_WEB_CLIENT_ID から機械的に導出できる reversed client id)を
// ビルド時の環境変数から注入する必要があるため。静的な app.json では表現できない。
// (docs/repository-structure.md)

const IOS_BUNDLE_IDENTIFIER = 'com.openowl.app';
const ANDROID_PACKAGE = 'com.openowl.app';

// "123-abc.apps.googleusercontent.com" -> "com.googleusercontent.apps.123-abc"
function toReversedClientId(webClientId: string | undefined): string | undefined {
  if (!webClientId) return undefined;
  const [id] = webClientId.split('.apps.googleusercontent.com');
  if (!id) return undefined;
  return `com.googleusercontent.apps.${id}`;
}

const reversedGoogleClientId = toReversedClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

const plugins: ExpoConfig['plugins'] = [
  'expo-router',
  'expo-secure-store',
  [
    'expo-splash-screen',
    {
      image: './assets/splash-icon.png',
      imageWidth: 200,
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
  ],
];

// Phase 5 のブロッカー: Google Cloud Console での OAuth クライアント発行が未了のうちは
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID が空になる(docs/roadmap.md)。このプラグインは
// 空文字列の iosUrlScheme を渡すと prebuild 時にエラーで落ちるため、
// クライアント ID が判明するまでプラグイン自体を配列に含めない。
if (reversedGoogleClientId) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    { iosUrlScheme: reversedGoogleClientId },
  ]);
}

const config: ExpoConfig = {
  name: 'OpenOwl',
  slug: 'openowl',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'openowl', // backend/supabase/config.toml の additional_redirect_urls と一致させる
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_IDENTIFIER,
    usesAppleSignIn: true, // Sign in with Apple のエンタイトルメントを自動付与
  },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins,
  extra: {
    router: {},
  },
};

export default config;
