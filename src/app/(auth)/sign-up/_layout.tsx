import { Stack } from 'expo-router';

export default function SignUpLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="set-password" />
      <Stack.Screen name="business-details" />
      <Stack.Screen name="documents" />
      <Stack.Screen name="bank-details" />
    </Stack>
  );
}
