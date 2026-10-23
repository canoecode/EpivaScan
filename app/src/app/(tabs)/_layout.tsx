import { Tabs } from 'expo-router';

import { color, font } from '@/theme';
import { Icon, useWide, type IconName } from '@/ui';

const TAB = (name: IconName) => ({ color: tint }: { color: unknown; focused: boolean }) => <Icon name={name} tint={String(tint)} size={24} />;

/* Phone: a bottom tab bar. Desktop browser: no bar; Page draws the same four places as a header nav. */
export default function TabsLayout() {
  const wide = useWide();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.signal,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        tabBarStyle: wide ? { display: 'none' } : { backgroundColor: color.panel, borderTopColor: color.line },
        sceneStyle: { backgroundColor: color.ground },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Scan', tabBarIcon: TAB('scan') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: TAB('history') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: TAB('learn') }} />
      <Tabs.Screen name="about" options={{ title: 'About', tabBarIcon: TAB('about') }} />
    </Tabs>
  );
}
