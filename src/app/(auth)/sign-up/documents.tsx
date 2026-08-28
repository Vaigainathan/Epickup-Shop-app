import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function SignUpDocumentsScreen() {
  const { message } = useLocalSearchParams<{ message?: string }>();
  const routeMessage =
    typeof message === 'string' ? message : Array.isArray(message) ? message[0] : null;

  return <PlaceholderScreen title="Auth / Sign Up / Documents" message={routeMessage} />;
}
