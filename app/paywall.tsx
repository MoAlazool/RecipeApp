import { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { CustomerInfo, PurchasesOffering } from 'react-native-purchases';
import {
  revenueCatService,
  type Plan,
  type RevenueCatReadiness,
} from '@/services/revenueCat.service';
import { useAuthStore } from '@/stores/authStore';
import { useProShowcaseStore } from '@/stores/proShowcaseStore';
import { useUsageStore } from '@/stores/usageStore';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

const { width: SCREEN_W } = Dimensions.get('window');

interface PricingPlan {
  id: string;
  title: string;
  price: string;
  period: string;
  perMonth?: string;
  savings?: string;
  popular?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'yearly',
    title: 'Annual',
    price: '$29.99',
    period: '/year',
    perMonth: '$2.50/mo',
    savings: 'Save 37%',
    popular: true,
  },
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$3.99',
    period: '/month',
  },
];

const PRO_FEATURES = [
  { icon: 'scan-outline' as const, title: 'Unlimited Scans', desc: 'No daily limits' },
  { icon: 'infinite-outline' as const, title: 'Unlimited Use', desc: 'No daily limits, ever' },
  { icon: 'calendar-outline' as const, title: 'Meal Planner', desc: 'Plan your week' },
  { icon: 'time-outline' as const, title: 'Scan History', desc: 'Past fridge scans' },
  { icon: 'nutrition-outline' as const, title: 'Nutrition', desc: 'Full breakdown' },
  { icon: 'cloud-upload-outline' as const, title: 'Cloud Sync', desc: 'All your devices' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
  const triggerProShowcase = useProShowcaseStore((state) => state.triggerForUser);
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();

  const dismiss = () => {
    if (fromOnboarding) {
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  };
  const isExpoGo =
    (Constants as any).executionEnvironment === 'storeClient' ||
    (Constants as any).appOwnership === 'expo';

  const [selectedPlan, setSelectedPlan] = useState<Plan>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [plans, setPlans] = useState<PricingPlan[]>(PRICING_PLANS);
  const [yearlyTrialEligible, setYearlyTrialEligible] = useState(true);
  const cachedOffering = useRef<PurchasesOffering | null>(null);

  // ── Entry animations ──
  const EASE = Easing.out(Easing.cubic);
  const heroOpacity = useSharedValue(0);
  const heroScale = useSharedValue(0.95);
  const featuresOpacity = useSharedValue(0);
  const featuresY = useSharedValue(24);
  const plansOpacity = useSharedValue(0);
  const plansY = useSharedValue(20);
  const ctaOpacity = useSharedValue(0);
  const ctaY = useSharedValue(20);

  useEffect(() => {
    heroOpacity.value = withDelay(100, withTiming(1, { duration: 500, easing: EASE }));
    heroScale.value = withDelay(100, withSpring(1, { damping: 20, stiffness: 100 }));

    featuresOpacity.value = withDelay(300, withTiming(1, { duration: 500, easing: EASE }));
    featuresY.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 100 }));

    plansOpacity.value = withDelay(450, withTiming(1, { duration: 500, easing: EASE }));
    plansY.value = withDelay(450, withSpring(0, { damping: 20, stiffness: 100 }));

    ctaOpacity.value = withDelay(600, withTiming(1, { duration: 400, easing: EASE }));
    ctaY.value = withDelay(600, withSpring(0, { damping: 18, stiffness: 120 }));
  }, []);

  const heroAnim = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));
  const featuresAnim = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
    transform: [{ translateY: featuresY.value }],
  }));
  const plansAnim = useAnimatedStyle(() => ({
    opacity: plansOpacity.value,
    transform: [{ translateY: plansY.value }],
  }));
  const ctaAnim = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaY.value }],
  }));

  useEffect(() => {
    let cancelled = false;

    const loadOfferings = async (attempt = 1): Promise<void> => {
      try {
        await revenueCatService.initialize();

        const offering = await revenueCatService.getOfferings();
        const availablePackages = offering?.availablePackages ?? [];

        if (availablePackages.length === 0 && attempt < 3) {
          const delay = attempt * 1500;
          console.warn(`RevenueCat offerings empty, retrying in ${delay}ms (attempt ${attempt})...`);
          await new Promise((r) => setTimeout(r, delay));
          if (!cancelled) return loadOfferings(attempt + 1);
          return;
        }

        if (cancelled) return;

        if (offering && availablePackages.length > 0) {
          cachedOffering.current = offering;

          const monthlyPkg = revenueCatService.getPackageForPlan(offering, 'monthly');
          const yearlyPkg = revenueCatService.getPackageForPlan(offering, 'yearly');

          const updatedPlans = [...PRICING_PLANS];
          if (monthlyPkg) {
            const idx = updatedPlans.findIndex((p) => p.id === 'monthly');
            if (idx !== -1) {
              updatedPlans[idx] = {
                ...updatedPlans[idx],
                price: monthlyPkg.product.priceString,
              };
            }
          }
          if (yearlyPkg) {
            const idx = updatedPlans.findIndex((p) => p.id === 'yearly');
            if (idx !== -1) {
              const yearlyPrice = yearlyPkg.product.price;
              const monthlyEquiv = (yearlyPrice / 12).toFixed(2);
              const currencyCode = yearlyPkg.product.currencyCode;
              updatedPlans[idx] = {
                ...updatedPlans[idx],
                price: yearlyPkg.product.priceString,
                perMonth: `${currencyCode === 'USD' ? '$' : ''}${monthlyEquiv}/mo`,
              };
            }
          }
          setPlans(updatedPlans);

          if (yearlyPkg) {
            const eligible =
              await revenueCatService.checkTrialEligibility([yearlyPkg.product.identifier]);
            if (!cancelled) setYearlyTrialEligible(eligible);
          } else {
            if (!cancelled) setYearlyTrialEligible(false);
          }
        } else {
          console.warn('RevenueCat offerings still empty after retries');
        }
      } catch (error) {
        console.warn('Failed to load dynamic pricing:', error);
      }
    };

    loadOfferings();
    return () => { cancelled = true; };
  }, []);

  const isLikelyNetworkError = (error: unknown): boolean => {
    const message = String((error as any)?.message || error || '').toLowerCase();
    return (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('offline') ||
      message.includes('timed out')
    );
  };

  const showSubscriptionsUnavailableAlert = (readiness: RevenueCatReadiness | null) => {
    if (isExpoGo) {
      Alert.alert(
        'Expo Go Not Supported',
        'In-app purchases do not work in Expo Go. Use a development build instead (npx expo run:ios).'
      );
      return;
    }

    const hasIssue = (issue: RevenueCatReadiness['issues'][number]) =>
      readiness?.issues.includes(issue);

    let title = 'Subscriptions Unavailable';
    let message =
      'Subscriptions are temporarily unavailable. Please try again in a moment.';

    if (hasIssue('MISSING_API_KEY')) {
      title = 'Subscriptions Not Configured';
      message =
        'RevenueCat API key is missing in this build. Set EXPO_PUBLIC_REVENUECAT_APPLE_KEY for iOS and rebuild.';
    } else if (hasIssue('NO_CURRENT_OFFERING')) {
      title = 'Subscription Offering Missing';
      message =
        'No active offering was returned from RevenueCat. Verify your default offering includes monthly and yearly packages.';
    } else if (hasIssue('MISSING_PRODUCT_IDS')) {
      title = 'Product IDs Not Configured';
      message =
        'Product IDs are missing in app config. Set EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID and EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID.';
    } else if (hasIssue('NO_MATCHING_PACKAGE')) {
      title = 'Package Mapping Issue';
      message =
        'RevenueCat returned an offering, but no matching monthly/yearly package was found. Check package mapping in the offering.';
    } else if (hasIssue('NO_STORE_PRODUCTS')) {
      title = 'Store Product Mapping Issue';
      message =
        'The configured product IDs were not returned by App Store Connect. Verify IDs match exactly in RevenueCat and App Store Connect.';
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retry', onPress: () => handlePurchase() },
    ]);
  };

  const requireAuthenticatedUserId = (): string | null => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      Alert.alert(
        'Sign In Required',
        'Please sign in again before completing your purchase.'
      );
      return null;
    }
    return userId;
  };

  const unlockPremiumAccess = async (
    userId: string,
    customerInfo: CustomerInfo | null
  ) => {
    const expirationDate = customerInfo
      ? revenueCatService.getExpirationDate(customerInfo)
      : null;
    const updates: Record<string, any> = { is_premium: true };
    if (expirationDate) updates.premium_expires_at = expirationDate;
    await updateProfile(updates);
    triggerProShowcase(userId);
    await useUsageStore.getState().syncFromFirebase();
  };

  const handlePurchase = async () => {
    const plan: Plan = selectedPlan;
    const userId = requireAuthenticatedUserId();
    if (!userId) return;

    try {
      setIsLoading(true);
      setLoadingMessage('Processing...');
      await revenueCatService.login(userId);

      let offering = cachedOffering.current;
      if (!offering) {
        offering = await revenueCatService.getOfferings();
        if (offering) cachedOffering.current = offering;
      }

      const pkg = offering ? revenueCatService.getPackageForPlan(offering, plan) : null;
      let purchaseAttempted = false;

      if (pkg) {
        purchaseAttempted = true;
        await revenueCatService.purchasePackage(pkg);
      } else {
        const fallbackProduct = await revenueCatService.getFallbackProductForPlan(plan);

        if (!fallbackProduct) {
          const readiness = await revenueCatService.getPurchaseReadiness(plan);
          console.warn('[RevenueCat] Purchase readiness failed:', readiness);
          showSubscriptionsUnavailableAlert(readiness);
          return;
        }

        purchaseAttempted = true;
        await revenueCatService.purchaseStoreProduct(fallbackProduct);
      }

      if (!purchaseAttempted) return;

      setLoadingMessage('Verifying purchase...');
      const customerInfo = await revenueCatService.getCustomerInfo();
      const hasPremiumAccess = customerInfo
        ? revenueCatService.hasPremiumEntitlement(customerInfo)
        : false;

      if (hasPremiumAccess) {
        await unlockPremiumAccess(userId, customerInfo);
        Alert.alert('Welcome to Pro!', 'You now have access to all premium features.', [
          { text: 'View Pro Hub', onPress: () => router.replace('/(tabs)/pro') },
        ]);
        return;
      }

      Alert.alert(
        'Purchase Pending Verification',
        'Your purchase was completed, but Pro has not synced yet. Try restore, or retry after a moment.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Restore Purchases', onPress: () => handleRestore() },
          { text: 'Retry', onPress: () => handlePurchase() },
        ]
      );
    } catch (error: any) {
      if (error?.userCancelled) {
        return;
      }
      if (isLikelyNetworkError(error)) {
        Alert.alert(
          'Connection Error',
          'Could not reach the App Store. Please check your connection and try again.'
        );
      } else {
        Alert.alert('Purchase Failed', error.message || 'Unable to complete this purchase right now.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    const userId = requireAuthenticatedUserId();
    if (!userId) return;

    try {
      setIsLoading(true);
      setLoadingMessage('Restoring purchases...');
      await revenueCatService.login(userId);
      await revenueCatService.restorePurchases();

      setLoadingMessage('Verifying purchases...');
      const customerInfo = await revenueCatService.getCustomerInfo();
      const hasPremiumAccess = customerInfo
        ? revenueCatService.hasPremiumEntitlement(customerInfo)
        : false;

      if (hasPremiumAccess) {
        await unlockPremiumAccess(userId, customerInfo);
        Alert.alert('Success', 'Your purchases have been restored!', [
          { text: 'View Pro Hub', onPress: () => router.replace('/(tabs)/pro') },
        ]);
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not verify an active Pro subscription for this account. If you were just charged, try again in a moment.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases');
    } finally {
      setIsLoading(false);
    }
  };

  const yearlyPlan = plans.find((p) => p.id === 'yearly');
  const monthlyPlan = plans.find((p) => p.id === 'monthly');
  const showTrial = selectedPlan === 'yearly' && yearlyTrialEligible;

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isLoading} message={loadingMessage} />

      {/* Light background */}
      <View style={StyleSheet.absoluteFill} />

      {/* Close button */}
      <Pressable style={[styles.closeBtn, { top: insets.top + 10 }]} onPress={dismiss}>
        <Ionicons name="close" size={22} color="#1A1510" />
      </Pressable>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Section ── */}
        <Animated.View style={[styles.heroSection, heroAnim]}>
          <View style={styles.iconWrap}>
            <ExpoImage
              source={require('@/assets/icon.png')}
              style={styles.iconImage}
              contentFit="cover"
            />
          </View>

          <View style={styles.proBadge}>
            <Text style={styles.proBadgeText}>EITO PRO</Text>
          </View>

          <Text style={styles.heroTitle}>
            Everything you need{'\n'}to master your kitchen
          </Text>
          <Text style={styles.heroSub}>
            {showTrial
              ? 'Start free for 7 days. Cancel anytime.'
              : 'Unlock all premium features today.'}
          </Text>
        </Animated.View>

        {/* ── Feature Cards ── */}
        <Animated.View style={[styles.featuresSection, featuresAnim]}>
          <View style={styles.featuresGrid}>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={20} color="#C66E4E" />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Plan Selection ── */}
        <Animated.View style={[styles.plansSection, plansAnim]}>
          <Text style={styles.plansSectionTitle}>Choose your plan</Text>

          <View style={styles.plansRow}>
            {/* Yearly */}
            {yearlyPlan && (
              <Pressable
                style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('yearly')}
              >
                {yearlyPlan.savings && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>{yearlyPlan.savings}</Text>
                  </View>
                )}
                <Text style={styles.planName}>{yearlyPlan.title}</Text>
                <Text style={styles.planPrice}>{yearlyPlan.perMonth || yearlyPlan.price}</Text>
                <Text style={styles.planBilled}>{yearlyPlan.price}/year</Text>
                {yearlyTrialEligible && (
                  <View style={styles.trialTag}>
                    <Ionicons name="gift-outline" size={11} color="#C66E4E" />
                    <Text style={styles.trialTagText}>7-day free trial</Text>
                  </View>
                )}
              </Pressable>
            )}

            {/* Monthly */}
            {monthlyPlan && (
              <Pressable
                style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <Text style={styles.planName}>{monthlyPlan.title}</Text>
                <Text style={styles.planPrice}>{monthlyPlan.price}</Text>
                <Text style={styles.planBilled}>per month</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* ── Footer ── */}
        <Animated.View style={[styles.footer, ctaAnim]}>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={14} color="#B5B0A7" />
            <Text style={styles.trustText}>Cancel anytime in Settings</Text>
          </View>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={handleRestore}>
              <Text style={styles.footerLink}>Restore</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => router.push('/terms-privacy' as any)}>Terms</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => router.push('/terms-privacy' as any)}>Privacy</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* ── Floating CTA Button ── */}
      <Animated.View style={[styles.floatingCta, { bottom: Math.max(insets.bottom, 16) }, ctaAnim]}>
        <TouchableOpacity
          onPress={handlePurchase}
          activeOpacity={0.85}
          style={styles.ctaWrapper}
        >
          <LinearGradient
            colors={['#C66E4E', '#B05938']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>
              {showTrial ? 'Start Free Trial' : 'Subscribe Now'}
            </Text>
            {showTrial && (
              <Text style={styles.ctaSub}>
                7 days free, then {yearlyPlan?.price || '$29.99'}/year
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const CARD_W = (SCREEN_W - 40 - 10) / 2; // 2 columns with gap

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  content: {
    paddingHorizontal: 20,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 50,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26,21,16,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero ──
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#C66E4E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconImage: {
    width: 64,
    height: 64,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(26,21,16,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  proBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#C66E4E',
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: '#1A1510',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  heroSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#8A8578',
    textAlign: 'center',
  },

  // ── Features ──
  featuresSection: {
    marginBottom: 32,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: CARD_W,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(198, 110, 78, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#1A1510',
    marginBottom: 2,
  },
  featureDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#B5B0A7',
  },

  // ── Plans ──
  plansSection: {
    marginBottom: 20,
  },
  plansSectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#B5B0A7',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
    textAlign: 'center',
  },
  plansRow: {
    flexDirection: 'row',
    gap: 10,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: -6,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 2,
  },
  savingsBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#1A1510',
    letterSpacing: 0.3,
  },
  trialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 4,
  },
  trialTagText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#C66E4E',
  },
  planCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    paddingTop: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(26,21,16,0.06)',
    alignItems: 'center',
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    overflow: 'visible',
  },
  planCardActive: {
    borderColor: '#C66E4E',
    backgroundColor: 'rgba(198, 110, 78, 0.04)',
  },
  planName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1A1510',
    marginBottom: 4,
  },
  planPrice: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 22,
    color: '#1A1510',
    marginBottom: 2,
  },
  planBilled: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#B5B0A7',
  },

  // ── Footer ──
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#B5B0A7',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#D5D1CB',
  },
  footerDot: {
    fontSize: 12,
    color: '#D5D1CB',
  },

  // ── Floating CTA ──
  floatingCta: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  ctaWrapper: {
    shadowColor: '#C66E4E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaGradient: {
    paddingVertical: 17,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  ctaSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
});
