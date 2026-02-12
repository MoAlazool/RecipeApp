import React, { forwardRef, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  cardBg: '#F5F3EE',
  background: '#FAFAF8',
};

export type LimitType = 'scan' | 'ai_chat' | 'recipe' | 'week_planner';

interface UsageLimitSheetProps {
  limitType: LimitType;
  used: number;
  total: number;
}

const LIMIT_CONFIG: Record<LimitType, { icon: string; title: string; resetLabel: string }> = {
  scan: {
    icon: 'scan-outline',
    title: "You've used all your scans this week",
    resetLabel: 'Resets weekly',
  },
  ai_chat: {
    icon: 'chatbubbles-outline',
    title: 'AI Chef weekly limit reached',
    resetLabel: 'Resets weekly',
  },
  recipe: {
    icon: 'restaurant-outline',
    title: "You've used all your recipe generations this week",
    resetLabel: 'Resets weekly',
  },
  week_planner: {
    icon: 'calendar-outline',
    title: 'Week planner is a Pro feature',
    resetLabel: 'Upgrade to unlock',
  },
};

const UsageLimitSheet = forwardRef<BottomSheetModal, UsageLimitSheetProps>(
  ({ limitType, used, total }, ref) => {
    const router = useRouter();
    const config = LIMIT_CONFIG[limitType];

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    const handleUpgrade = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
      setTimeout(() => router.push('/paywall'), 300);
    };

    const handleDismiss = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
    };

    const progress = total > 0 ? Math.min(used / total, 1) : 1;

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(26, 21, 16, 0.15)', width: 40 }}
        backgroundStyle={{ borderRadius: 28, backgroundColor: C.ivory }}
      >
        <BottomSheetView style={styles.content}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Ionicons name={config.icon as any} size={32} color={C.terracotta} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{config.title}</Text>

          {/* Usage bar (not shown for week_planner) */}
          {limitType !== 'week_planner' && (
            <View style={styles.usageSection}>
              <View style={styles.usageBarBg}>
                <View style={[styles.usageBarFill, { width: `${progress * 100}%` as any }]} />
              </View>
              <Text style={styles.usageText}>
                {used} / {total} used
              </Text>
            </View>
          )}

          {/* Reset info */}
          <Text style={styles.resetText}>{config.resetLabel}</Text>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
            onPress={handleUpgrade}
          >
            <Ionicons name="diamond" size={18} color="#FFF" />
            <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
          </Pressable>

          {/* Dismiss */}
          <Pressable style={styles.dismissBtn} onPress={handleDismiss}>
            <Text style={styles.dismissText}>OK, got it</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

UsageLimitSheet.displayName = 'UsageLimitSheet';
export default UsageLimitSheet;

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 20,
  },
  usageSection: {
    width: '100%',
    marginBottom: 8,
  },
  usageBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.cardBg,
    overflow: 'hidden',
    marginBottom: 8,
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: C.terracotta,
  },
  usageText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
  },
  resetText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
    marginBottom: 24,
    marginTop: 4,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.terracotta,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 22,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 12,
  },
  upgradeBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  dismissBtn: {
    paddingVertical: 10,
  },
  dismissText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.muted,
  },
});
