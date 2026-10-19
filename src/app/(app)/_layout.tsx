import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type ColorValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShopPushProvider } from '@/components/ShopPushProvider';
import { colors, spacing, typography } from '@/constants/theme';

const TAB_BAR_CONTENT_HEIGHT = 64;
const TAB_ICON_SIZE = 26;
const TAB_LABEL_SIZE = 13;
const TAB_PADDING_TOP = spacing.sm;

function TabIcon({
  name,
  color,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  color: ColorValue;
}) {
  return (
    <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={name} color={color} size={TAB_ICON_SIZE} />
    </View>
  );
}

export default function AppTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;

  return (
    <ShopPushProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
            paddingTop: TAB_PADDING_TOP,
            paddingBottom: bottomInset + spacing.sm,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          tabBarItemStyle: {
            minHeight: 48,
            paddingVertical: 0,
          },
          tabBarLabelStyle: {
            fontSize: TAB_LABEL_SIZE,
            lineHeight: 16,
            fontFamily: typography.fonts.semibold,
            marginTop: 2,
            marginBottom: 0,
            includeFontPadding: false,
          },
        }}>
        <Tabs.Screen
          name="(dashboard)"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => (
              <TabIcon name="view-dashboard-outline" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="(catalogue)"
          options={{
            title: 'Catalogue',
            tabBarIcon: ({ color }) => <TabIcon name="store-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="(orders)"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color }) => (
              <TabIcon name="format-list-bulleted" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="(settings)"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <TabIcon name="cog-outline" color={color} />,
          }}
        />
        <Tabs.Screen name="(refunds)" options={{ href: null }} />
      </Tabs>
    </ShopPushProvider>
  );
}
