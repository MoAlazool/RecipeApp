import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  FlatList,
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

// Avatar colors based on user ID
const AVATAR_COLORS = [
  '#F2330D', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6',
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
          <Ionicons name="people" size={20} color="#FFFFFF" />
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
        <ActivityIndicator size="small" color="#F2330D" />
      ) : (
        <View style={styles.sendIcon}>
          <Ionicons name="send" size={18} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
};

export default function ShareRecipeScreen() {
  const { recipeId, recipeTitle, recipeThumbnail, recipeTime, recipeDifficulty } =
    useLocalSearchParams<{
      recipeId: string;
      recipeTitle: string;
      recipeThumbnail?: string;
      recipeTime?: string;
      recipeDifficulty?: string;
    }>();

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
          subtitle: otherParticipant?.username ? `@${otherParticipant.username}` : undefined,
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
      result.push({ title: 'Direct Messages', data: recentDMs });
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
      // Filter out users already in recent DMs
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

      // Navigate to the chat with this user
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

      // Send recipe message to group conversation
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

      // Navigate to the group chat
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

  // Handle share based on type
  const handleShare = useCallback((id: string, isGroup: boolean) => {
    if (isGroup) {
      handleShareToGroup(id);
    } else {
      handleShareToUser(id);
    }
  }, [handleShareToGroup, handleShareToUser]);

  const isSearchMode = searchQuery.trim().length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#1C100D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Recipe</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Recipe Preview */}
      <View style={styles.recipePreview}>
        {recipeThumbnail && (
          <Image source={{ uri: recipeThumbnail }} style={styles.recipeImage} />
        )}
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {recipeTitle}
          </Text>
          {recipeTime && (
            <View style={styles.recipeMeta}>
              <Ionicons name="time-outline" size={14} color="#9C5749" />
              <Text style={styles.recipeMetaText}>{recipeTime} min</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color="#9C5749" />
          <TextInput
            style={styles.searchTextInput}
            placeholder="Search for someone else..."
            placeholderTextColor="#9C5749"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9C5749" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {isLoadingConversations && !isSearchMode ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
        </View>
      ) : isSearchMode ? (
        // Search Results
        isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F2330D" />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ShareItem
                id={item.id}
                name={item.full_name || 'Unknown'}
                username={item.username}
                avatarUrl={item.avatar_url}
                onPress={() => handleShare(item.id, false)}
                isSending={sendingToId === item.id}
              />
            )}
            contentContainerStyle={[
              styles.listContent,
              searchResults.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="person-outline" size={48} color="#E8D3CE" />
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            )}
          />
        )
      ) : sections.length > 0 ? (
        // Groups and DMs with SectionList
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
        // Empty state
        <View style={styles.hintContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color="#E8D3CE" />
          <Text style={styles.hintText}>
            No recent conversations yet.{'\n'}Search for a user to share this recipe.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  headerPlaceholder: {
    width: 40,
  },
  recipePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  recipeImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  recipeInfo: {
    flex: 1,
  },
  recipeTitle: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
    marginBottom: 4,
  },
  recipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recipeMetaText: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchTextInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    color: '#1C100D',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: '#F8F6F5',
    paddingVertical: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  userItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  userContent: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
  },
  userUsername: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 1,
  },
  sendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 12,
  },
  hintContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  hintText: {
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
});
