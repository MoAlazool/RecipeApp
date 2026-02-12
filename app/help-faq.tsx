import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  bg: '#FAFAF8',
  white: '#FFFFFF',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  gold: '#D4AF37',
  muted: '#8A8578',
  light: '#B5B0A7',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_SECTIONS: { title: string; icon: keyof typeof Ionicons.glyphMap; items: FAQItem[] }[] = [
  {
    title: 'Getting Started',
    icon: 'rocket-outline',
    items: [
      {
        question: 'How do I save a recipe?',
        answer: 'You can save recipes by pasting a link from TikTok, Instagram, YouTube, or any recipe website. Tap "Paste Link" on the home screen, and we\'ll extract the recipe automatically.',
      },
      {
        question: 'How does fridge scanning work?',
        answer: 'Tap "Scan Fridge" and point your camera at your fridge or ingredients. Our AI will identify what you have and suggest recipes you can make with those ingredients.',
      },
      {
        question: 'Can I scan recipes from a cookbook?',
        answer: 'Yes! Tap "Scan Book" and photograph any recipe page. Our AI will extract the ingredients, steps, and details into a clean digital recipe.',
      },
    ],
  },
  {
    title: 'EITO Pro',
    icon: 'star-outline',
    items: [
      {
        question: 'What do I get with EITO Pro?',
        answer: 'EITO Pro gives you unlimited recipe extractions, fridge scans, AI chef chats, saved recipes, plus premium features like smart ingredient substitutions, detailed nutrition info, hands-free voice control, meal planning, and family sharing.',
      },
      {
        question: 'How do I manage my subscription?',
        answer: 'Go to Profile > Subscription > Manage Subscription. This will take you to your App Store or Google Play subscription settings where you can change or cancel your plan.',
      },
      {
        question: 'Can I restore a previous purchase?',
        answer: 'Yes. Go to Profile > Subscription and tap "Restore Purchases". Make sure you\'re signed in with the same Apple ID or Google account used for the original purchase.',
      },
      {
        question: 'What are the free plan limits?',
        answer: 'Free users get 5 recipe extractions, 3 fridge scans, and 20 AI chef chats per week. Limits reset every 7 days.',
      },
    ],
  },
  {
    title: 'AI Chef',
    icon: 'chatbubbles-outline',
    items: [
      {
        question: 'What can I ask the AI Chef?',
        answer: 'Ask anything about cooking! Get ingredient substitutions, cooking tips, technique explanations, dietary adaptations, or have a recipe modified to your preferences.',
      },
      {
        question: 'Is the AI Chef available offline?',
        answer: 'The AI Chef requires an internet connection to generate responses. Your saved recipes are available offline.',
      },
    ],
  },
  {
    title: 'Account & Data',
    icon: 'shield-outline',
    items: [
      {
        question: 'How do I delete my account?',
        answer: 'Go to Profile > Settings. Contact us via the support email and request account deletion. We\'ll process your request and remove all your data within 30 days.',
      },
      {
        question: 'Are my recipes synced across devices?',
        answer: 'Yes! As long as you\'re signed in with the same account, your recipes, cookbooks, and preferences sync automatically across all your devices.',
      },
      {
        question: 'Is my data private?',
        answer: 'Your recipes and data are private by default. You control what to share. We never sell your personal data. See our Privacy Policy for full details.',
      },
    ],
  },
];

export default function HelpFAQScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedSection, setExpandedSection] = useState<number | null>(0);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const toggleSection = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSection(expandedSection === index ? null : index);
    setExpandedItem(null);
  };

  const toggleItem = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedItem(expandedItem === key ? null : key);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="help-buoy-outline" size={32} color={C.terracotta} />
          </View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSubtitle}>
            Find answers to common questions below
          </Text>
        </View>

        {/* FAQ Sections */}
        {FAQ_SECTIONS.map((section, sectionIndex) => {
          const isSectionOpen = expandedSection === sectionIndex;
          return (
            <View key={section.title} style={styles.sectionCard}>
              {/* Section Header */}
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(sectionIndex)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionIconWrap}>
                  <Ionicons name={section.icon} size={18} color={C.terracotta} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Ionicons
                  name={isSectionOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={C.light}
                />
              </TouchableOpacity>

              {/* Section Items */}
              {isSectionOpen && section.items.map((item, itemIndex) => {
                const itemKey = `${sectionIndex}-${itemIndex}`;
                const isItemOpen = expandedItem === itemKey;
                return (
                  <View key={itemKey}>
                    <TouchableOpacity
                      style={[styles.faqRow, itemIndex === 0 && styles.faqRowFirst]}
                      onPress={() => toggleItem(itemKey)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.faqQuestion}>{item.question}</Text>
                      <Ionicons
                        name={isItemOpen ? 'remove-circle-outline' : 'add-circle-outline'}
                        size={20}
                        color={isItemOpen ? C.terracotta : C.light}
                      />
                    </TouchableOpacity>
                    {isItemOpen && (
                      <View style={styles.faqAnswerWrap}>
                        <Text style={styles.faqAnswer}>{item.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Contact Section */}
        <Text style={styles.contactLabel}>Still need help?</Text>
        <View style={styles.contactCard}>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL('mailto:support@example.com?subject=Support%20Request')}
            activeOpacity={0.7}
          >
            <View style={[styles.contactIconWrap, { backgroundColor: 'rgba(198, 110, 78, 0.08)' }]}>
              <Ionicons name="mail-outline" size={20} color={C.terracotta} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactSubtitle}>support@example.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.light} />
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
  content: {
    paddingHorizontal: 20,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: C.charcoal,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.light,
  },

  // Section Card
  sectionCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },

  // FAQ Items
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
  },
  faqRowFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.hairline,
  },
  faqQuestion: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
    lineHeight: 20,
  },
  faqAnswerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 0,
  },
  faqAnswer: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },

  // Contact
  contactLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.light,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  contactCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  contactSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.light,
  },
});
