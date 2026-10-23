import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  SchibstedGrotesk_400Regular, SchibstedGrotesk_500Medium, SchibstedGrotesk_600SemiBold, SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ScanProvider } from '@/scan';
import { color } from '@/theme';

export default function RootLayout() {
  const [loaded, failed] = useFonts({
    SchibstedGrotesk_400Regular, SchibstedGrotesk_500Medium, SchibstedGrotesk_600SemiBold, SchibstedGrotesk_700Bold,
    IBMPlexMono_500Medium,
  });
  // Without the fonts the app still works in system type, so a failed load doesn't block it.
  if (!loaded && !failed) return null;

  return (
    <SafeAreaProvider>
      <ScanProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }}>
          <Stack.Screen name="(tabs)" options={{ title: 'EpivaScan' }} />
          <Stack.Screen name="review" options={{ title: 'Check the photo · EpivaScan' }} />
          <Stack.Screen name="result" options={{ title: 'Result · EpivaScan', gestureEnabled: false }} />
          <Stack.Screen name="scan/[id]" options={{ title: 'Saved scan · EpivaScan' }} />
          <Stack.Screen name="how-to-read" options={{ title: 'How to read results · EpivaScan', presentation: 'modal' }} />
        </Stack>
      </ScanProvider>
    </SafeAreaProvider>
  );
}
