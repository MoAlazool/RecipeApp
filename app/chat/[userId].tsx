import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
  renderers,
} from 'react-native-popup-menu';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import { firebaseService } from '@/services/firebase.service';
import type { Message, Conversation, ConversationParticipant } from '@/utils/types';

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

// Avatar colors based on user ID — elegant tones
const AVATAR_COLORS = [
  '#C66E4E', '#D4AF37', '#6B8E23', '#8B6914', '#A67B5B', '#8A8578', '#9B7E6D', '#B5838D',
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
  senderAvatar?: string;
  isGroup?: boolean;
  onRecipePress?: (recipeId: string) => void;
  onDeletePress?: (messageId: string) => void;
}

// Fix Firebase Storage URLs - ensure path is properly encoded
const fixFirebaseStorageUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;

  // Check if it's a Firebase Storage URL that needs fixing
  if (url.includes('firebasestorage.googleapis.com/v0/b/') && url.includes('/o/')) {
    try {
      // Extract parts of the URL
      const questionIndex = url.indexOf('?');
      const baseAndPath = questionIndex > -1 ? url.substring(0, questionIndex) : url;
      const queryString = questionIndex > -1 ? url.substring(questionIndex + 1) : '';
      const oIndex = baseAndPath.indexOf('/o/');

      if (oIndex !== -1) {
        const base = baseAndPath.substring(0, oIndex + 3); // includes '/o/'
        let path = baseAndPath.substring(oIndex + 3);

        // Check if path contains unencoded slashes (needs encoding)
        if (path.includes('/')) {
          // Decode first (in case of partial encoding), then re-encode
          try {
            path = decodeURIComponent(path);
          } catch {
            // Already decoded or invalid, use as-is
          }
          path = encodeURIComponent(path);
        }

        const fixedUrl = `${base}${path}${queryString ? '?' + queryString : ''}`;
        return fixedUrl;
      }
    } catch (e) {
      // URL fixing failed, return original
    }
  }

  return url;
};

