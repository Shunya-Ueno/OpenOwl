import { supabase } from '../../../shared/supabase/client';

export interface Profile {
  readonly displayName: string | null;
  readonly nativeLanguage: string;
}

/** docs/api-spec.md 4.3。 */
export class ProfileApi {
  async get(): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, native_language')
      .single();

    if (error) throw error;
    return { displayName: data.display_name, nativeLanguage: data.native_language };
  }

  async updateDisplayName(userId: string, displayName: string | null): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', userId);

    if (error) throw error;
  }
}

export const profileApi = new ProfileApi();
