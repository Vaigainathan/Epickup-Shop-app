import { Stack } from 'expo-router';

import { LocationPickerProvider } from '@/lib/location-picker-context';

export default function SignUpLayout() {
  return (
    <LocationPickerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="set-password" />
        <Stack.Screen name="business-details" />
        <Stack.Screen
          name="location-picker"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="documents" />
        <Stack.Screen name="bank-details" />
      </Stack>
    </LocationPickerProvider>
  );
}
