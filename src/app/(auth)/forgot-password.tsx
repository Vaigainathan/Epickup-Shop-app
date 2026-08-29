import { Redirect } from 'expo-router';

import { RESET_INTENT } from '@/lib/auth-intent';

export default function ForgotPasswordScreen() {
  return (
    <Redirect
      href={{
        pathname: '/(auth)/sign-up',
        params: { intent: RESET_INTENT },
      }}
    />
  );
}
