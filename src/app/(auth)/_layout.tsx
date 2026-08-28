import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="splash" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="application-submitted" />
      <Stack.Screen name="resubmit" />
    </Stack>
  );
}
