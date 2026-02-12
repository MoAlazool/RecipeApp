import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useUsageStore } from '@/stores/usageStore';
import { FREE_PLAN_LIMITS } from '@/utils/types';

const C = {
  bg: '#FAFAF8',
  white: '#FFFFFF',
  charcoal: '#1A1510',
  terracotta: '#C66E4E',
  gold: '#D4AF37',
  olive: '#6B8E23',
  muted: '#8A8578',
  light: '#B5B0A7',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

export default function UsageDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const isPremium = user?.is_premium ?? false;

  const recipesUsed = useUsageStore((s) => s.recipesUsed);
  const scansUsed = useUsageStore((s) => s.scansUsed);
  const chatsUsed = useUsageStore((s) => s.chatsUsed);
  const daysUntilReset = useUsageStore((s) => s.getDaysUntilReset());
  const syncFromFirebase = useUsageStore((s) => s.syncFromFirebase);

  const [refreshing, setRefreshing] = useState(false);

  const cards = [
    {
      icon: 'restaurant-outline' as const,
      label: 'Recipe Extractions',
      used: recipesUsed,
      total: FREE_PLAN_LIMITS.recipes_per_week,
      color: C.terracotta,
    },
    {
      icon: 'scan-outline' as const,
      label: 'Fridge Scans',
      used: scansUsed,
      total: FREE_PLAN_LIMITS.scans_per_week,
      color: C.gold,
    },
    {
      icon: 'chatbubbles-outline' as const,
      label: 'AI Chef Chats',
      used: chatsUsed,
      total: FREE_PLAN_LIMITS.ai_chats_per_week,
      color: C.olive,
    },
  ];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncFromFirebase();
    setRefreshing(false);
  }, [syncFromFirebase]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usage</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.terracotta} />
        }
      >
        {/* Usage Cards */}
        {cards.map((card) => {
          const remaining = Math.max(0, card.total - card.used);
          const progress = isPremium ? 1 : Math.min(remaining / card.total, 1);
          return (
            <View key={card.label} style={styles.usageCard}>
              <View style={styles.usageCardHeader}>
                <View style={[styles.usageIconWrap, { backgroundColor: `${card.color}15` }]}>
                  <Ionicons name={card.icon} size={20} color={card.color} />
                </View>
                <View style={styles.usageCardInfo}>
                  <Text style={styles.usageCardLabel}>{card.label}</Text>
                  {isPremium ? (
                    <View style={styles.infinityRow}>
                      <Ionicons name="infinite" size={20} color={card.color} />
                      <Text style={[styles.usageCardCount, { color: card.color }]}>Unlimited</Text>
                    </View>
                  ) : (
                    <Text style={styles.usageCardCount}>
                      {remaining} / {card.total} remaining
                    </Text>
                  )}
                </View>
                {!isPremium && (
                  <Text style={[styles.remainingBadge, { color: card.color }]}>
                    {remaining} left
                  </Text>
                )}
              </View>
              {!isPremium && (
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress * 100}%` as any, backgroundColor: card.color },
                    ]}
                  />
                </View>
              )}
            </View>
          );
        })}

        {/* Reset Countdown */}
        {!isPremium && (
          <View style={styles.resetCard}>
            <Ionicons name="time-outline" size={18} color={C.muted} />
            <Text style={styles.resetText}>
              {daysUntilReset === 0 ? 'Resets today' : `Resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}`}
            </Text>
          </View>
        )}

        {/* Upgrade CTA */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => router.push('/paywall')}
            activeOpacity={0.85}
          >
            <Ionicons name="diamond" size={18} color="#FFF" />
            <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        )}
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
    paddingTop: 12,
  },

  // Usage Cards
  usageCard: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  usageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  usageIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageCardInfo: {
    flex: 1,
    gap: 2,
  },
  usageCardLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  usageCardCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
  },
  infinityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  remainingBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Reset
  resetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  resetText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
  },

  // Upgrade
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.terracotta,
    paddingVertical: 16,
    borderRadius: 22,
    marginTop: 8,
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
});
