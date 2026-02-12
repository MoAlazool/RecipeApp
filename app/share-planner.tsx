import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  SectionList,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { userService } from '@/services/user.service';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import { useMealPlanStore } from '@/stores/mealPlanStore';
import type {
  UserProfile,
  Conversation,
  SharedMealPlanData,
  SharedMealPlanMeal,
  SharedMealPlanDaySummary,
  PlannerMealSlot,
} from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

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

const AVATAR_COLORS = [
  '#C66E4E', '#D4AF37', '#8A8578', '#6B8E7B', '#A67B5B', '#9B7CB8', '#5C8A9E', '#B8836A',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLOT_ICONS: Record<PlannerMealSlot, { icon: string; color: string }> = {
  breakfast: { icon: 'sunny', color: '#FB923C' },
  lunch: { icon: 'restaurant', color: '#4ADE80' },
  dinner: { icon: 'moon', color: '#60A5FA' },
  snack: { icon: 'cafe', color: '#D4AF37' },
};

const SLOT_LABELS: Record<PlannerMealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

// ============================================================
// HELPERS
// ============================================================

const getInitials = (name?: string): string => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const getAvatarColor = (id: string): string => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

// ============================================================
// SHARE ITEM
// ============================================================

interface ShareTargetItem {
  id: string;
  name: string;
  subtitle?: string;
  avatarUrl?: string;
  lastMessageAt?: string;
  isGroup: boolean;
}

function ShareItem({
  item,
  onPress,
  isSending,
}: {
  item: ShareTargetItem;
  onPress: () => void;
  isSending: boolean;
}) {
  const avatarColor = getAvatarColor(item.id);

  return (
    <Pressable
      style={({ pressed }) => [styles.shareItem, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={isSending}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
        ) : item.isGroup ? (
          <Ionicons name="people" size={18} color="#FFF" />
        ) : (
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        )}
      </View>
      <View style={styles.shareItemContent}>
        <Text style={styles.shareItemName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
        {item.subtitle && <Text style={styles.shareItemSub}>{item.subtitle}</Text>}
      </View>
      {isSending ? (
        <ActivityIndicator size="small" color={C.gold} />
      ) : (
        <View style={styles.sendBtn}>
          <Ionicons name="paper-plane" size={14} color="#FFF" />
        </View>
      )}
    </Pressable>
  );
}

// ============================================================
// DAY PLAN PREVIEW
// ============================================================

function DayPlanPreview({ planData }: { planData: SharedMealPlanData }) {
  if (planData.type !== 'day' || !planData.meals) return null;

  return (
    <View style={styles.previewCard}>
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.08)', 'rgba(212, 175, 55, 0)']}
        style={styles.previewGradient}
      />
      <View style={styles.previewHeader}>
        <View style={styles.previewBadge}>
          <Ionicons name="calendar" size={12} color="#FFF" />
          <Text style={styles.previewBadgeText}>Day Plan</Text>
        </View>
        <Text style={styles.previewTitle}>{planData.dayLabel}</Text>
      </View>

      <View style={styles.previewMeals}>
        {planData.meals.map((meal) => {
          const slotInfo = SLOT_ICONS[meal.slot];
          return (
            <View key={meal.slot} style={styles.previewMealRow}>
              <View style={[styles.previewMealDot, { backgroundColor: slotInfo.color }]} />
              <Ionicons
                name={slotInfo.icon as any}
                size={14}
                color={slotInfo.color}
                style={{ width: 20 }}
              />
              <Text style={styles.previewMealTitle} numberOfLines={1}>{meal.title}</Text>
              {meal.timeMinutes != null && (
                <Text style={styles.previewMealTime}>{meal.timeMinutes}m</Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.previewStats}>
        <Text style={styles.previewStatText}>
          {planData.totalMeals} meal{planData.totalMeals !== 1 ? 's' : ''}
        </Text>
        {planData.totalTimeMinutes != null && planData.totalTimeMinutes > 0 && (
          <>
            <Text style={styles.previewStatDot}> · </Text>
            <Text style={styles.previewStatText}>{planData.totalTimeMinutes} min total</Text>
          </>
        )}
        {planData.totalCalories != null && planData.totalCalories > 0 && (
          <>
            <Text style={styles.previewStatDot}> · </Text>
            <Text style={styles.previewStatText}>~{planData.totalCalories} cal</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ============================================================
// WEEK PLAN PREVIEW
// ============================================================

function WeekPlanPreview({ planData }: { planData: SharedMealPlanData }) {
  if (planData.type !== 'week' || !planData.daySummaries) return null;

  return (
    <View style={styles.previewCard}>
      <LinearGradient
        colors={['rgba(212, 175, 55, 0.08)', 'rgba(212, 175, 55, 0)']}
        style={styles.previewGradient}
      />
      <View style={styles.previewHeader}>
        <View style={styles.previewBadge}>
          <Ionicons name="grid" size={12} color="#FFF" />
          <Text style={styles.previewBadgeText}>Week Plan</Text>
        </View>
        <Text style={styles.previewTitle}>
          {planData.startDate && planData.endDate
            ? `${format(new Date(planData.startDate + 'T12:00:00'), 'MMM d')} – ${format(new Date(planData.endDate + 'T12:00:00'), 'MMM d')}`
            : 'This Week'}
        </Text>
      </View>

      <View style={styles.weekGrid}>
        {planData.daySummaries.map((day, i) => (
          <View key={i} style={styles.weekDayCell}>
            <Text style={styles.weekDayLabel}>{day.dayLabel}</Text>
            <View style={styles.weekDots}>
              {[0, 1, 2, 3].map((dot) => (
                <View
                  key={dot}
                  style={[
                    styles.weekDot,
                    dot < day.filledSlots && styles.weekDotFilled,
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.previewStats}>
        <Text style={styles.previewStatText}>
          {planData.totalMeals} meal{planData.totalMeals !== 1 ? 's' : ''} planned
        </Text>
        {planData.totalCalories != null && planData.totalCalories > 0 && (
          <>
            <Text style={styles.previewStatDot}> · </Text>
            <Text style={styles.previewStatText}>~{planData.totalCalories} cal</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function SharePlannerScreen() {
  const { mode, date, weekOffset: weekOffsetParam } = useLocalSearchParams<{
    mode: 'day' | 'week';
    date?: string;
    weekOffset?: string;
  }>();

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    conversations,
    sendMealPlanMessage,
    sendMealPlanToConversation,
    fetchConversations,
  } = useMessagingStore();
  const { plans, getFilledSlotsCount, getDayNutrition } = useMealPlanStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try { await fetchConversations(); } catch {}
      setIsLoading(false);
    })();
  }, []);

  // ── Build the plan data ──
  const planData = useMemo<SharedMealPlanData>(() => {
    const slots: PlannerMealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

    if (mode === 'day' && date) {
      const dayPlan = plans[date];
      const meals: SharedMealPlanMeal[] = [];
      let totalCal = 0;
      let totalTime = 0;

      for (const s of slots) {
        const item = dayPlan?.[s];
        if (item) {
          const meal: SharedMealPlanMeal = { slot: s, title: item.title };
          if (item.thumbnailUrl) meal.thumbnailUrl = item.thumbnailUrl;
          if (item.totalTimeMinutes) meal.timeMinutes = item.totalTimeMinutes;
          if (item.calories) meal.calories = item.calories;
          if (item.recipeId) meal.recipeId = item.recipeId;
          if (item.difficulty) meal.difficulty = item.difficulty;
          meals.push(meal);
          totalCal += item.calories || 0;
          totalTime += item.totalTimeMinutes || 0;
        }
      }

      const dayLabel = (() => {
        try {
          return format(new Date(date + 'T12:00:00'), 'EEEE');
        } catch {
          return 'Today';
        }
      })();

      const result: SharedMealPlanData = {
        type: 'day',
        date,
        dayLabel,
        meals,
        totalMeals: meals.length,
      };
      if (totalCal > 0) result.totalCalories = totalCal;
      if (totalTime > 0) result.totalTimeMinutes = totalTime;
      return result;
    }

    // Week mode
    const offset = parseInt(weekOffsetParam || '0', 10);
    const center = addDays(new Date(), offset * 7);
    const startDate = addDays(center, -3);
    const endDate = addDays(center, 3);
    const summaries: SharedMealPlanDaySummary[] = [];
    let totalMeals = 0;
    let totalCal = 0;

    for (let i = 0; i < 7; i++) {
      const d = addDays(startDate, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const filled = getFilledSlotsCount(dateStr);
      const dayPlan = plans[dateStr];
      const dayMeals: SharedMealPlanMeal[] = [];
      for (const s of slots) {
        const item = dayPlan?.[s];
        if (item) {
          const meal: SharedMealPlanMeal = { slot: s, title: item.title };
          if (item.thumbnailUrl) meal.thumbnailUrl = item.thumbnailUrl;
          if (item.totalTimeMinutes) meal.timeMinutes = item.totalTimeMinutes;
          if (item.calories) meal.calories = item.calories;
          if (item.recipeId) meal.recipeId = item.recipeId;
          if (item.difficulty) meal.difficulty = item.difficulty;
          dayMeals.push(meal);
        }
      }
      const summary: SharedMealPlanDaySummary = { dayLabel: format(d, 'EEE'), date: dateStr, filledSlots: filled };
      if (dayMeals.length > 0) summary.meals = dayMeals;
      summaries.push(summary);
      totalMeals += filled;
      const nut = getDayNutrition(dateStr);
      totalCal += nut.totalCalories;
    }

    const weekResult: SharedMealPlanData = {
      type: 'week',
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      daySummaries: summaries,
      totalMeals,
    };
    if (totalCal > 0) weekResult.totalCalories = totalCal;
    return weekResult;
  }, [mode, date, weekOffsetParam, plans, getFilledSlotsCount, getDayNutrition]);

  // ── Conversation sections ──
  const recentDMs = useMemo<ShareTargetItem[]>(() => {
    if (!user) return [];
    return conversations
      .filter((c) => !c.is_group)
      .map((c) => {
        const other = c.participant_details.find((p) => p.user_id !== user.id);
        return {
          id: other?.user_id || '',
          name: other?.full_name || 'Unknown',
          subtitle: other?.username ? `@${other.username}` : undefined,
          avatarUrl: other?.avatar_url,
          lastMessageAt: c.last_message_at,
          isGroup: false,
        };
      })
      .filter((c) => c.id)
      .sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [conversations, user]);

  const groupChats = useMemo<ShareTargetItem[]>(() => {
    if (!user) return [];
    return conversations
      .filter((c) => c.is_group)
      .map((c) => ({
        id: c.id,
        name: c.group_name || 'Group',
        subtitle: `${c.participants.length} members`,
        avatarUrl: c.group_avatar_url,
        lastMessageAt: c.last_message_at,
        isGroup: true,
      }))
      .sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [conversations, user]);

  const sections = useMemo(() => {
    const result: { title: string; data: ShareTargetItem[] }[] = [];
    if (groupChats.length > 0) result.push({ title: 'Groups', data: groupChats });
    if (recentDMs.length > 0) result.push({ title: 'Recents', data: recentDMs });
    return result;
  }, [groupChats, recentDMs]);

  // ── Search ──
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) handleSearch();
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await userService.searchUsers(searchQuery);
      const existing = new Set(recentDMs.map((c) => c.id));
      setSearchResults(results.filter((u) => !existing.has(u.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, recentDMs]);

  // ── Send handlers ──
  const handleSendToUser = useCallback(
    async (userId: string) => {
      if (sendingToId) return;
      setSendingToId(userId);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sendMealPlanMessage(userId, planData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/chat/${userId}` as any);
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Failed to send', 'Something went wrong. Please try again.');
      } finally {
        setSendingToId(null);
      }
    },
    [planData, sendingToId, sendMealPlanMessage, router]
  );

  const handleSendToGroup = useCallback(
    async (conversationId: string) => {
      if (sendingToId) return;
      setSendingToId(conversationId);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sendMealPlanToConversation(conversationId, planData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/chat/[userId]', params: { conversationId } } as any);
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Failed to send', 'Something went wrong. Please try again.');
      } finally {
        setSendingToId(null);
      }
    },
    [planData, sendingToId, sendMealPlanToConversation, router]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={C.charcoal} />
        </Pressable>
        <Text style={styles.headerTitle}>Share Plan</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Plan preview */}
      {planData.type === 'day' ? (
        <DayPlanPreview planData={planData} />
      ) : (
        <WeekPlanPreview planData={planData} />
      )}

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={C.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people..."
          placeholderTextColor={C.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>

      {/* Results */}
      {searchQuery.length >= 2 ? (
        <View style={styles.listArea}>
          {isSearching ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={C.gold} />
          ) : searchResults.length > 0 ? (
            searchResults.map((u) => (
              <ShareItem
                key={u.id}
                item={{
                  id: u.id,
                  name: u.full_name || u.username || 'User',
                  subtitle: u.username ? `@${u.username}` : undefined,
                  avatarUrl: u.avatar_url,
                  isGroup: false,
                }}
                onPress={() => handleSendToUser(u.id)}
                isSending={sendingToId === u.id}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No users found</Text>
          )}
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={C.gold} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <ShareItem
              item={item}
              onPress={() =>
                item.isGroup
                  ? handleSendToGroup(item.id)
                  : handleSendToUser(item.id)
              }
              isSending={sendingToId === item.id}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No conversations yet</Text>
          }
        />
      )}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },

  // ── Preview card ──
  previewCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  previewGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  previewTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: C.charcoal,
  },

  // Day meals
  previewMeals: {
    gap: 8,
    marginBottom: 14,
  },
  previewMealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewMealDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  previewMealTitle: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
  },
  previewMealTime: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
  },

  // Week grid
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  weekDayCell: {
    alignItems: 'center',
    gap: 6,
  },
  weekDayLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.muted,
  },
  weekDots: {
    gap: 3,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
  },
  weekDotFilled: {
    backgroundColor: C.gold,
  },

  // Stats
  previewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 21, 16, 0.06)',
  },
  previewStatText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
  },
  previewStatDot: {
    color: C.muted,
  },

  // ── Search ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: C.ivory,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.06)',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.charcoal,
    padding: 0,
  },

  // ── List ──
  listArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 32,
  },

  // ── Share item ──
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFF',
  },
  shareItemContent: {
    flex: 1,
  },
  shareItemName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  shareItemSub: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
