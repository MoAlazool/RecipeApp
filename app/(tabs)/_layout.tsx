import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../components/navigation/FloatingTabBar';
import { useAuthStore } from '@/stores/authStore';
import { useProShowcaseStore } from '@/stores/proShowcaseStore';

export default function TabLayout() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isPremium = useAuthStore((state) => state.user?.is_premium ?? false);
  const showProShowcase = useProShowcaseStore((state) => state.showTab);
  const showcaseUserId = useProShowcaseStore((state) => state.userId);
  const shouldShowProTab =
    isPremium && showProShowcase && !!userId && showcaseUserId === userId;

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
          href: shouldShowProTab ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
