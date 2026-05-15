import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppProvider } from '@/src/context/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="vulnerable-select" options={{ headerShown: false }} />
        <Stack.Screen name="vulnerable-info" options={{ headerShown: false }} />
        <Stack.Screen name="personal-info" options={{ headerShown: false }} />
        <Stack.Screen name="location-setting" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" options={{ headerShown: false }} />
        <Stack.Screen name="qr" options={{ headerShown: false }} />
        <Stack.Screen name="device" options={{ headerShown: false }} />
        <Stack.Screen name="qr-pass" options={{ headerShown: false }} />
        <Stack.Screen name="device-simulator" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="write/index" options={{ headerShown: false }} />
        <Stack.Screen name="write/form" options={{ headerShown: false }} />
        <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
        <Stack.Screen name="my-location" options={{ headerShown: false }} />
        <Stack.Screen name="my-stats" options={{ headerShown: false }} />
        <Stack.Screen name="my-shares" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="contact-admin" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </AppProvider>
  );
}
