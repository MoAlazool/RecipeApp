import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useUsageStore } from '@/stores/usageStore';
import { revenueCatService } from '@/services/revenueCat.service';
import { FREE_PLAN_LIMITS, PREMIUM_FEATURES } from '@/utils/types';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  ivory: '#FAFAF8',
  white: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  goldLight: '#F5E6B8',
  terracotta: '#C66E4E',
  olive: '#6B8E23',
  muted: '#8A8578',
  light: '#B5B0A7',
  hairline: 'rgba(26, 21, 16, 0.06)',
  cardBg: '#FFFFFF',
  darkCard: '#1E1B16',
};

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

interface SubscriptionDetails {
  planType: string | null;
  expiryDate: string | null;
  isActive: boolean;
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();
  const isPremium = user?.is_premium ?? false;

  const scansUsed = useUsageStore((s) => s.scansUsed);
  const recipesUsed = useUsageStore((s) => s.recipesUsed);
  const chatsUsed = useUsageStore((s) => s.chatsUsed);
  const daysUntilReset = useUsageStore((s) => s.getDaysUntilReset());

  const [isLoading, setIsLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [subDetails, setSubDetails] = useState<SubscriptionDetails>({
    planType: null,
    expiryDate: null,
    isActive: false,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      await useUsageStore.getState().syncFromFirebase();

      if (isPremium) {
        const customerInfo = await revenueCatService.getCustomerInfo();
        if (customerInfo) {
          const expiry = revenueCatService.getExpirationDate(customerInfo);
          const hasPremiumEntitlement = revenueCatService.hasPremiumEntitlement(customerInfo);
          const activeSub = Object.values(customerInfo.entitlements.active || {})[0];
          const productId = activeSub?.productIdentifier ?? '';
          const isYearly = productId.toLowerCase().includes('yearly') || productId.toLowerCase().includes('annual');

          setSubDetails({
            planType: isYearly ? 'Yearly' : 'Monthly',
            expiryDate: expiry,
            isActive: hasPremiumEntitlement,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isPremium]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleManageSubscription = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/paywall');
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRestoring(true);
    try {
      const restored = await revenueCatService.restorePurchases();
      if (restored) {
        const customerInfo = await revenueCatService.getCustomerInfo();
        const expirationDate = customerInfo
          ? revenueCatService.getExpirationDate(customerInfo)
          : null;
        const updates: Record<string, any> = { is_premium: true };
        if (expirationDate) updates.premium_expires_at = expirationDate;
        await updateProfile(updates);
        await useUsageStore.getState().syncFromFirebase();
        await fetchData();
      }
    } catch (error) {
      console.error('Restore failed:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const featureEntries = Object.entries(PREMIUM_FEATURES) as [string, string][];

  if (isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={C.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isPremium ? 'EITO Pro' : 'Subscription'}</Text>
          <View style={styles.backBtn} />
        </View>
        <ActivityIndicator size="large" color={C.terracotta} style={{ marginTop: 60 }} />
      </View>
    );
  }

  // ─── PRO USER VIEW ───
  if (isPremium) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={C.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>EITO Pro</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Membership Card */}
          <LinearGradient
            colors={['#2A2520', '#1A1510']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.membershipCard}
          >
            <View style={styles.membershipCardInner}>
              {/* Gold accent line */}
              <LinearGradient
                colors={['transparent', 'rgba(212, 175, 55, 0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.goldAccentLine}
              />

              <View style={styles.membershipTop}>
                <View style={styles.membershipBadge}>
                  <Ionicons name="star" size={12} color={C.gold} />
                  <Text style={styles.membershipBadgeText}>PRO MEMBER</Text>
                </View>
                <Ionicons name="diamond" size={20} color={C.gold} />
              </View>

              <Text style={styles.membershipName}>EITO Pro</Text>
              <Text style={styles.membershipTagline}>Unlimited culinary creativity</Text>

              {/* Subscription Info */}
              <View style={styles.membershipInfoRow}>
                <View style={styles.membershipInfoItem}>
                  <Text style={styles.membershipInfoLabel}>Plan</Text>
                  <Text style={styles.membershipInfoValue}>
                    {subDetails.planType ?? 'Active'}
                  </Text>
                </View>
                <View style={styles.membershipInfoDivider} />
                <View style={styles.membershipInfoItem}>
                  <Text style={styles.membershipInfoLabel}>
                    {subDetails.expiryDate ? 'Renews' : 'Status'}
                  </Text>
                  <Text style={styles.membershipInfoValue}>
                    {subDetails.expiryDate
                      ? formatDate(subDetails.expiryDate)
                      : 'Active'}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          {/* Unlocked Features */}
          <Text style={styles.sectionLabel}>Your Pro Features</Text>
          <View style={styles.featuresGrid}>
            {featureEntries.map(([key, label]) => (
              <View key={key} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons
                    name={FEATURE_ICONS[key] || 'checkmark-circle-outline'}
                    size={20}
                    color={C.gold}
                  />
                </View>
                <Text style={styles.featureLabel} numberOfLines={2}>{label}</Text>
                <Ionicons name="checkmark-circle" size={16} color={C.olive} style={styles.featureCheck} />
              </View>
            ))}
          </View>

          {/* Manage */}
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={handleManageSubscription}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-outline" size={18} color={C.charcoal} />
            <Text style={styles.manageBtnText}>Manage Subscription</Text>
          </TouchableOpacity>

          {/* Restore */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={C.muted} />
            ) : (
              <Text style={styles.restoreText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── FREE USER VIEW ───
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Plan */}
        <View style={styles.freePlanCard}>
          <View style={styles.freePlanBadge}>
            <Ionicons name="person-outline" size={14} color={C.muted} />
            <Text style={styles.freePlanBadgeText}>FREE PLAN</Text>
          </View>
          <Text style={styles.freePlanTitle}>You're on the free plan</Text>
          <Text style={styles.freePlanSubtitle}>
            Upgrade to EITO Pro for unlimited recipes, scans, and AI chats
          </Text>
        </View>

        {/* Usage Summary */}
        <Text style={styles.sectionLabel}>Usage This Period</Text>
        <View style={styles.usageCard}>
          {[
            { icon: 'restaurant-outline' as const, label: 'Recipes', remaining: Math.max(0, FREE_PLAN_LIMITS.recipes_per_week - recipesUsed), total: FREE_PLAN_LIMITS.recipes_per_week, color: C.terracotta },
            { icon: 'scan-outline' as const, label: 'Fridge Scans', remaining: Math.max(0, FREE_PLAN_LIMITS.scans_per_week - scansUsed), total: FREE_PLAN_LIMITS.scans_per_week, color: C.gold },
            { icon: 'chatbubbles-outline' as const, label: 'AI Chats', remaining: Math.max(0, FREE_PLAN_LIMITS.ai_chats_per_week - chatsUsed), total: FREE_PLAN_LIMITS.ai_chats_per_week, color: C.olive },
          ].map((row, index, arr) => (
            <View key={row.label}>
              <View style={styles.usageRow}>
                <View style={[styles.usageIconWrap, { backgroundColor: `${row.color}15` }]}>
                  <Ionicons name={row.icon} size={18} color={row.color} />
                </View>
                <View style={styles.usageInfo}>
                  <Text style={styles.usageLabel}>{row.label}</Text>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min((row.remaining / row.total) * 100, 100)}%`,
                          backgroundColor: row.color,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.usageCount}>{row.remaining}/{row.total}</Text>
              </View>
              {index < arr.length - 1 && <View style={styles.usageDivider} />}
            </View>
          ))}
          <View style={styles.resetRow}>
            <Ionicons name="time-outline" size={14} color={C.light} />
            <Text style={styles.resetText}>
              {daysUntilReset === 0 ? 'Resets today' : `Resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>

        {/* What You'll Unlock */}
        <Text style={styles.sectionLabel}>Unlock with Pro</Text>
        <View style={styles.comparisonCard}>
          {featureEntries.map(([key, label], index) => (
            <View key={key}>
              <View style={styles.comparisonRow}>
                <Ionicons
                  name={FEATURE_ICONS[key] || 'checkmark-circle-outline'}
                  size={18}
                  color={C.terracotta}
                />
                <Text style={styles.comparisonLabel}>{label}</Text>
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={10} color={C.light} />
                </View>
              </View>
              {index < featureEntries.length - 1 && <View style={styles.comparisonDivider} />}
            </View>
          ))}
        </View>

        {/* Upgrade Button */}
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={handleUpgrade}
          activeOpacity={0.85}
        >
          <Ionicons name="diamond" size={18} color="#FFF" />
          <Text style={styles.upgradeBtnText}>Upgrade to EITO Pro</Text>
        </TouchableOpacity>

        {/* Restore */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={C.muted} />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.ivory,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.light,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 28,
    marginBottom: 10,
  },

  // ─── MEMBERSHIP CARD (Pro) ───
  membershipCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  membershipCardInner: {
    padding: 24,
  },
  goldAccentLine: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
  },
  membershipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  membershipBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: C.gold,
    letterSpacing: 1.2,
  },
  membershipName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  membershipTagline: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 24,
  },
  membershipInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 16,
  },
  membershipInfoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  membershipInfoLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  membershipInfoValue: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  membershipInfoDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // ─── FEATURES GRID (Pro) ───
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: (SCREEN_W - 50) / 2,
    backgroundColor: C.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.charcoal,
    lineHeight: 18,
  },
  featureCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // ─── MANAGE BTN (Pro) ───
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.08)',
    paddingVertical: 16,
    borderRadius: 22,
    marginTop: 28,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  manageBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },

  // ─── FREE PLAN CARD ───
  freePlanCard: {
    backgroundColor: C.cardBg,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  freePlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  freePlanBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.5,
  },
  freePlanTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 8,
  },
  freePlanSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.light,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ─── USAGE CARD (Free) ───
  usageCard: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    padding: 16,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  usageIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageInfo: {
    flex: 1,
    gap: 6,
  },
  usageLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageCount: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
    minWidth: 40,
    textAlign: 'right',
  },
  usageDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hairline,
    marginLeft: 50,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
  },
  resetText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.light,
  },

  // ─── COMPARISON CARD (Free) ───
  comparisonCard: {
    backgroundColor: C.cardBg,
    borderRadius: 18,
    padding: 16,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  comparisonLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
    flex: 1,
  },
  lockBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hairline,
    marginLeft: 30,
  },

  // ─── UPGRADE BTN (Free) ───
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.terracotta,
    paddingVertical: 16,
    borderRadius: 22,
    marginTop: 28,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  upgradeBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  // ─── RESTORE ───
  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  restoreText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.muted,
  },
});
