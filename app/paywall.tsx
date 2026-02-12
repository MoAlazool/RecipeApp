import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Constants from 'expo-constants';
import { PurchasesOffering } from 'react-native-purchases';
import {
  revenueCatService,
  type Plan,
  type RevenueCatReadiness,
} from '@/services/revenueCat.service';
import { useAuthStore } from '@/stores/authStore';
import { useUsageStore } from '@/stores/usageStore';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

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
    title: 'Yearly',
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

const FEATURES = [
  'Scan & save unlimited recipes',
  'Get personalized ideas from your AI chef',
  'Plan your meals for the whole week',
  'Cook hands-free with voice control',
  'Full nutrition info for every recipe',
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateProfile } = useAuthStore();
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

  useEffect(() => {
    let cancelled = false;

    const loadOfferings = async (attempt = 1): Promise<void> => {
      try {
        await revenueCatService.initialize();

        const offering = await revenueCatService.getOfferings();
        const availablePackages = offering?.availablePackages ?? [];

        // Retry up to 3 times with increasing delay if offerings are empty
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

          // Check trial eligibility for the yearly product only
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

  const handlePurchase = async () => {
    const plan: Plan = selectedPlan;

    try {
      setIsLoading(true);
      setLoadingMessage('Processing...');

      // Use cached offerings first, re-fetch only if not available
      let offering = cachedOffering.current;
      if (!offering) {
        offering = await revenueCatService.getOfferings();
        if (offering) cachedOffering.current = offering;
      }

      const pkg = offering ? revenueCatService.getPackageForPlan(offering, plan) : null;
      let success = false;

      if (pkg) {
        success = await revenueCatService.purchasePackage(pkg);
      } else {
        // Try direct product fetch as fallback
        const fallbackProduct = await revenueCatService.getFallbackProductForPlan(plan);

        if (!fallbackProduct) {
          const readiness = await revenueCatService.getPurchaseReadiness(plan);
          console.warn('[RevenueCat] Purchase readiness failed:', readiness);
          showSubscriptionsUnavailableAlert(readiness);
          return;
        }

        success = await revenueCatService.purchaseStoreProduct(fallbackProduct);
      }

      if (success) {
        const customerInfo = await revenueCatService.getCustomerInfo();
        const expirationDate = customerInfo
          ? revenueCatService.getExpirationDate(customerInfo)
          : null;
        const updates: Record<string, any> = { is_premium: true };
        if (expirationDate) updates.premium_expires_at = expirationDate;
        await updateProfile(updates);
        await useUsageStore.getState().syncFromFirebase();
        Alert.alert('Welcome to Pro!', 'You now have access to all premium features.', [
          { text: 'View Pro Hub', onPress: () => router.replace('/(tabs)/pro') },
        ]);
      }
    } catch (error: any) {
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
    try {
      setIsLoading(true);
      setLoadingMessage('Restoring purchases...');

      const success = await revenueCatService.restorePurchases();

      if (success) {
        const customerInfo = await revenueCatService.getCustomerInfo();
        const expirationDate = customerInfo
          ? revenueCatService.getExpirationDate(customerInfo)
          : null;
        const updates: Record<string, any> = { is_premium: true };
        if (expirationDate) updates.premium_expires_at = expirationDate;
        await updateProfile(updates);
        await useUsageStore.getState().syncFromFirebase();
        Alert.alert('Success', 'Your purchases have been restored!', [
          { text: 'View Pro Hub', onPress: () => router.replace('/(tabs)/pro') },
        ]);
      } else {
        Alert.alert('No Purchases Found', 'We could not find any previous purchases.');
      }

      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Failed to restore purchases');
    }
  };

  const yearlyPlan = plans.find((p) => p.id === 'yearly');
  const monthlyPlan = plans.find((p) => p.id === 'monthly');

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isLoading} message={loadingMessage} />

      <ExpoImage
        source={require('@/assets/welcome-bg.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      {/* Close button — absolute top right */}
      <Pressable style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={dismiss}>
        <Ionicons name="close" size={22} color="rgba(74, 50, 40, 0.4)" />
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        {/* Top section: icon + title + features */}
        <View style={styles.topSection}>
          <View style={styles.iconContainer}>
            <ExpoImage
              source={require('@/assets/icon.png')}
              style={styles.iconImage}
              contentFit="cover"
            />
          </View>

          <Text style={styles.title}>
            Get the full{'\n'}EITO experience
          </Text>
          <Text style={styles.subtitle}>
            {selectedPlan === 'yearly' && yearlyTrialEligible
              ? 'Try free for 7 days. Cancel anytime.'
              : 'Unlock all premium features.'}
          </Text>

          {/* Feature list card */}
          <View style={styles.featureCard}>
            {FEATURES.map((feature, i) => (
              <View
                key={i}
                style={[
                  styles.featureRow,
                  i < FEATURES.length - 1 && styles.featureRowBorder,
                ]}
              >
                <View style={styles.checkCircle}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom section: plans + CTA + footer */}
        <View style={styles.bottomSection}>
          {/* Plan selection — side by side */}
          <View style={styles.planSection}>
            {yearlyPlan && (
              <View style={{ flex: 1 }}>
                {yearlyPlan.savings && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsBadgeText}>{yearlyPlan.savings}</Text>
                  </View>
                )}
                <Pressable
                  style={[
                    styles.planCard,
                    selectedPlan === 'yearly' && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedPlan('yearly')}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle}>{yearlyPlan.title}</Text>
                    <View style={[styles.radio, selectedPlan === 'yearly' && styles.radioSelected]}>
                      {selectedPlan === 'yearly' && (
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      )}
                    </View>
                  </View>
                  <Text style={styles.planPrice}>
                    {yearlyPlan.perMonth || yearlyPlan.price}
                  </Text>
                  <Text style={styles.planDetail}>
                    Billed at {yearlyPlan.price}{yearlyPlan.period}
                    {yearlyTrialEligible ? '\nafter 7-day free trial' : ''}
                  </Text>
                </Pressable>
              </View>
            )}

            {monthlyPlan && (
              <View style={{ flex: 1 }}>
                <View style={styles.savingsBadgePlaceholder} />
                <Pressable
                  style={[
                    styles.planCard,
                    selectedPlan === 'monthly' && styles.planCardSelected,
                  ]}
                  onPress={() => setSelectedPlan('monthly')}
                >
                  <View style={styles.planHeader}>
                    <Text style={styles.planTitle}>{monthlyPlan.title}</Text>
                    <View style={[styles.radio, selectedPlan === 'monthly' && styles.radioSelected]}>
                      {selectedPlan === 'monthly' && (
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                      )}
                    </View>
                  </View>
                  <Text style={styles.planPrice}>
                    {monthlyPlan.price}{monthlyPlan.period}
                  </Text>
                  <Text style={styles.planDetail}>
                    Billed monthly{'\n'}No free trial
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* CTA button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handlePurchase}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>
              {selectedPlan === 'yearly' && yearlyTrialEligible
                ? 'Start 7-day free trial'
                : 'Subscribe Now'}
            </Text>
          </TouchableOpacity>

          {/* Footer links */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleRestore} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Restore Purchases</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.footerLink}>Terms</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.footerLink}>Privacy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EDE8',
  },

  // ── Close ──
  closeBtn: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Content ──
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
  },
  bottomSection: {
    width: '100%',
  },

  // ── Icon ──
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  iconImage: {
    width: 56,
    height: 56,
  },

  // ── Title ──
  title: {
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    fontSize: 28,
    color: '#4A3228',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: 'rgba(74, 50, 40, 0.55)',
    textAlign: 'center',
    marginBottom: 20,
  },

  // ── Feature list card ──
  featureCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  featureRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 21, 16, 0.08)',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#C66E4E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#4A3228',
    flex: 1,
  },

  // ── Plans ──
  planSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  savingsBadge: {
    alignSelf: 'center',
    backgroundColor: '#C66E4E',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: -11,
    zIndex: 1,
  },
  savingsBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#FFF',
    letterSpacing: 0.3,
  },
  savingsBadgePlaceholder: {
    height: 20,
    marginBottom: -11,
  },
  planCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 16,
    padding: 14,
    paddingTop: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  planCardSelected: {
    borderColor: '#C66E4E',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#4A3228',
  },
  planPrice: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#4A3228',
    marginBottom: 2,
  },
  planDetail: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: '#B5B0A7',
    lineHeight: 16,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D5D1CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#C66E4E',
    backgroundColor: '#C66E4E',
  },

  // ── CTA ──
  ctaButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A3228',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4A3228',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 14,
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },

  // ── Footer ──
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  footerLink: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: 'rgba(74, 50, 40, 0.5)',
  },
});
