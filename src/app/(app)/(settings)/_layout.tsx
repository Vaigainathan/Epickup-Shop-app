import { Stack } from 'expo-router';

import { LocationPickerProvider } from '@/lib/location-picker-context';

export default function SettingsLayout() {
  return (
    <LocationPickerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="payment-history" />
        <Stack.Screen name="business-profile" />
        <Stack.Screen
          name="location-picker"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="documents" />
        <Stack.Screen name="bank-details" />
        <Stack.Screen name="account" />
        <Stack.Screen name="deactivate" />
      </Stack>
    </LocationPickerProvider>
  );
}
