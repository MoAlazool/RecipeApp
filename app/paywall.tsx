import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, CheckBox } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { revenueCatService } from '@/services/revenueCat.service';
import { useAuthStore } from '@/stores/authStore';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { PREMIUM_FEATURES } from '@/utils/types';

interface PricingPlan {
  id: string;
  title: string;
  price: string;
  period: string;
  savings?: string;
  popular?: boolean;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    price: '$4.99',
    period: '/month',
  },
  {
    id: 'yearly',
    title: 'Yearly',
    price: '$39.99',
    period: '/year',
    savings: 'Save 33%',
    popular: true,
  },
];

const FEATURES = [
  { icon: 'infinite-outline', text: 'Unlimited recipe extractions' },
  { icon: 'camera-outline', text: 'Unlimited fridge scans' },
  { icon: 'bookmark-outline', text: 'Save unlimited recipes' },
  { icon: 'swap-horizontal-outline', text: 'Smart ingredient substitutions' },
  { icon: 'nutrition-outline', text: 'Detailed nutrition info' },
  { icon: 'mic-outline', text: 'Hands-free voice control' },
  { icon: 'calendar-outline', text: 'Weekly meal planner' },
  { icon: 'people-outline', text: 'Family sharing (5 members)' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();

  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  useEffect(() => {
    revenueCatService.initialize();
  }, []);

  const handlePurchase = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Processing...');

      // Get offerings from RevenueCat
      const offerings = await revenueCatService.getOfferings();

      if (!offerings?.availablePackages?.length) {
        Alert.alert('Error', 'No subscriptions available. Please try again later.');
        setIsLoading(false);
        return;
      }

      // Find the selected package
      const pkg = offerings.availablePackages.find((p) =>
        selectedPlan === 'yearly'
          ? p.packageType === 'ANNUAL'
          : p.packageType === 'MONTHLY'
      );

      if (!pkg) {
        Alert.alert('Error', 'Selected plan not available');
        setIsLoading(false);
        return;
      }

      const success = await revenueCatService.purchasePackage(pkg);

      if (success) {
        // Update user profile
        await updateProfile({ is_premium: true });
        Alert.alert('Welcome to Pro!', 'You now have access to all premium features.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }

      setIsLoading(false);
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert('Error', error.message || 'Purchase failed. Please try again.');
    }
  };

  const handleRestore = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Restoring purchases...');

      const success = await revenueCatService.restorePurchases();

      if (success) {
        await updateProfile({ is_premium: true });
        Alert.alert('Success', 'Your purchases have been restored!', [
          { text: 'OK', onPress: () => router.back() },
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

  return (
    <View style={styles.container}>
      <LoadingOverlay visible={isLoading} message={loadingMessage} />

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Button
            icon={<Ionicons name="close" size={20} color="#1C100D" />}
            type="clear"
            onPress={() => router.back()}
            containerStyle={styles.closeButton}
          />
          <View style={styles.proIcon}>
            <Ionicons name="diamond" size={34} color="#F2330D" />
          </View>
          <Text h2 style={styles.title}>Upgrade to Pro</Text>
          <Text style={styles.subtitle}>
            Unlock all features and cook without limits
          </Text>
        </View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={18} color="#F2330D" />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        <View style={styles.plans}>
          {PRICING_PLANS.map((plan) => (
            <Button
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              type="outline"
              buttonStyle={[
                styles.planButton,
                selectedPlan === plan.id && styles.planButtonSelected,
              ]}
              containerStyle={styles.planContainer}
            >
              <View style={styles.planContent}>
                {plan.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                )}
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <View style={styles.planPriceRow}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                  {plan.savings && (
                    <Text style={styles.planSavings}>{plan.savings}</Text>
                  )}
                </View>
                <View style={styles.planCheck}>
                  <Ionicons
                    name={selectedPlan === plan.id ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={selectedPlan === plan.id ? '#F2330D' : '#C8B7B2'}
                  />
                </View>
              </View>
            </Button>
          ))}
        </View>

        {/* CTA */}
        <Button
          title="Start Free Trial"
          onPress={handlePurchase}
          buttonStyle={styles.ctaButton}
          titleStyle={styles.ctaText}
        />

        <Text style={styles.trialInfo}>
          7-day free trial, then {selectedPlan === 'yearly' ? '$39.99/year' : '$4.99/month'}
        </Text>

        <Button
          title="Restore Purchases"
          type="clear"
          titleStyle={styles.restoreText}
          onPress={handleRestore}
        />

        <Text style={styles.disclaimer}>
          Payment will be charged to your Apple ID account at confirmation of purchase.
          Subscription automatically renews unless canceled at least 24 hours before the
          end of the current period.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  proIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#1C100D',
    marginBottom: 8,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  subtitle: {
    color: '#9C5749',
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'NotoSans_500Medium',
  },
  features: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#1C100D',
    fontFamily: 'NotoSans_500Medium',
  },
  plans: {
    marginBottom: 24,
  },
  planContainer: {
    marginBottom: 12,
  },
  planButton: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  planButtonSelected: {
    backgroundColor: 'rgba(242, 51, 13, 0.06)',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  planContent: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  popularBadge: {
    position: 'absolute',
    top: -28,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: '#F2330D',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popularText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'NotoSans_700Bold',
  },
  planInfo: {
    flex: 1,
  },
  planTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 4,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  planPrice: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
  },
  planPeriod: {
    fontSize: 14,
    color: '#9C5749',
    marginLeft: 4,
    fontFamily: 'NotoSans_500Medium',
  },
  planSavings: {
    fontSize: 12,
    color: '#4CAF50',
    fontFamily: 'NotoSans_600SemiBold',
    marginTop: 4,
  },
  planCheck: {
    marginLeft: 12,
  },
  ctaButton: {
    backgroundColor: '#F2330D',
    borderRadius: 18,
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  trialInfo: {
    textAlign: 'center',
    color: '#9C5749',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
    fontFamily: 'NotoSans_500Medium',
  },
  restoreText: {
    color: '#F2330D',
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
  },
  disclaimer: {
    textAlign: 'center',
    color: '#C8B7B2',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 16,
    fontFamily: 'NotoSans_500Medium',
  },
});
