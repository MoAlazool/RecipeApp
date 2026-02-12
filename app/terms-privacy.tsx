import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const C = {
  bg: '#FAFAF8',
  white: '#FFFFFF',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  light: '#B5B0A7',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

type Tab = 'terms' | 'privacy';

const TERMS_SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading, installing, or using EITO ("the App"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the App.',
  },
  {
    title: '2. Use of the App',
    body: 'EITO provides recipe extraction, fridge scanning, AI-powered cooking assistance, and meal planning tools. You agree to use the App only for its intended purpose and in compliance with all applicable laws.',
  },
  {
    title: '3. User Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.\n\nWe reserve the right to suspend or terminate accounts that violate these terms.',
  },
  {
    title: '4. Subscriptions & Payments',
    body: 'EITO Pro is available as a monthly or yearly subscription. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period.\n\nPayment is charged to your Apple ID or Google Play account. Manage or cancel subscriptions through your device settings.',
  },
  {
    title: '5. Content & Intellectual Property',
    body: 'Recipes you save are your personal collection. The App\'s AI-generated content (suggestions, substitutions, nutrition estimates) is provided as-is and should not be considered professional dietary or medical advice.\n\nAll App design, code, and branding remain the intellectual property of EITO.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'The App is provided "as is" without warranty of any kind. We are not liable for any damages arising from your use of the App, including but not limited to inaccurate recipe data, AI-generated suggestions, or nutrition estimates.\n\nAlways use your judgment when cooking, especially regarding food allergies and dietary restrictions.',
  },
  {
    title: '7. Changes to Terms',
    body: 'We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance of the updated terms. We will notify you of significant changes through the App.',
  },
];

const PRIVACY_SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'Account information: email address, name, username, and profile photo.\n\nUsage data: recipes saved, features used, and app interaction patterns.\n\nDevice data: device type, OS version, and crash reports for improving app stability.\n\nPhotos: only when you explicitly use the camera for fridge scanning or cookbook scanning. Photos are processed and not stored on our servers.',
  },
  {
    title: '2. How We Use Your Data',
    body: 'To provide and improve the App\'s functionality.\nTo personalize your recipe recommendations.\nTo process subscriptions and payments (handled by Apple/Google).\nTo send important account notifications.\nTo analyze usage patterns and fix bugs.',
  },
  {
    title: '3. Data Storage & Security',
    body: 'Your data is stored securely using Firebase with encryption at rest and in transit. We implement industry-standard security measures to protect your information.\n\nRecipe data and preferences are synced across your devices via your account.',
  },
  {
    title: '4. Third-Party Services',
    body: 'We use the following third-party services:\n\n- Firebase (Google) for authentication, data storage, and analytics\n- RevenueCat for subscription management\n- OpenAI for AI-powered features\n- Expo for push notifications\n\nEach service has its own privacy policy governing data handling.',
  },
  {
    title: '5. Your Rights',
    body: 'You have the right to:\n\n- Access your personal data\n- Export your recipes and data\n- Request deletion of your account and data\n- Opt out of non-essential communications\n- Control your profile visibility (public/private)\n\nTo exercise these rights, contact us at support@example.com.',
  },
  {
    title: '6. Data Sharing',
    body: 'We do not sell your personal data to third parties. We only share data when:\n\n- You explicitly choose to share recipes or your profile publicly\n- Required by law or legal process\n- Necessary to protect the safety of our users',
  },
  {
    title: '7. Contact',
    body: 'For privacy-related questions or requests, contact us at:\nsupport@example.com',
  },
];

export default function TermsPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('terms');

  const sections = activeTab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={activeTab === 'terms' ? C.terracotta : C.light}
          />
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={activeTab === 'privacy' ? C.terracotta : C.light}
          />
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        key={activeTab}
      >
        {/* Last Updated */}
        <View style={styles.updatedRow}>
          <Ionicons name="calendar-outline" size={14} color={C.light} />
          <Text style={styles.updatedText}>Last updated: February 2026</Text>
        </View>

        {/* Sections */}
        {sections.map((section, index) => (
          <View key={`${activeTab}-${index}`} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        {/* Contact Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Questions about our {activeTab === 'terms' ? 'terms' : 'privacy practices'}?
          </Text>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => Linking.openURL('mailto:support@example.com?subject=Legal%20Inquiry')}
            activeOpacity={0.8}
          >
            <Ionicons name="mail-outline" size={16} color={C.terracotta} />
            <Text style={styles.footerBtnText}>Contact Us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
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

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
  },
  tabText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.light,
  },
  tabTextActive: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Updated
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  updatedText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.light,
  },

  // Section
  sectionCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 10,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
    marginBottom: 10,
  },
  sectionBody: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: C.muted,
    lineHeight: 21,
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    gap: 12,
  },
  footerText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.light,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
  },
  footerBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.terracotta,
  },
});