const MessageBubble = ({ message, isOwn, showAvatar, senderName, senderAvatar, isGroup, onRecipePress, onDeletePress }: MessageBubbleProps) => {
  const avatarColor = getAvatarColor(message.sender_id);
  const [imageError, setImageError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const handleLongPress = () => {
    if (!isOwn) return; // Only allow deleting own messages
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Message'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            onDeletePress?.(message.id);
          }
        }
      );
    } else {
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDeletePress?.(message.id),
          },
        ]
      );
    }
  };

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
          return { label: 'Easy', color: '#6B8E23', bg: 'rgba(107, 142, 35, 0.1)' };
        case 'intermediate':
          return { label: 'Medium', color: C.gold, bg: 'rgba(212, 175, 55, 0.1)' };
        case 'advanced':
          return { label: 'Hard', color: C.terracotta, bg: 'rgba(198, 110, 78, 0.1)' };
        default:
          return null;
      }
    };
    const difficultyConfig = getDifficultyConfig(message.recipe_data.difficulty);

    return (
      <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
        {!isOwn && showAvatar && (
          <View style={[styles.avatarSmall, { backgroundColor: avatarColor, overflow: 'hidden' }]}>
            {senderAvatar && !avatarError ? (
              <Image
                source={{ uri: senderAvatar }}
                style={styles.avatarSmallImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <Text style={styles.avatarSmallText}>{getInitials(senderName)}</Text>
            )}
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
            onLongPress={isOwn ? handleLongPress : undefined}
            delayLongPress={500}
          >
            {/* Recipe Image with Overlay */}
            <View style={styles.recipeImageContainer}>
              {message.recipe_data.thumbnail_url && message.recipe_data.thumbnail_url.length > 0 && !imageError ? (
                <Image
                  source={{ uri: fixFirebaseStorageUrl(message.recipe_data.thumbnail_url) }}
                  style={styles.recipeCardImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                  onError={() => setImageError(true)}
                />
              ) : (
                <View style={styles.recipeCardImagePlaceholder}>
                  <Ionicons name="restaurant" size={32} color={C.gold} />
                </View>
              )}
              {/* Gradient Overlay */}
              <View style={styles.recipeImageOverlay} />

              {/* Recipe Badge */}
              <View style={styles.recipeBadge}>
                <Ionicons name="restaurant" size={10} color={C.ivory} />
                <Text style={styles.recipeBadgeText}>Recipe</Text>
              </View>

              {/* Time Badge on Image */}
              {message.recipe_data.total_time_minutes && (
                <View style={styles.recipeTimeBadge}>
                  <Ionicons name="time" size={12} color={C.ivory} />
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
                  <Ionicons name="arrow-forward" size={14} color={C.ivory} />
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
        <View style={[styles.avatarSmall, { backgroundColor: avatarColor, overflow: 'hidden' }]}>
          {senderAvatar && !avatarError ? (
            <Image
              source={{ uri: senderAvatar }}
              style={styles.avatarSmallImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <Text style={styles.avatarSmallText}>{getInitials(senderName)}</Text>
          )}
        </View>
      )}
      {!isOwn && !showAvatar && <View style={styles.avatarSmallPlaceholder} />}

      <View style={[styles.messageContentWrapper, isOwn && styles.messageContentWrapperOwn]}>
        {/* Show sender name in group chats */}
        {isGroup && !isOwn && showAvatar && (
          <Text style={styles.senderName}>{senderName}</Text>
        )}
        <Pressable
          onLongPress={isOwn ? handleLongPress : undefined}
          delayLongPress={500}
        >
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
        </Pressable>
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
    conversations,
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
    deleteMessage,
    setCurrentConversation,
    toggleMuteConversation,
    isConversationMuted,
  } = useMessagingStore();

  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [otherUser, setOtherUser] = useState<{
    id: string;
    full_name?: string;
    avatar_url?: string;
  } | null>(null);

  // Generate conversation ID for DMs (same logic as service)
  const expectedConversationId = useMemo(() => {
    if (conversationIdParam) return conversationIdParam;
    if (userId && user?.id) {
      const sorted = [user.id, userId].sort();
      return `${sorted[0]}_${sorted[1]}`;
    }
    return null;
  }, [conversationIdParam, userId, user?.id]);

  // Get cached conversation and user info immediately from conversations list
  const cachedConversation = useMemo(() => {
    if (!expectedConversationId) return null;
    return conversations.find(c => c.id === expectedConversationId) || null;
  }, [conversations, expectedConversationId]);

  // Get cached other user info from conversation
  const cachedOtherUser = useMemo(() => {
    if (!userId || !user?.id) return null;
    if (cachedConversation && !cachedConversation.is_group) {
      const other = cachedConversation.participant_details.find(p => p.user_id === userId);
      if (other) {
        return {
          id: other.user_id,
          full_name: other.full_name,
          avatar_url: other.avatar_url,
        };
      }
    }
    return null;
  }, [cachedConversation, userId, user?.id]);

  // Use cached data if available, fall back to fetched data
  const effectiveOtherUser = otherUser || cachedOtherUser;
  const effectiveConversation = currentConversation || cachedConversation;

  // Check if this is a group conversation
  const isGroup = effectiveConversation?.is_group ?? false;

  // Build maps of participant IDs to names and avatars for group chats
  const { participantNames, participantAvatars } = useMemo(() => {
    const names: Record<string, string> = {};
    const avatars: Record<string, string | undefined> = {};
    if (effectiveConversation?.participant_details) {
      effectiveConversation.participant_details.forEach((p) => {
        names[p.user_id] = p.full_name || p.username || 'Unknown';
        avatars[p.user_id] = p.avatar_url;
      });
    }
    return { participantNames: names, participantAvatars: avatars };
  }, [effectiveConversation]);

  // Check if conversation is muted
  const isMuted = useMemo(() => {
    const convId = effectiveConversation?.id || expectedConversationId;
    if (!convId) return false;
    return isConversationMuted(convId);
  }, [effectiveConversation, expectedConversationId, isConversationMuted, conversations]);

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
              avatar_url: profile.avatar_url,
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

  // Refresh conversation data when screen comes into focus (to get latest member info)
  useFocusEffect(
    useCallback(() => {
      const refreshConversation = async () => {
        const convId = conversationIdParam || expectedConversationId;
        if (!convId) return;

        const conversation = await getConversation(convId);
        if (conversation) {
          setCurrentConversation(conversation);
        }
      };

      refreshConversation();
    }, [conversationIdParam, expectedConversationId, getConversation, setCurrentConversation])
  );

  // Get messages for current conversation (use expectedConversationId for immediate cache access)
  const conversationMessages = useMemo(() => {
    const convId = currentConversation?.id || expectedConversationId;
    if (!convId) return [];
    return messages[convId] || [];
  }, [messages, currentConversation, expectedConversationId]);

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
    if (!messageText.trim() || isSending) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (isGroup && effectiveConversation) {
        // Group chat - send to conversation
        await sendMessageToConversation(effectiveConversation.id, text);
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
  }, [messageText, userId, effectiveConversation, isGroup, sendMessage, sendMessageToConversation, isSending]);

  const handleRecipePress = useCallback((recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  }, [router]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const convId = effectiveConversation?.id || expectedConversationId;
    if (!convId) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const success = await deleteMessage(convId, messageId);

    if (!success) {
      Alert.alert('Error', 'Failed to delete message. Please try again.');
    }
  }, [effectiveConversation, expectedConversationId, deleteMessage]);

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

    // Get sender name and avatar - for groups use participant maps, for DMs use otherUser
    const senderName = isGroup
      ? participantNames[item.message.sender_id]
      : effectiveOtherUser?.full_name;
    const senderAvatar = isGroup
      ? participantAvatars[item.message.sender_id]
      : effectiveOtherUser?.avatar_url;

    return (
      <MessageBubble
        message={item.message}
        isOwn={item.message.sender_id === user?.id}
        showAvatar={item.showAvatar}
        senderName={senderName}
        senderAvatar={senderAvatar}
        isGroup={isGroup}
        onRecipePress={handleRecipePress}
        onDeletePress={handleDeleteMessage}
      />
    );
  }, [user, otherUser, isGroup, participantNames, participantAvatars, effectiveOtherUser, handleRecipePress, handleDeleteMessage]);

  // Get display name and avatar for header (use effective data for instant display)
  const headerTitle = isGroup
    ? effectiveConversation?.group_name || 'Group Chat'
    : effectiveOtherUser?.full_name || 'Chat';

  const headerSubtitle = isGroup
    ? `${effectiveConversation?.participants.length || 0} members`
    : undefined;

  const avatarColor = getAvatarColor(isGroup ? (effectiveConversation?.id || '') : (userId || ''));

  const handleSettingsPress = () => {
    if (isGroup && effectiveConversation) {
      router.push(`/group-settings/${effectiveConversation.id}` as any);
    }
  };

  // Delete/Clear conversation
  const handleDeleteConversation = useCallback(() => {
    const convId = effectiveConversation?.id || expectedConversationId;
    if (!convId) return;

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

              // Delete the conversation
              await messagingService.deleteConversation(convId);

              // Go back to messages list
              router.replace('/(tabs)/messages' as any);
            } catch (error) {
              console.error('Error deleting conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  }, [effectiveConversation, expectedConversationId, isGroup, router]);

  // View user profile (for DMs)
  const handleViewProfile = useCallback(() => {
    if (userId && !isGroup) {
      router.push(`/profile/${userId}` as any);
    }
  }, [userId, isGroup, router]);

  // Mute/Unmute conversation
  const handleMuteConversation = useCallback(async () => {
    const convId = effectiveConversation?.id || expectedConversationId;
    if (!convId) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleMuteConversation(convId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update notification settings');
    }
  }, [effectiveConversation, expectedConversationId, toggleMuteConversation]);

  // Block user (for DMs)
  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${effectiveOtherUser?.full_name || 'this user'}? They won't be able to send you messages.`,
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerUser}
          onPress={isGroup ? handleSettingsPress : undefined}
          activeOpacity={isGroup ? 0.7 : 1}
        >
          <View style={[styles.headerAvatar, { backgroundColor: avatarColor, overflow: 'hidden' }]}>
            {isGroup ? (
              effectiveConversation?.group_avatar_url ? (
                <Image
                  source={{ uri: effectiveConversation.group_avatar_url }}
                  style={styles.headerAvatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                />
              ) : (
                <Ionicons name="people" size={18} color={C.ivory} />
              )
            ) : effectiveOtherUser?.avatar_url ? (
              <Image
                source={{ uri: effectiveOtherUser.avatar_url }}
                style={styles.headerAvatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            ) : (
              <Text style={styles.headerAvatarText}>
                {getInitials(effectiveOtherUser?.full_name)}
              </Text>
            )}
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {headerTitle}
              </Text>
              {isMuted && (
                <Ionicons name="notifications-off" size={14} color={C.muted} style={styles.headerMuteIcon} />
              )}
            </View>
            {headerSubtitle && (
              <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {isGroup && (
            <TouchableOpacity style={styles.headerAction} onPress={handleSettingsPress}>
              <Ionicons name="settings-outline" size={22} color={C.charcoal} />
            </TouchableOpacity>
          )}
          <Menu renderer={renderers.Popover} rendererProps={{ placement: 'bottom', anchorStyle: { opacity: 0 } }}>
            <MenuTrigger customStyles={{ triggerWrapper: styles.headerAction }}>
              <Ionicons name="ellipsis-vertical" size={20} color={C.charcoal} />
            </MenuTrigger>
            <MenuOptions customStyles={menuOptionsStyles}>
              <GlassView
                glassEffectStyle="clear"
                isInteractive={true}
                tintColor="rgba(255, 255, 255, 0.8)"
                style={styles.menuGlassContainer}
              >
                {!isGroup && (
                  <MenuOption onSelect={handleViewProfile}>
                    <View style={styles.menuOption}>
                      <Ionicons name="person-outline" size={20} color={C.charcoal} />
                      <Text style={styles.menuOptionText}>View Profile</Text>
                    </View>
                  </MenuOption>
                )}
                <MenuOption onSelect={handleMuteConversation}>
                  <View style={styles.menuOption}>
                    <Ionicons name={isMuted ? "notifications-outline" : "notifications-off-outline"} size={20} color={C.charcoal} />
                    <Text style={styles.menuOptionText}>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</Text>
                  </View>
                </MenuOption>
                {!isGroup && (
                  <MenuOption onSelect={handleBlockUser}>
                    <View style={styles.menuOption}>
                      <Ionicons name="ban-outline" size={20} color={C.charcoal} />
                      <Text style={styles.menuOptionText}>Block User</Text>
                    </View>
                  </MenuOption>
                )}
                <MenuOption onSelect={handleDeleteConversation}>
                  <View style={[styles.menuOption, styles.menuOptionDestructive]}>
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                    <Text style={[styles.menuOptionText, styles.menuOptionTextDestructive]}>Delete Conversation</Text>
                  </View>
                </MenuOption>
              </GlassView>
            </MenuOptions>
          </Menu>
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
            {isLoadingMessages ? (
              <ActivityIndicator size="large" color={C.gold} />
            ) : (
              <>
                <View style={[styles.emptyAvatar, { backgroundColor: avatarColor }]}>
                  {isGroup ? (
                    <Ionicons name="people" size={36} color={C.ivory} />
                  ) : (
                    <Text style={styles.emptyAvatarText}>
                      {getInitials(effectiveOtherUser?.full_name)}
                    </Text>
                  )}
                </View>
                <Text style={styles.emptyTitle}>
                  {isGroup
                    ? effectiveConversation?.group_name || 'New Group'
                    : effectiveOtherUser?.full_name || 'New Conversation'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isGroup
                    ? 'Start the group conversation!'
                    : 'Send a message to start the conversation'}
                </Text>
              </>
            )}
          </View>
        )}
      />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={C.muted}
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
              <ActivityIndicator size="small" color={C.ivory} />
            ) : (
              <Ionicons name="send" size={18} color={C.ivory} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Menu popup styles
const menuOptionsStyles = {
  optionsContainer: {
    backgroundColor: 'transparent',
    padding: 0,
    borderRadius: 0,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: C.ivory,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.18)',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
  },
  headerUser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...SHADOW_SOFT,
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerAvatarText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  headerInfo: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerMuteIcon: {
    marginLeft: 6,
  },
  headerName: {
    fontSize: 17,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
  },
  menuGlassContainer: {
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 220,
    backgroundColor: '#FFFFFF',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuOptionText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  menuOptionDestructive: {
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
    marginTop: 4,
    paddingTop: 16,
  },
  menuOptionTextDestructive: {
    color: '#DC2626',
  },

  // Messages list
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },

  // Date separator
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 24,
  },
  dateLine: {
    display: 'none',
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
    backgroundColor: C.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    letterSpacing: 0.5,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },

  // System message
  systemMessageRow: {
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 20,
  },
  systemMessageText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    textAlign: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },

  // Message container
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    paddingHorizontal: 0,
  },
  messageContainerOwn: {
    flexDirection: 'row-reverse',
  },

  // Avatar
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginBottom: 4,
    ...SHADOW_SOFT,
  },
  avatarSmallPlaceholder: {
    width: 34,
    marginRight: 10,
  },
  avatarSmallText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  avatarSmallImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  // Message content
  messageContentWrapper: {
    maxWidth: '78%',
    alignItems: 'flex-start',
  },
  messageContentWrapperOwn: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
    marginBottom: 5,
    marginLeft: 14,
    letterSpacing: 0.3,
  },

  // Message bubble
  messageBubble: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
  },
  messageBubbleOwn: {
    backgroundColor: C.terracotta,
    borderBottomRightRadius: 6,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  messageBubbleOther: {
    backgroundColor: C.ivory,
    borderBottomLeftRadius: 6,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  messageText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.charcoal,
    lineHeight: 22,
  },
  messageTextOwn: {
    color: C.ivory,
  },
  messageTime: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 6,
    marginLeft: 14,
    letterSpacing: 0.3,
  },
  messageTimeOwn: {
    marginLeft: 0,
    marginRight: 14,
  },

  // Recipe card
  recipeCard: {
    backgroundColor: C.ivory,
    borderRadius: 24,
    overflow: 'hidden',
    width: 260,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  recipeCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  recipeImageContainer: {
    position: 'relative',
    height: 140,
  },
  recipeCardImage: {
    width: '100%',
    height: '100%',
  },
  recipeCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  recipeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  recipeBadgeText: {
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recipeTimeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(26, 21, 16, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  recipeTimeBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.ivory,
  },
  recipeCardContent: {
    padding: 16,
  },
  recipeCardTitle: {
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    lineHeight: 22,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  recipeCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  recipeDifficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  recipeDifficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recipeDifficultyText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  recipeCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipeCardActionText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  recipeCardActionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Input container
  inputContainer: {
    backgroundColor: C.ivory,
    paddingTop: 14,
    paddingHorizontal: 16,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(212, 175, 55, 0.18)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: C.cardBg,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.charcoal,
    maxHeight: 120,
    minHeight: 52,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...SHADOW_SOFT,
  },
  emptyAvatarText: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
