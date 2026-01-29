import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import { firebaseService } from '@/services/firebase.service';
import type { Message, Conversation, ConversationParticipant } from '@/utils/types';

// Format time for messages
const formatMessageTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// Format date for message groups
const formatMessageDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else {
    return date.toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
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

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  senderName?: string;
  isGroup?: boolean;
  onRecipePress?: (recipeId: string) => void;
}

const MessageBubble = ({ message, isOwn, showAvatar, senderName, isGroup, onRecipePress }: MessageBubbleProps) => {
  const avatarColor = getAvatarColor(message.sender_id);

  // System message (for group events)
  if (message.message_type === 'system') {
    return (
      <View style={styles.systemMessageRow}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  // Recipe message
  if (message.message_type === 'recipe' && message.recipe_data) {
    const getDifficultyConfig = (difficulty?: string) => {
      switch (difficulty) {
        case 'beginner':
          return { label: 'Easy', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)' };
        case 'intermediate':
          return { label: 'Medium', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
        case 'advanced':
          return { label: 'Hard', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' };
        default:
          return null;
      }
    };
    const difficultyConfig = getDifficultyConfig(message.recipe_data.difficulty);

    return (
      <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
        {!isOwn && showAvatar && (
          <View style={[styles.avatarSmall, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarSmallText}>{getInitials(senderName)}</Text>
          </View>
        )}
        {!isOwn && !showAvatar && <View style={styles.avatarSmallPlaceholder} />}

        <View style={[styles.messageContentWrapper, isOwn && styles.messageContentWrapperOwn]}>
          {/* Show sender name in group chats */}
          {isGroup && !isOwn && showAvatar && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.recipeCard,
              pressed && styles.recipeCardPressed,
            ]}
            onPress={() => onRecipePress?.(message.recipe_data!.id)}
          >
            {/* Recipe Image with Overlay */}
            <View style={styles.recipeImageContainer}>
              {message.recipe_data.thumbnail_url ? (
                <Image
                  source={{ uri: message.recipe_data.thumbnail_url }}
                  style={styles.recipeCardImage}
                />
              ) : (
                <View style={styles.recipeCardImagePlaceholder}>
                  <Ionicons name="restaurant" size={32} color="#E8D3CE" />
                </View>
              )}
              {/* Gradient Overlay */}
              <View style={styles.recipeImageOverlay} />

              {/* Recipe Badge */}
              <View style={styles.recipeBadge}>
                <Ionicons name="restaurant" size={10} color="#FFFFFF" />
                <Text style={styles.recipeBadgeText}>Recipe</Text>
              </View>

              {/* Time Badge on Image */}
              {message.recipe_data.total_time_minutes && (
                <View style={styles.recipeTimeBadge}>
                  <Ionicons name="time" size={12} color="#FFFFFF" />
                  <Text style={styles.recipeTimeBadgeText}>
                    {message.recipe_data.total_time_minutes} min
                  </Text>
                </View>
              )}
            </View>

            {/* Recipe Info */}
            <View style={styles.recipeCardContent}>
              <Text style={styles.recipeCardTitle} numberOfLines={2}>
                {message.recipe_data.title}
              </Text>

              <View style={styles.recipeCardMeta}>
                {difficultyConfig && (
                  <View style={[styles.recipeDifficultyBadge, { backgroundColor: difficultyConfig.bg }]}>
                    <View style={[styles.recipeDifficultyDot, { backgroundColor: difficultyConfig.color }]} />
                    <Text style={[styles.recipeDifficultyText, { color: difficultyConfig.color }]}>
                      {difficultyConfig.label}
                    </Text>
                  </View>
                )}
              </View>

              {/* Tap to View */}
              <View style={styles.recipeCardAction}>
                <Text style={styles.recipeCardActionText}>Tap to view recipe</Text>
                <View style={styles.recipeCardActionIcon}>
                  <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                </View>
              </View>
            </View>
          </Pressable>
          <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
            {formatMessageTime(message.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  // Text message
  return (
    <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
      {!isOwn && showAvatar && (
        <View style={[styles.avatarSmall, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarSmallText}>{getInitials(senderName)}</Text>
        </View>
      )}
      {!isOwn && !showAvatar && <View style={styles.avatarSmallPlaceholder} />}

      <View style={[styles.messageContentWrapper, isOwn && styles.messageContentWrapperOwn]}>
        {/* Show sender name in group chats */}
        {isGroup && !isOwn && showAvatar && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
          ]}
        >
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {message.content}
          </Text>
        </View>
        <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
          {formatMessageTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
};

export default function ChatScreen() {
  // Support both userId (for DMs) and conversationId (for groups)
  const { userId, conversationId: conversationIdParam } = useLocalSearchParams<{
    userId?: string;
    conversationId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const { user } = useAuthStore();
  const {
    messages,
    currentConversation,
    isLoadingMessages,
    getOrCreateConversation,
    getConversation,
    fetchMessages,
    subscribeToMessages,
    unsubscribeFromMessages,
    sendMessage,
    sendMessageToConversation,
    markAsRead,
    setCurrentConversation,
  } = useMessagingStore();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    full_name?: string;
    avatar_url?: string;
  } | null>(null);

  // Check if this is a group conversation
  const isGroup = currentConversation?.is_group ?? false;

  // Build a map of participant IDs to names for group chats
  const participantNames = useMemo(() => {
    const names: Record<string, string> = {};
    if (currentConversation?.participant_details) {
      currentConversation.participant_details.forEach((p) => {
        names[p.user_id] = p.full_name || p.username || 'Unknown';
      });
    }
    return names;
  }, [currentConversation]);

  // Initialize conversation
  useEffect(() => {
    const initChat = async () => {
      if (!user) return;

      try {
        let conversation: Conversation | null = null;

        if (conversationIdParam) {
          // Group chat or existing conversation - fetch by ID
          conversation = await getConversation(conversationIdParam);
          if (conversation) {
            setCurrentConversation(conversation);
          }
        } else if (userId) {
          // DM - get or create conversation with this user
          conversation = await getOrCreateConversation(userId);

          // Get other user's profile for DM
          const profile = await firebaseService.getProfile(userId);
          if (profile) {
            setOtherUser({
              id: profile.id,
              full_name: profile.full_name,
            });
          }
        }

        if (!conversation) {
          console.error('Could not initialize conversation');
          return;
        }

        // Fetch messages for this conversation
        await fetchMessages(conversation.id);

        // Subscribe to real-time messages
        subscribeToMessages(conversation.id);

        // Mark as read
        markAsRead(conversation.id);
      } catch (error) {
        console.error('Error initializing chat:', error);
      }
    };

    initChat();

    return () => {
      unsubscribeFromMessages();
      setCurrentConversation(null);
    };
  }, [userId, conversationIdParam, user]);

  // Get messages for current conversation
  const conversationMessages = useMemo(() => {
    if (!currentConversation) return [];
    return messages[currentConversation.id] || [];
  }, [messages, currentConversation]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    conversationMessages.forEach((message) => {
      const messageDate = formatMessageDate(message.created_at);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  }, [conversationMessages]);

  // Flatten for FlatList with date separators
  const flattenedData = useMemo(() => {
    const items: ({ type: 'date'; date: string } | { type: 'message'; message: Message; showAvatar: boolean })[] = [];

    groupedMessages.forEach((group) => {
      items.push({ type: 'date', date: group.date });
      group.messages.forEach((message, index) => {
        const prevMessage = index > 0 ? group.messages[index - 1] : null;
        const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;
        items.push({ type: 'message', message, showAvatar });
      });
    });

    return items;
  }, [groupedMessages]);

  const handleSend = useCallback(async () => {
    if (!messageText.trim() || isSending || !currentConversation) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (isGroup) {
        // Group chat - send to conversation
        await sendMessageToConversation(currentConversation.id, text);
      } else if (userId) {
        // DM - send to user
        await sendMessage(userId, text);
      }

      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(text); // Restore message on error
    } finally {
      setIsSending(false);
    }
  }, [messageText, userId, currentConversation, isGroup, sendMessage, sendMessageToConversation, isSending]);

  const handleRecipePress = useCallback((recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: typeof flattenedData[number] }) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{item.date}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }

    // Get sender name - for groups use participantNames map, for DMs use otherUser
    const senderName = isGroup
      ? participantNames[item.message.sender_id]
      : otherUser?.full_name;

    return (
      <MessageBubble
        message={item.message}
        isOwn={item.message.sender_id === user?.id}
        showAvatar={item.showAvatar}
        senderName={senderName}
        isGroup={isGroup}
        onRecipePress={handleRecipePress}
      />
    );
  }, [user, otherUser, isGroup, participantNames, handleRecipePress]);

  // Get display name and avatar for header
  const headerTitle = isGroup
    ? currentConversation?.group_name || 'Group Chat'
    : otherUser?.full_name || 'Loading...';

  const headerSubtitle = isGroup
    ? `${currentConversation?.participants.length || 0} members`
    : undefined;

  const avatarColor = getAvatarColor(isGroup ? (currentConversation?.id || '') : (userId || ''));

  const handleSettingsPress = () => {
    if (isGroup && currentConversation) {
      router.push(`/group-settings/${currentConversation.id}` as any);
    }
  };

  // Delete/Clear conversation
  const handleDeleteConversation = useCallback(() => {
    Alert.alert(
      'Delete Conversation',
      isGroup
        ? 'Are you sure you want to delete this group chat? This will remove all messages for everyone.'
        : 'Are you sure you want to delete this conversation? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              const { messagingService } = await import('@/services/messaging.service');

              if (currentConversation) {
                // Delete the conversation
                await messagingService.deleteConversation(currentConversation.id);

                // Go back to messages list
                router.replace('/(tabs)/messages' as any);
              }
            } catch (error) {
              console.error('Error deleting conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  }, [currentConversation, isGroup, router]);

  // View user profile (for DMs)
  const handleViewProfile = useCallback(() => {
    if (userId && !isGroup) {
      router.push(`/profile/${userId}` as any);
    }
  }, [userId, isGroup, router]);

  // Mute conversation
  const handleMuteConversation = useCallback(() => {
    Alert.alert(
      'Mute Conversation',
      'Mute notifications from this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // TODO: Implement mute functionality
            Alert.alert('Muted', 'You will no longer receive notifications from this conversation.');
          },
        },
      ]
    );
  }, []);

  // Block user (for DMs)
  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${otherUser?.full_name || 'this user'}? They won't be able to send you messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            // TODO: Implement block functionality
            Alert.alert('Blocked', 'User has been blocked.');
            router.back();
          },
        },
      ]
    );
  }, [otherUser, router]);

  // Show more options menu
  const handleMoreOptions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'ios') {
      const options = isGroup
        ? ['Cancel', 'Mute Notifications', 'Delete Conversation']
        : ['Cancel', 'View Profile', 'Mute Notifications', 'Block User', 'Delete Conversation'];

      const destructiveButtonIndex = isGroup ? 2 : 4;
      const cancelButtonIndex = 0;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          destructiveButtonIndex,
        },
        (buttonIndex) => {
          if (isGroup) {
            switch (buttonIndex) {
              case 1:
                handleMuteConversation();
                break;
              case 2:
                handleDeleteConversation();
                break;
            }
          } else {
            switch (buttonIndex) {
              case 1:
                handleViewProfile();
                break;
              case 2:
                handleMuteConversation();
                break;
              case 3:
                handleBlockUser();
                break;
              case 4:
                handleDeleteConversation();
                break;
            }
          }
        }
      );
    } else {
      // Android - use Alert with buttons
      Alert.alert(
        'Options',
        'What would you like to do?',
        isGroup
          ? [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Mute Notifications', onPress: handleMuteConversation },
              { text: 'Delete Conversation', style: 'destructive', onPress: handleDeleteConversation },
            ]
          : [
              { text: 'Cancel', style: 'cancel' },
              { text: 'View Profile', onPress: handleViewProfile },
              { text: 'Mute Notifications', onPress: handleMuteConversation },
              { text: 'Block User', onPress: handleBlockUser },
              { text: 'Delete Conversation', style: 'destructive', onPress: handleDeleteConversation },
            ]
      );
    }
  }, [isGroup, handleDeleteConversation, handleViewProfile, handleMuteConversation, handleBlockUser]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#1C100D" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUser}
          onPress={isGroup ? handleSettingsPress : undefined}
          activeOpacity={isGroup ? 0.7 : 1}
        >
          <View style={[styles.headerAvatar, { backgroundColor: avatarColor }]}>
            {isGroup ? (
              currentConversation?.group_avatar_url ? (
                <Image
                  source={{ uri: currentConversation.group_avatar_url }}
                  style={styles.headerAvatarImage}
                />
              ) : (
                <Ionicons name="people" size={18} color="#FFFFFF" />
              )
            ) : otherUser?.avatar_url ? (
              <Image
                source={{ uri: otherUser.avatar_url }}
                style={styles.headerAvatarImage}
              />
            ) : (
              <Text style={styles.headerAvatarText}>
                {getInitials(otherUser?.full_name)}
              </Text>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {headerTitle}
            </Text>
            {headerSubtitle && (
              <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {isGroup && (
            <TouchableOpacity style={styles.headerAction} onPress={handleSettingsPress}>
              <Ionicons name="settings-outline" size={22} color="#1C100D" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerAction} onPress={handleMoreOptions}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#1C100D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={flattenedData}
        keyExtractor={(item, index) =>
          item.type === 'date' ? `date-${item.date}` : `msg-${item.message.id}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyAvatar, { backgroundColor: avatarColor }]}>
              {isGroup ? (
                <Ionicons name="people" size={36} color="#FFFFFF" />
              ) : (
                <Text style={styles.emptyAvatarText}>
                  {getInitials(otherUser?.full_name)}
                </Text>
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {isGroup
                ? currentConversation?.group_name || 'New Group'
                : otherUser?.full_name || 'New Conversation'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {isGroup
                ? 'Start the group conversation!'
                : 'Send a message to start the conversation'}
            </Text>
          </View>
        )}
      />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#9C5749"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesList: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 20,
  },
  dateLine: {
    display: 'none',
  },
  dateText: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    backgroundColor: 'rgba(156, 87, 73, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  systemMessageRow: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  systemMessageText: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    textAlign: 'center',
    backgroundColor: 'rgba(156, 87, 73, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  messageContainerOwn: {
    flexDirection: 'row-reverse',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  avatarSmallPlaceholder: {
    width: 32,
    marginRight: 8,
  },
  avatarSmallText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  messageContentWrapper: {
    maxWidth: '80%',
    alignItems: 'flex-start',
  },
  messageContentWrapperOwn: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageBubbleOwn: {
    backgroundColor: '#F2330D',
    borderBottomRightRadius: 6,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    color: '#1C100D',
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 4,
    marginLeft: 12,
  },
  messageTimeOwn: {
    marginLeft: 0,
    marginRight: 12,
  },
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    width: 240,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  recipeCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  recipeImageContainer: {
    position: 'relative',
    height: 130,
  },
  recipeCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recipeCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2EEEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  recipeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F2330D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  recipeBadgeText: {
    fontSize: 10,
    fontFamily: 'NotoSans_700Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recipeTimeBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  recipeTimeBadgeText: {
    fontSize: 11,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  recipeCardContent: {
    padding: 14,
  },
  recipeCardTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    lineHeight: 20,
    marginBottom: 10,
  },
  recipeCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  recipeDifficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  recipeDifficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recipeDifficultyText: {
    fontSize: 11,
    fontFamily: 'NotoSans_600SemiBold',
  },
  recipeCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeCardActionText: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  recipeCardActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8F6F5',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    fontFamily: 'NotoSans_400Regular',
    color: '#1C100D',
    maxHeight: 120,
    minHeight: 48,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#E8D3CE',
    shadowOpacity: 0,
    elevation: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyAvatarText: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    textAlign: 'center',
  },
});
