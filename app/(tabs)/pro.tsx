import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useProShowcaseStore } from '@/stores/proShowcaseStore';
import { revenueCatService } from '@/services/revenueCat.service';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
import { PREMIUM_FEATURES } from '@/utils/types';

const FEATURE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  unlimited_recipes: 'restaurant-outline',
  unlimited_scans: 'scan-outline',
  unlimited_saved: 'bookmark-outline',
  smart_substitutions: 'swap-horizontal-outline',
  nutrition_info: 'nutrition-outline',
  voice_mode: 'mic-outline',
  meal_planner: 'calendar-outline',
  family_sharing: 'people-outline',
  priority_support: 'headset-outline',
};

const QUICK_ACTIONS: Array<{
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}> = [
  {
    id: 'scan',
    label: 'Smart Fridge Scan',
    description: 'Scan your fridge and build recipes instantly.',
    icon: 'scan-outline',
    route: '/fridge-scan',
  },
  {
    id: 'chef',
    label: 'AI Chef Chat',
    description: 'Ask for substitutions and cooking help in seconds.',
    icon: 'sparkles-outline',
    route: '/ai-chef-chat',
  },
  {
    id: 'planner',
    label: 'Weekly Planner',
    description: 'Plan the full week with one tap.',
    icon: 'calendar-outline',
    route: '/(tabs)/planner',
  },
];

export default function ProTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const user = useAuthStore((state) => state.user);
  const showProShowcase = useProShowcaseStore((state) => state.showTab);
  const showcaseUserId = useProShowcaseStore((state) => state.userId);
  const consumeProShowcase = useProShowcaseStore((state) => state.consumeForUser);
  const isPremium = user?.is_premium ?? false;
  const isShowcaseActive =
    isPremium && !!user?.id && showProShowcase && showcaseUserId === user.id;

  const [renewalDate, setRenewalDate] = useState<string | null>(user?.premium_expires_at || null);
  const features = useMemo(() => Object.entries(PREMIUM_FEATURES), []);

  useEffect(() => {
    if (!isShowcaseActive) {
      router.replace('/(tabs)/profile');
      return;
    }

    (async () => {
      try {
        const customerInfo = await revenueCatService.getCustomerInfo();
        if (!customerInfo) return;
        const date = revenueCatService.getExpirationDate(customerInfo);
        if (date) setRenewalDate(date);
      } catch (error) {
        console.warn('Failed to load Pro metadata:', error);
      }
    })();
  }, [isShowcaseActive, router]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (user?.id) {
          consumeProShowcase(user.id);
        }
      };
    }, [consumeProShowcase, user?.id])
  );

  const formatDate = (date?: string | null): string => {
    if (!date) return 'Active';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleAction = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  if (!isShowcaseActive) {
    return null;
  }

  return (
    <TabScreenTransition style={styles.screen}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: bottomTabBarHeight + 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#2A2520', '#1A1510']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#D4AF37" />
            <Text style={styles.heroBadgeText}>PRO UNLOCKED</Text>
          </View>
          <Text style={styles.heroTitle}>Your Pro Hub</Text>
          <Text style={styles.heroSubtitle}>
            All premium tools in one place.
          </Text>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaLabel}>Subscription</Text>
            <Text style={styles.heroMetaValue}>Renews: {formatDate(renewalDate)}</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionLabel}>Try First</Text>
        <View style={styles.actionsWrap}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.actionCard}
              activeOpacity={0.85}
              onPress={() => handleAction(item.route)}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={item.icon} size={18} color="#C66E4E" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{item.label}</Text>
                <Text style={styles.actionDescription}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C8B7B2" />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Everything You Unlocked</Text>
        <View style={styles.featuresGrid}>
          {features.map(([key, label]) => (
            <View key={key} style={styles.featureCard}>
              <Ionicons
                name={FEATURE_ICONS[key] || 'checkmark-circle-outline'}
                size={20}
                color="#D4AF37"
              />
              <Text style={styles.featureText}>{label}</Text>
              <Ionicons name="checkmark-circle" size={16} color="#6B8E23" />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => handleAction('/subscription')}
          activeOpacity={0.85}
        >
          <Ionicons name="settings-outline" size={18} color="#1A1510" />
          <Text style={styles.manageButtonText}>Manage Subscription</Text>
        </TouchableOpacity>
      </ScrollView>
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 20,
  },
  hero: {
    borderRadius: 22,
    padding: 22,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginBottom: 14,
  },
  heroBadgeText: {
    color: '#D4AF37',
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 29,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  heroSubtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  heroMeta: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroMetaLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  heroMetaValue: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
    color: '#B5B0A7',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  actionsWrap: {
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(26,21,16,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(198,110,78,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    color: '#1A1510',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  actionDescription: {
    marginTop: 2,
    color: '#8A8578',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  featuresGrid: {
    gap: 10,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(26,21,16,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  featureText: {
    flex: 1,
    color: '#1A1510',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  manageButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#EFE9E1',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  manageButtonText: {
    color: '#1A1510',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
