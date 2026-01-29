import { useEffect, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Image,
} from 'react-native';
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

// Avatar colors based on user ID
const AVATAR_COLORS = [
  '#F2330D', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6',
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
        pressed && styles.conversationItemPressed,
      ]}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : isGroup ? (
          <Ionicons name="people" size={22} color="#FFFFFF" />
        ) : (
          <Text style={styles.avatarText}>
            {getInitials(displayName)}
          </Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <View style={styles.conversationNameRow}>
            {isGroup && (
              <Ionicons name="people" size={14} color="#9C5749" style={styles.groupIcon} />
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
          </View>
          <Text style={styles.conversationTime}>
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
        <View style={[styles.header, { paddingTop: insets.top }]}>
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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {conversations.length > 0
              ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`
              : 'Connect with friends'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.newMessageButton}
            onPress={handleCreateGroup}
          >
            <Ionicons name="people-outline" size={22} color="#F2330D" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.newMessageButton}
            onPress={handleNewMessage}
          >
            <Ionicons name="create-outline" size={22} color="#F2330D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={sortedConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomTabBarHeight },
          conversations.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor="#F2330D"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <EmptyState
            icon="chatbubbles-outline"
            title="No conversations yet"
            subtitle="Start a conversation by finding users to message"
            action={
              <TouchableOpacity style={styles.emptyAction} onPress={handleNewMessage}>
                <Ionicons name="search" size={18} color="#FFFFFF" />
                <Text style={styles.emptyActionText}>Find Users</Text>
              </TouchableOpacity>
            }
          />
        )}
      />
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#F8F6F5',
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  newMessageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContentEmpty: {
    flex: 1,
  },
  conversationItem: {
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
  conversationItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  groupIcon: {
    marginRight: 4,
  },
  conversationName: {
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
    flexShrink: 1,
  },
  conversationNameUnread: {
    fontFamily: 'NotoSans_700Bold',
  },
  conversationTime: {
    fontSize: 12,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationMessage: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    flex: 1,
    marginRight: 8,
  },
  conversationMessageUnread: {
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  unreadBadge: {
    backgroundColor: '#F2330D',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2330D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  emptyActionText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
});
