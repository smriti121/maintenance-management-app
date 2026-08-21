import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FAF9FE' },
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
    </>
  );
}
