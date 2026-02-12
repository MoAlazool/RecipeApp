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
  olive: '#6B8E23',
  muted: '#8A8578',
  cardBg: '#F5F3EE',
};

export type LimitType = 'scan' | 'ai_chat' | 'recipe' | 'week_planner';

interface UsageLimitSheetProps {
  limitType: LimitType;
  used: number;
  total: number;
}

const LIMIT_CONFIG: Record<
  LimitType,
  { icon: string; color: string; title: string; todayDesc: string }
> = {
  scan: {
    icon: 'scan-outline',
    color: '#D4AF37',
    title: 'No scans left',
    todayDesc: 'Unlimited scans & all Pro features',
  },
  ai_chat: {
    icon: 'chatbubbles-outline',
    color: '#6B8E23',
    title: 'No chats left',
    todayDesc: 'Unlimited AI chats & all Pro features',
  },
  recipe: {
    icon: 'link',
    color: '#C66E4E',
    title: 'No recipes left',
    todayDesc: 'Unlimited recipes & all Pro features',
  },
  week_planner: {
    icon: 'calendar-outline',
    color: '#D4AF37',
    title: 'Planner is Pro only',
    todayDesc: 'Full planner access & all Pro features',
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
    const showUsageBar = limitType !== 'week_planner';

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
          <View style={[styles.iconWrap, { backgroundColor: `${config.color}14` }]}>
            <Ionicons name={config.icon as any} size={28} color={config.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{config.title}</Text>

          {/* Usage bar */}
          {showUsageBar && (
            <View style={styles.usageRow}>
              <View style={styles.usageBarBg}>
                <View
                  style={[
                    styles.usageBarFill,
                    { width: `${progress * 100}%` as any, backgroundColor: config.color },
                  ]}
                />
              </View>
              <Text style={styles.usageText}>
                {used}/{total}
              </Text>
            </View>
          )}

          {/* Subtitle */}
          <Text style={styles.subtitle}>Try Pro free for 7 days</Text>

          {/* Timeline */}
          <View style={styles.timeline}>
            {/* Today */}
            <View style={styles.timelineRow}>
              <View style={styles.dotCol}>
                <View style={[styles.dot, { backgroundColor: C.olive }]} />
                <View style={styles.line} />
              </View>
              <View style={styles.timelineBody}>
                <Text style={styles.dayLabel}>Today</Text>
                <Text style={styles.dayDesc}>{config.todayDesc}</Text>
              </View>
              <Ionicons name="lock-open-outline" size={14} color={C.olive} />
            </View>
            {/* Day 5 */}
            <View style={styles.timelineRow}>
              <View style={styles.dotCol}>
                <View style={[styles.dot, { backgroundColor: C.gold }]} />
                <View style={styles.line} />
              </View>
              <View style={styles.timelineBody}>
                <Text style={styles.dayLabel}>Day 5</Text>
                <Text style={styles.dayDesc}>We'll send you a reminder</Text>
              </View>
              <Ionicons name="notifications-outline" size={14} color={C.gold} />
            </View>
            {/* Day 7 */}
            <View style={styles.timelineRow}>
              <View style={styles.dotCol}>
                <View style={styles.dot} />
              </View>
              <View style={styles.timelineBody}>
                <Text style={styles.dayLabel}>Day 7</Text>
                <Text style={styles.dayDesc}>Cancel anytime before</Text>
              </View>
              <Ionicons name="card-outline" size={14} color={C.muted} />
            </View>
          </View>

          {/* CTA */}
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleUpgrade}
          >
            <Ionicons name="diamond" size={17} color="#FFF" />
            <Text style={styles.ctaText}>Start free trial</Text>
          </Pressable>

          {/* Guarantee */}
          <View style={styles.guarantee}>
            <Ionicons name="shield-checkmark" size={12} color={C.olive} />
            <Text style={styles.guaranteeText}>No charge today</Text>
          </View>

          {/* Dismiss */}
          <Pressable style={styles.dismiss} onPress={handleDismiss}>
            <Text style={styles.dismissText}>Maybe later</Text>
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

  // ── Icon ──
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  // ── Title ──
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 21,
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 6,
  },

  // ── Usage bar ──
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  usageBarBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.cardBg,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.muted,
  },

  // ── Subtitle ──
  subtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginBottom: 14,
  },

  // ── Timeline ──
  timeline: {
    width: '100%',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotCol: {
    width: 16,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(26, 21, 16, 0.12)',
  },
  line: {
    width: 1.5,
    height: 20,
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
    marginVertical: 1,
  },
  timelineBody: {
    flex: 1,
    marginLeft: 10,
  },
  dayLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: C.charcoal,
  },
  dayDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: C.muted,
    lineHeight: 15,
  },

  // ── CTA ──
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 20,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },

  // ── Guarantee ──
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  guaranteeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: C.muted,
  },

  // ── Dismiss ──
  dismiss: {
    paddingVertical: 8,
  },
  dismissText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
  },
});
