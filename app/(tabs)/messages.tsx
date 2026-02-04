import { useEffect, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
import type { Conversation } from '@/utils/types';

// ============================================================
// DESIGN TOKENS — Michelin-Star Luxury
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

// Format time for conversation list
const formatMessageTime = (dateString?: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
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

// Avatar colors — elegant tones
const AVATAR_COLORS = [
  '#C66E4E', '#D4AF37', '#6B8E23', '#8B6914', '#A67B5B', '#8A8578', '#9B7E6D', '#B5838D',
];

const getAvatarColor = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
}

const ConversationItem = ({ conversation, currentUserId, onPress }: ConversationItemProps) => {
  const isGroup = conversation.is_group ?? false;

  // For groups, use group info; for DMs, find the other participant
  const otherParticipant = !isGroup
    ? conversation.participant_details.find(p => p.user_id !== currentUserId)
    : null;

  const currentUserDetails = conversation.participant_details.find(
    p => p.user_id === currentUserId
  );

  const unreadCount = currentUserDetails?.unread_count || 0;
  const hasUnread = unreadCount > 0;
  const isMuted = currentUserDetails?.is_muted ?? false;

  // For groups, use conversation ID for color; for DMs, use other user's ID
  const avatarColor = getAvatarColor(isGroup ? conversation.id : (otherParticipant?.user_id || ''));

  // Display name: group name or other participant's name
  const displayName = isGroup
    ? conversation.group_name || 'Group Chat'
    : otherParticipant?.full_name || 'Unknown User';

  // Avatar URL: group avatar or other participant's avatar
  const avatarUrl = isGroup
    ? conversation.group_avatar_url
    : otherParticipant?.avatar_url;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.conversationItem,
        hasUnread && styles.conversationItemUnread,
        pressed && styles.conversationItemPressed,
      ]}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={avatarUrl}
          />
        ) : isGroup ? (
          <Ionicons name="people" size={22} color={C.ivory} />
        ) : (
          <Text style={styles.avatarText}>
            {getInitials(displayName)}
          </Text>
        )}
        {hasUnread && <View style={styles.avatarUnreadDot} />}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.conversationNameRow}>
            {isGroup && (
              <Ionicons name="people" size={13} color={C.gold} style={styles.groupIcon} />
            )}
            <Text
              style={[
                styles.conversationName,
                hasUnread && styles.conversationNameUnread,
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isMuted && (
              <Ionicons name="notifications-off" size={14} color={C.muted} style={styles.muteIcon} />
            )}
          </View>
          <Text style={[styles.conversationTime, hasUnread && styles.conversationTimeUnread]}>
            {formatMessageTime(conversation.last_message_at)}
          </Text>
        </View>

        <View style={styles.conversationFooter}>
          <Text
            style={[
              styles.conversationMessage,
              hasUnread && styles.conversationMessageUnread,
            ]}
            numberOfLines={1}
          >
            {conversation.last_message || 'No messages yet'}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={C.hairline} style={styles.chevron} />
    </Pressable>
  );
};

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const router = useRouter();

  const { user } = useAuthStore();
  const {
    conversations,
    isLoading,
    error,
    fetchConversations,
    subscribeToConversations,
    unsubscribeFromConversations,
  } = useMessagingStore();

  // Subscribe to conversations on mount
  useEffect(() => {
    if (user) {
      fetchConversations();
      subscribeToConversations();
    }

    return () => {
      unsubscribeFromConversations();
    };
  }, [user]);

  const handleRefresh = useCallback(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewMessage = useCallback(() => {
    router.push('/find-users' as any);
  }, [router]);

  const handleConversationPress = useCallback((conversation: Conversation) => {
    if (conversation.is_group) {
      // For groups, navigate with conversationId
      router.push(`/chat/${conversation.id}?conversationId=${conversation.id}` as any);
    } else {
      // For DMs, find the other participant to pass their ID
      const otherParticipantId = conversation.participants.find(
        id => id !== user?.id
      );
      if (otherParticipantId) {
        router.push(`/chat/${otherParticipantId}` as any);
      }
    }
  }, [router, user]);

  const handleCreateGroup = useCallback(() => {
    router.push('/create-group' as any);
  }, [router]);

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [conversations]);

  const renderConversation = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      currentUserId={user?.id || ''}
      onPress={() => handleConversationPress(item)}
    />
  ), [user, handleConversationPress]);

  if (!user) {
    return (
      <TabScreenTransition style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            <Text style={styles.headerSubtitle}>Sign in to message friends</Text>
          </View>
        </View>

        <EmptyState
          icon="log-in-outline"
          title="Sign in to see messages"
          subtitle="Connect with other cooks and share recipes"
        />
      </TabScreenTransition>
    );
  }

  return (
    <TabScreenTransition style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {conversations.length > 0
              ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`
              : 'Connect with friends'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable
            style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
            onPress={handleCreateGroup}
          >
            <Ionicons name="people-outline" size={20} color={C.gold} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.headerButton, styles.headerButtonPrimary, pressed && styles.headerButtonPressed]}
            onPress={handleNewMessage}
          >
            <Ionicons name="create-outline" size={20} color={C.ivory} />
          </Pressable>
        </View>
      </View>

      {/* Gold hairline */}
      <View style={styles.headerHairline} />

      {/* Conversations List */}
      <FlatList
        data={sortedConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomTabBarHeight + 16 },
          conversations.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={C.gold}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={C.gold} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation by finding users to message
            </Text>
            <Pressable
              style={({ pressed }) => [styles.emptyAction, pressed && styles.emptyActionPressed]}
              onPress={handleNewMessage}
            >
              <Ionicons name="search" size={18} color={C.ivory} />
              <Text style={styles.emptyActionText}>Find Users</Text>
            </Pressable>
          </View>
        )}
      />
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: C.ivory,
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  headerButtonPrimary: {
    backgroundColor: C.terracotta,
    borderWidth: 0,
    ...SHADOW_SOFT,
    shadowColor: C.terracotta,
    shadowOpacity: 0.3,
  },
  headerButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  headerHairline: {
    height: 0.5,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    marginHorizontal: 20,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Conversation item
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  conversationItemUnread: {
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  conversationItemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  // Avatar
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
    ...SHADOW_SOFT,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  avatarUnreadDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.gold,
    borderWidth: 2,
    borderColor: C.ivory,
  },

  // Conversation content
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  conversationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  groupIcon: {
    marginRight: 6,
  },
  muteIcon: {
    marginLeft: 6,
  },
  conversationName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    flexShrink: 1,
  },
  conversationNameUnread: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  conversationTime: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
  },
  conversationTimeUnread: {
    color: C.gold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationMessage: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    flex: 1,
    marginRight: 10,
  },
  conversationMessageUnread: {
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  chevron: {
    marginLeft: 4,
  },

  // Unread badge
  unreadBadge: {
    backgroundColor: C.gold,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.terracotta,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
    marginTop: 24,
    ...SHADOW_SOFT,
    shadowColor: C.terracotta,
    shadowOpacity: 0.3,
  },
  emptyActionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  emptyActionText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.ivory,
  },
});
