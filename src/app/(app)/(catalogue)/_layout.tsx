import { Stack } from 'expo-router';

export default function CatalogueLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="add-product" />
      <Stack.Screen name="product-details" />
    </Stack>
  );
}
