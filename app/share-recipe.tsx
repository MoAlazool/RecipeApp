import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile, Conversation } from '@/utils/types';

// ============================================================
// DESIGN TOKENS — Michelin-Star Luxury
// ============================================================

const C = {
  ivory: '#F9F7F2',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  goldTint: 'rgba(212, 175, 55, 0.10)',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(249, 247, 242, 0.85)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
};

// Get initials from name
const getInitials = (name?: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Warm avatar palette matching luxury feel
const AVATAR_COLORS = [
  '#C66E4E', '#D4AF37', '#8A8578', '#6B8E7B', '#A67B5B', '#9B7CB8', '#5C8A9E', '#B8836A',
];

const getAvatarColor = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

interface ShareItemProps {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  isGroup?: boolean;
  onPress: () => void;
  isSending: boolean;
}

const ShareItem = ({ id, name, username, avatarUrl, isGroup, onPress, isSending }: ShareItemProps) => {
  const avatarColor = getAvatarColor(id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.userItem,
        pressed && styles.userItemPressed,
      ]}
      onPress={onPress}
      disabled={isSending}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : isGroup ? (
          <Ionicons name="people" size={18} color="#FFFFFF" />
        ) : (
          <Text style={styles.avatarText}>{getInitials(name)}</Text>
        )}
      </View>

      <View style={styles.userContent}>
        <Text style={styles.userName} numberOfLines={1}>
          {name || 'Unknown User'}
        </Text>
        {username && (
          <Text style={styles.userUsername}>
            {isGroup ? username : `@${username}`}
          </Text>
        )}
      </View>

      {isSending ? (
        <ActivityIndicator size="small" color={C.gold} />
      ) : (
        <View style={styles.sendIcon}>
          <Ionicons name="paper-plane" size={15} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
};

export default function ShareRecipeScreen() {
  const { recipeId, recipeTitle, recipeThumbnail: encodedThumbnail, recipeTime, recipeDifficulty } =
    useLocalSearchParams<{
      recipeId: string;
      recipeTitle: string;
      recipeThumbnail?: string;
      recipeTime?: string;
      recipeDifficulty?: string;
    }>();

  // Decode the thumbnail URL (was encoded to preserve special characters in route params)
  const recipeThumbnail = encodedThumbnail ? decodeURIComponent(encodedThumbnail) : undefined;

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { conversations, sendRecipeMessage, sendMessageToConversation, fetchConversations } = useMessagingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // Fetch conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      setIsLoadingConversations(true);
      try {
        await fetchConversations();
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setIsLoadingConversations(false);
      }
    };
    loadConversations();
  }, []);

  // Get recent DM chats
  const recentDMs = useMemo(() => {
    if (!user) return [];

    return conversations
      .filter(conv => !conv.is_group)
      .map(conv => {
        const otherParticipant = conv.participant_details.find(
          p => p.user_id !== user.id
        );
        return {
          id: otherParticipant?.user_id || '',
          name: otherParticipant?.full_name || 'Unknown',
          subtitle: otherParticipant?.username ? `${otherParticipant.username}` : undefined,
          avatarUrl: otherParticipant?.avatar_url,
          lastMessageAt: conv.last_message_at,
          isGroup: false,
        };
      })
      .filter(chat => chat.id)
      .sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 10);
  }, [conversations, user]);

  // Get group chats
  const groupChats = useMemo(() => {
    if (!user) return [];

    return conversations
      .filter(conv => conv.is_group)
      .map(conv => ({
        id: conv.id,
        name: conv.group_name || 'Group',
        subtitle: `${conv.participants.length} members`,
        avatarUrl: conv.group_avatar_url,
        lastMessageAt: conv.last_message_at,
        isGroup: true,
      }))
      .sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 10);
  }, [conversations, user]);

  // Combined sections for SectionList
  const sections = useMemo(() => {
    const result = [];
    if (groupChats.length > 0) {
      result.push({ title: 'Groups', data: groupChats });
    }
    if (recentDMs.length > 0) {
      result.push({ title: 'Recents', data: recentDMs });
    }
    return result;
  }, [groupChats, recentDMs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await userService.searchUsers(searchQuery);
      const recentUserIds = new Set(recentDMs.map(c => c.id));
      setSearchResults(results.filter(u => !recentUserIds.has(u.id)));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, recentDMs]);

  // Share to a DM (user)
  const handleShareToUser = useCallback(async (userId: string) => {
    if (!recipeId || !recipeTitle || sendingToId) return;

    setSendingToId(userId);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await sendRecipeMessage(userId, {
        id: recipeId,
        title: recipeTitle,
        thumbnail_url: recipeThumbnail,
        total_time_minutes: recipeTime ? parseInt(recipeTime, 10) : undefined,
        difficulty: recipeDifficulty,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/chat/${userId}` as any);
    } catch (error) {
      console.error('Error sharing recipe:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSendingToId(null);
    }
  }, [recipeId, recipeTitle, recipeThumbnail, recipeTime, recipeDifficulty, sendRecipeMessage, router, sendingToId]);

  // Share to a group
  const handleShareToGroup = useCallback(async (conversationId: string) => {
    if (!recipeId || !recipeTitle || sendingToId) return;

    setSendingToId(conversationId);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { messagingService } = await import('@/services/messaging.service');
      await messagingService.sendMessageToConversation(
        conversationId,
        `Check out this recipe: ${recipeTitle}`,
        'recipe',
        {
          id: recipeId,
          title: recipeTitle,
          thumbnail_url: recipeThumbnail,
          total_time_minutes: recipeTime ? parseInt(recipeTime, 10) : undefined,
          difficulty: recipeDifficulty as any,
        }
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: '/chat/[userId]' as any,
        params: { userId: 'group', conversationId },
      });
    } catch (error) {
      console.error('Error sharing recipe to group:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSendingToId(null);
    }
  }, [recipeId, recipeTitle, recipeThumbnail, recipeTime, recipeDifficulty, router, sendingToId]);

  const handleShare = useCallback((id: string, isGroup: boolean) => {
    if (isGroup) {
      handleShareToGroup(id);
    } else {
      handleShareToUser(id);
    }
  }, [handleShareToGroup, handleShareToUser]);

  const isSearchMode = searchQuery.trim().length > 0;

  // Filter local groups + DMs by search query
  const filteredSections = useMemo(() => {
    if (!isSearchMode) return [];
    const q = searchQuery.trim().toLowerCase();
    const result = [];

    const matchedGroups = groupChats.filter(g =>
      g.name.toLowerCase().includes(q) || g.subtitle?.toLowerCase().includes(q)
    );
    if (matchedGroups.length > 0) {
      result.push({ title: 'Groups', data: matchedGroups });
    }

    const matchedDMs = recentDMs.filter(d =>
      d.name.toLowerCase().includes(q) || d.subtitle?.toLowerCase().includes(q)
    );
    if (matchedDMs.length > 0) {
      result.push({ title: 'Recents', data: matchedDMs });
    }

    if (searchResults.length > 0) {
      result.push({
        title: 'People',
        data: searchResults.map(u => ({
          id: u.id,
          name: u.full_name || 'Unknown',
          subtitle: u.username,
          avatarUrl: u.avatar_url,
          isGroup: false,
          lastMessageAt: null,
        })),
      });
    }

    return result;
  }, [isSearchMode, searchQuery, groupChats, recentDMs, searchResults]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Send Recipe</Text>
      </View>

      {/* Recipe Preview Card */}
      <View style={styles.previewCard}>
        {recipeThumbnail ? (
          <Image source={{ uri: recipeThumbnail }} style={styles.previewImage} />
        ) : (
          <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
            <Ionicons name="restaurant" size={22} color={C.gold} />
          </View>
        )}
        <View style={styles.previewInfo}>
          <Text style={styles.previewTitle} numberOfLines={2}>{recipeTitle}</Text>
          <View style={styles.previewMeta}>
            {recipeTime && (
              <View style={styles.previewBadge}>
                <Ionicons name="time-outline" size={12} color={C.gold} />
                <Text style={styles.previewBadgeText}>{recipeTime}m</Text>
              </View>
            )}
            {recipeDifficulty && (
              <View style={styles.previewBadge}>
                <Ionicons name="speedometer-outline" size={12} color={C.gold} />
                <Text style={styles.previewBadgeText}>{recipeDifficulty}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={C.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people or groups..."
            placeholderTextColor={C.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoadingConversations && !isSearchMode ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : isSearchMode ? (
        isSearching && filteredSections.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={C.gold} />
          </View>
        ) : filteredSections.length > 0 ? (
          <SectionList
            sections={filteredSections}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ShareItem
                id={item.id}
                name={item.name}
                username={item.subtitle}
                avatarUrl={item.avatarUrl}
                isGroup={item.isGroup}
                onPress={() => handleShare(item.id, item.isGroup)}
                isSending={sendingToId === item.id}
              />
            )}
            renderSectionHeader={({ section: { title } }) => (
              <Text style={styles.sectionTitle}>{title}</Text>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            ListFooterComponent={isSearching ? (
              <ActivityIndicator size="small" color={C.gold} style={{ marginTop: 12 }} />
            ) : null}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={44} color="rgba(26, 21, 16, 0.15)" />
            <Text style={styles.emptyText}>No results found</Text>
          </View>
        )
      ) : sections.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShareItem
              id={item.id}
              name={item.name}
              username={item.subtitle}
              avatarUrl={item.avatarUrl}
              isGroup={item.isGroup}
              onPress={() => handleShare(item.id, item.isGroup)}
              isSending={sendingToId === item.id}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionTitle}>{title}</Text>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={44} color="rgba(26, 21, 16, 0.15)" />
          <Text style={styles.emptyText}>No recent conversations</Text>
          <Text style={styles.emptySubtext}>Search for someone to share this recipe with</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },

  // Recipe Preview
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 20,
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: C.hairline,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 3,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  previewImagePlaceholder: {
    backgroundColor: C.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  previewTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
    lineHeight: 20,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.goldTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  previewBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.gold,
    textTransform: 'capitalize',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  searchInput: {
    flex: 1,
    height: 46,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.charcoal,
  },

  // Section Headers
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flex: 1,
  },

  // User Row
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.hairline,
  },
  userItemPressed: {
    opacity: 0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  userContent: {
    flex: 1,
  },
  userName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
  },
  userUsername: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  sendIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // States
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
    marginTop: 14,
  },
  emptySubtext: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
});
