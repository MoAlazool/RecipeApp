import { Tabs } from 'expo-router';
import { useTheme } from '@rneui/themed';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          primaryColor={theme.colors.primary}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ai-chef" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="shopping" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
