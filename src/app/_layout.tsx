import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LanguageProvider } from '@/context/language-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#111111' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="user/dashboard" />
          <Stack.Screen name="user/create-request" />
          <Stack.Screen name="user/request-detail" />
          <Stack.Screen name="user/reports" />
          <Stack.Screen name="user/profile" />
          <Stack.Screen name="staff/dashboard" />
          <Stack.Screen name="staff/task-detail" />
          <Stack.Screen name="staff/reports" />
          <Stack.Screen name="staff/profile" />
        </Stack>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
