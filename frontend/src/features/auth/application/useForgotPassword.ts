import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { authGateway } from '../infrastructure/SupabaseAuthGateway';

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      authGateway.resetPasswordForEmail(email, Linking.createURL('auth/callback')),
  });
}
