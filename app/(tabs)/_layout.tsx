import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useAuthStore } from '@/stores/authStore';

export default function TabLayout() {
  const isPremium = useAuthStore((state) => state.user?.is_premium ?? false);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          primaryColor="#D4AF37"
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="planner" />
      <Tabs.Screen name="shopping" />
      <Tabs.Screen
        name="pro"
        options={{
          href: isPremium ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
