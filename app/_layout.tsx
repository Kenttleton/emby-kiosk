import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { useStore } from '../src/store';
import { Colors } from '../src/theme';
import { checkForUpdate } from '../src/services/updateCheck';

export default function RootLayout() {
  const hydrate       = useStore((s) => s.hydrate);
  const setUpdateInfo = useStore((s) => s.setUpdateInfo);

  useEffect(() => {
    hydrate();
    checkForUpdate().then((info) => setUpdateInfo(info));
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="kiosk" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="connect-login" />
          <Stack.Screen name="search" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
