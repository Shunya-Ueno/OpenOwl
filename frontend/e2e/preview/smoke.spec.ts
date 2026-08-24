import { test, expect } from '@playwright/test';
import { testIds } from '../../src/shared/testIds';
import { e2eEnv, isSynonymsFunctionCall } from '../env';

/**
 * Vercel プレビューに対するスモーク(docs/testing-ci.md 7.1)。
 *
 * 見るのは「ローカル配信では見られないもの」だけに絞る:
 * vercel.json のリライトとヘッダ、PWA のファイル配信、そして
 * プレビューがテスト用 Supabase を向いていること。
 *
 * アプリの機能そのものは ci.yml の e2e-web が検証済みなので、ここでは繰り返さない。
 * 生成は一切行わない(デプロイのたびに課金しないため)。
 */
test.describe('プレビューデプロイのスモーク', () => {
  /**
   * 最初に「そもそも OpenOwl のビルドが配信されているか」を見る。
   *
   * Vercel のプロジェクト設定(Root Directory / Build Command / Output Directory)が
   * docs/deployment.md 1.1 と食い違っていると、別のものが 200 で配信される。
   * その状態では下の 6 つが全部それぞれ違う理由で落ち、ログから原因を読み取れない
   * (実際に一度そうなった。docs/testing-ci.md 5.5(c))。
   */
  test('プレビューが OpenOwl のビルドを配信している', async ({ request }) => {
    const response = await request.get('/');
    const html = await response.text();

    const servesOurBundle = html.includes('/_expo/static/');

    expect(
      servesOurBundle,
      'プレビュー URL が expo export の出力を配信していません。' +
        'Vercel のプロジェクト設定を docs/deployment.md 1.1 と照合してください' +
        '(Root Directory=frontend / Build Command=npx expo export --platform web / Output Directory=dist)。' +
        'デプロイ保護が有効な場合も、実体の代わりに保護ページが返るため同じ症状になります。',
    ).toBe(true);
  });

  test('アプリシェルが読み込まれ、サインイン画面が出る', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();
  });

  test('SPA フォールバックが効く(深い URL に直接アクセスできる)', async ({ page }) => {
    // web.output: "single" のため、/history に対応する HTML ファイルは存在しない。
    // vercel.json の rewrites が index.html を返さないと 404 になる
    // (docs/deployment.md 1.3)。
    const response = await page.goto('/history');

    expect(response?.status()).toBe(200);
    // 未認証なので認証ガードでサインインへ送られる = アプリが起動している証拠。
    await expect(page.getByTestId(testIds.signIn.submit)).toBeVisible();
  });

  test('セキュリティヘッダが付与されている', async ({ request }) => {
    // docs/deployment.md 1.3 / docs/security.md 8。
    const response = await request.get('/');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
  });

  test('Service Worker がキャッシュされない設定で配信される', async ({ request }) => {
    // 古い SW が居座らないようにするための設定(docs/deployment.md 1.3)。
    const response = await request.get('/sw.js');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('PWA の manifest が配信される', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');

    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
  });

  test('ハッシュ付きバンドルが長期キャッシュで配信される', async ({ page, request }) => {
    await page.goto('/');

    // 実際に読み込まれたバンドルの URL を拾ってから検証する
    // (ファイル名にハッシュが入るため決め打ちできない)。
    const bundleUrl = await page.evaluate(() =>
      Array.from(document.querySelectorAll('script[src]'))
        .map((element) => element.getAttribute('src') ?? '')
        .find((src) => src.includes('/_expo/static/')),
    );

    expect(bundleUrl, '_expo/static のバンドルが見つからない').toBeTruthy();

    const response = await request.get(bundleUrl as string);
    expect(response.headers()['cache-control']).toContain('immutable');
  });

  test('プレビューはテスト用 Supabase を向いており、実際にサインインできる', async ({ page }) => {
    // 資格情報が未登録でも、上のヘッダ・manifest・SPA フォールバックの検証は有効。
    // このスペックだけを skip して、ジョブ全体を落とさない(docs/testing-ci.md 5.5)。
    test.skip(
      !e2eEnv.hasCredentials,
      'E2E_USER_EMAIL / E2E_USER_PASSWORD が未登録(docs/deployment.md 5.2)',
    );

    // プレビューの環境変数が Production のものになっていたら、ここで気づける
    // (本番プロジェクトに E2E 用アカウントは存在しないため失敗する)。
    let synonymCalls = 0;
    page.on('request', (request) => {
      if (isSynonymsFunctionCall(request.url())) synonymCalls += 1;
    });

    await page.goto('/sign-in');
    await page.getByTestId(testIds.signIn.email).fill(e2eEnv.userEmail);
    await page.getByTestId(testIds.signIn.password).fill(e2eEnv.userPassword);
    await page.getByTestId(testIds.signIn.submit).click();

    await expect(page.getByTestId(testIds.home.title)).toBeVisible();

    // スモークで生成を走らせていないことを、テスト自身でも保証しておく。
    expect(synonymCalls).toBe(0);
  });
});
