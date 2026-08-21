import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function AppTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index" />
      <NativeTabs.Trigger name="explore" />
    </NativeTabs>
  );
}