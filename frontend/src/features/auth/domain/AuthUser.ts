/** 認証済みユーザー。Supabase の User オブジェクトから必要な情報だけを取り出した値。 */
export class AuthUser {
  constructor(
    readonly id: string,
    readonly email: string | null,
  ) {}
}
