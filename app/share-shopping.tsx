import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  SectionList,
  Image,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import { useShoppingStore, CATEGORY_ICONS } from '@/stores/shoppingStore';
import type {
  UserProfile,
  SharedShoppingListData,
  SharedShoppingItem,
  IngredientCategory,
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

const CATEGORY_COLORS: Record<string, string> = {
  produce: '#4ADE80',
  meat: '#F87171',
  dairy: '#60A5FA',
  pantry: '#FB923C',
  spices: '#F59E0B',
  frozen: '#818CF8',
  beverage: '#A78BFA',
  condiment: '#F472B6',
  other: '#9CA3AF',
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
// GROCERY LIST PREVIEW
// ============================================================

function GroceryPreview({ data }: { data: SharedShoppingListData }) {
  const uncheckedItems = data.items.filter(i => !i.is_checked);
  const displayItems = uncheckedItems.slice(0, 6);
  const remaining = uncheckedItems.length - displayItems.length;

  return (
    <View style={styles.previewCard}>
      <LinearGradient
        colors={['rgba(198, 110, 78, 0.08)', 'rgba(198, 110, 78, 0)']}
        style={styles.previewGradient}
      />
      <View style={styles.previewHeader}>
        <View style={styles.previewBadge}>
          <Ionicons name="cart" size={12} color="#FFF" />
          <Text style={styles.previewBadgeText}>Grocery List</Text>
        </View>
        <Text style={styles.previewTitle}>{data.listName}</Text>
      </View>

      {/* Items preview */}
      <View style={styles.previewItems}>
        {displayItems.map((item, i) => {
          const catColor = CATEGORY_COLORS[item.category] || C.muted;
          return (
            <View key={i} style={styles.previewItemRow}>
              <View style={[styles.previewItemDot, { backgroundColor: catColor }]} />
              <Text style={styles.previewItemName} numberOfLines={1}>{item.name}</Text>
              {item.amount != null && (
                <Text style={styles.previewItemAmount}>
                  {item.amount}{item.unit ? ` ${item.unit}` : ''}
                </Text>
              )}
            </View>
          );
        })}
        {remaining > 0 && (
          <Text style={styles.previewMore}>+{remaining} more items</Text>
        )}
      </View>

      {/* Category pills */}
      {data.categories.length > 0 && (
        <View style={styles.previewCategories}>
          {data.categories.slice(0, 4).map((cat) => (
            <View key={cat.name} style={[styles.categoryPill, { backgroundColor: `${CATEGORY_COLORS[cat.name] || C.muted}15` }]}>
              <Ionicons
                name={(CATEGORY_ICONS[cat.name] || 'ellipsis-horizontal') as any}
                size={11}
                color={CATEGORY_COLORS[cat.name] || C.muted}
              />
              <Text style={[styles.categoryPillText, { color: CATEGORY_COLORS[cat.name] || C.muted }]}>
                {cat.count}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats */}
      <View style={styles.previewStats}>
        <Text style={styles.previewStatText}>
          {data.totalItems} item{data.totalItems !== 1 ? 's' : ''}
        </Text>
        {data.checkedItems > 0 && (
          <>
            <Text style={styles.previewStatDot}> · </Text>
            <Text style={styles.previewStatText}>{data.checkedItems} done</Text>
          </>
        )}
      </View>
    </View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function ShareShoppingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    conversations,
    sendShoppingListMessage,
    sendShoppingListToConversation,
    fetchConversations,
  } = useMessagingStore();
  const { items } = useShoppingStore();

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

  // Build shopping list data
  const shoppingData = useMemo<SharedShoppingListData>(() => {
    const checkedCount = items.filter(i => i.is_checked).length;

    const categoryMap = new Map<IngredientCategory, number>();
    items.forEach(item => {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    });
    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const sharedItems: SharedShoppingItem[] = items.map(item => ({
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      category: item.category,
      is_checked: item.is_checked,
      recipe_name: item.recipe_name,
    }));

    return {
      listName: 'Grocery List',
      totalItems: items.length,
      checkedItems: checkedCount,
      items: sharedItems,
      categories,
    };
  }, [items]);

  // Conversation sections
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

  // Search
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

  // Send handlers
  const handleSendToUser = useCallback(
    async (userId: string) => {
      if (sendingToId) return;
      setSendingToId(userId);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sendShoppingListMessage(userId, shoppingData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/chat/${userId}` as any);
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Failed to send', 'Something went wrong. Please try again.');
      } finally {
        setSendingToId(null);
      }
    },
    [shoppingData, sendingToId, sendShoppingListMessage, router]
  );

  const handleSendToGroup = useCallback(
    async (conversationId: string) => {
      if (sendingToId) return;
      setSendingToId(conversationId);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await sendShoppingListToConversation(conversationId, shoppingData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: '/chat/[userId]', params: { conversationId } } as any);
      } catch (e) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Failed to send', 'Something went wrong. Please try again.');
      } finally {
        setSendingToId(null);
      }
    },
    [shoppingData, sendingToId, sendShoppingListToConversation, router]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={C.charcoal} />
        </Pressable>
        <Text style={styles.headerTitle}>Share List</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Preview */}
      <GroceryPreview data={shoppingData} />

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

  // Preview card
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
    backgroundColor: C.terracotta,
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

  // Items
  previewItems: {
    gap: 8,
    marginBottom: 14,
  },
  previewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewItemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  previewItemName: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
  },
  previewItemAmount: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
  },
  previewMore: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
    paddingLeft: 12,
  },

  // Categories
  previewCategories: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryPillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
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

  // Search
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

  // List
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

  // Share item
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
