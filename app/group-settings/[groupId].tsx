import { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import type { Conversation, ConversationParticipant } from '@/utils/types';

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

// Avatar colors — elegant tones
const AVATAR_COLORS = [
  '#C66E4E', '#D4AF37', '#6B8E23', '#8B6914', '#A67B5B', '#8A8578', '#9B7E6D', '#B5838D',
];

const getAvatarColor = (id: string): string => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const getInitials = (name?: string): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

interface MemberItemProps {
  participant: ConversationParticipant;
  isCurrentUser: boolean;
  isAdmin: boolean;
  canManage: boolean;
  onMakeAdmin: () => void;
  onRemove: () => void;
}

const MemberItem = ({
  participant,
  isCurrentUser,
  isAdmin,
  canManage,
  onMakeAdmin,
  onRemove,
}: MemberItemProps) => {
  const avatarColor = getAvatarColor(participant.user_id);

  const showOptionsMenu = () => {
    if (!canManage || isCurrentUser) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const options = [];
    if (!isAdmin) {
      options.push({ text: 'Make Admin', onPress: onMakeAdmin });
    }
    options.push({ text: 'Remove from Group', onPress: onRemove, style: 'destructive' as const });
    options.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert(
      participant.full_name || 'Member',
      'What would you like to do?',
      options
    );
  };

  return (
    <View style={styles.memberItem}>
      <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
        {participant.avatar_url ? (
          <Image source={{ uri: participant.avatar_url }} style={styles.memberAvatarImage} />
        ) : (
          <Text style={styles.memberAvatarText}>{getInitials(participant.full_name || '')}</Text>
        )}
      </View>
      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>
            {participant.full_name || 'Unknown'}
            {isCurrentUser && ' (You)'}
          </Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
        {participant.username && (
          <Text style={styles.memberUsername}>@{participant.username}</Text>
        )}
      </View>
      {canManage && !isCurrentUser && (
        <Pressable
          style={({ pressed }) => [styles.memberOptionsButton, pressed && styles.memberOptionsButtonPressed]}
          onPress={showOptionsMenu}
          hitSlop={12}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={C.muted} />
        </Pressable>
      )}
    </View>
  );
};

export default function GroupSettingsScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    currentConversation,
    getConversation,
    setCurrentConversation,
    updateGroupInfo,
    removeGroupMember,
    makeGroupAdmin,
    leaveGroup,
  } = useMessagingStore();

  const [conversation, setConversation] = useState<Conversation | null>(currentConversation);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Check if current user is admin
  const isAdmin = conversation?.admin_ids?.includes(user?.id || '') ?? false;

  // Helper to refresh conversation data
  const refreshConversation = useCallback(async () => {
    if (!groupId) return;
    const conv = await getConversation(groupId);
    if (conv) {
      setConversation(conv);
      setEditName(conv.group_name || '');
      setEditDescription(conv.group_description || '');
    }
  }, [groupId, getConversation]);

  // Reload conversation data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshConversation();
    }, [refreshConversation])
  );

  const handleSaveChanges = useCallback(async () => {
    if (!conversation || !isAdmin) return;

    setIsSaving(true);
    try {
      await updateGroupInfo(conversation.id, {
        group_name: editName.trim(),
        group_description: editDescription.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsEditing(false);

      // Refresh to get latest data from server
      await refreshConversation();
    } catch (error: any) {
      console.error('Error updating group:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to update group info');
    } finally {
      setIsSaving(false);
    }
  }, [conversation, editName, editDescription, isAdmin, updateGroupInfo, refreshConversation]);

  const handleRemoveMember = useCallback(async (memberId: string, memberName: string) => {
    if (!conversation || !isAdmin) return;

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeGroupMember(conversation.id, memberId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Refresh to get latest data from server
              await refreshConversation();
            } catch (error: any) {
              console.error('Error removing member:', error);
              Alert.alert('Error', error.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  }, [conversation, isAdmin, removeGroupMember, refreshConversation]);

  const handleMakeAdmin = useCallback(async (memberId: string, memberName: string) => {
    if (!conversation || !isAdmin) return;

    Alert.alert(
      'Make Admin',
      `Make ${memberName} an admin of this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Admin',
          onPress: async () => {
            try {
              await makeGroupAdmin(conversation.id, memberId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Refresh to get latest data from server
              await refreshConversation();
            } catch (error: any) {
              console.error('Error making admin:', error);
              Alert.alert('Error', error.message || 'Failed to make admin');
            }
          },
        },
      ]
    );
  }, [conversation, isAdmin, makeGroupAdmin, refreshConversation]);

  const handleLeaveGroup = useCallback(async () => {
    if (!conversation) return;

    const memberCount = conversation.participants.length;
    const isOnlyAdmin = isAdmin && (conversation.admin_ids?.length || 0) === 1 && memberCount > 1;

    if (isOnlyAdmin) {
      Alert.alert(
        'Cannot Leave',
        'You are the only admin. Please make another member an admin before leaving.',
      );
      return;
    }

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              await leaveGroup(conversation.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/(tabs)/messages' as any);
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert('Error', 'Failed to leave group');
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ]
    );
  }, [conversation, isAdmin, leaveGroup, router]);

  const handleAddMembers = useCallback(() => {
    // Navigate to find-users with group context
    router.push(`/find-users?groupId=${conversation?.id}` as any);
  }, [conversation, router]);

  if (!conversation) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  const avatarColor = getAvatarColor(conversation.id);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        {isAdmin && !isEditing && (
          <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.pressed]} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        )}
        {isEditing && (
          <Pressable
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
            onPress={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={C.gold} />
            ) : (
              <Text style={styles.editButtonText}>Save</Text>
            )}
          </Pressable>
        )}
        {!isAdmin && <View style={styles.editButton} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Avatar & Info */}
        <View style={styles.groupHeader}>
          <View style={[styles.groupAvatar, { backgroundColor: avatarColor }]}>
            {conversation.group_avatar_url ? (
              <Image
                source={{ uri: conversation.group_avatar_url }}
                style={styles.groupAvatarImage}
              />
            ) : (
              <Ionicons name="people" size={48} color={C.ivory} />
            )}
          </View>

          {isEditing ? (
            <TextInput
              style={styles.groupNameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Group name"
              placeholderTextColor={C.muted}
              maxLength={50}
            />
          ) : (
            <Text style={styles.groupName}>{conversation.group_name}</Text>
          )}

          <Text style={styles.groupMemberCount}>
            {conversation.participants.length} members
          </Text>

          {isEditing ? (
            <TextInput
              style={styles.groupDescriptionInput}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Add a group description..."
              placeholderTextColor={C.muted}
              multiline
              maxLength={200}
            />
          ) : conversation.group_description ? (
            <Text style={styles.groupDescription}>{conversation.group_description}</Text>
          ) : null}
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            {isAdmin && (
              <Pressable style={({ pressed }) => [styles.addMemberButton, pressed && styles.pressed]} onPress={handleAddMembers}>
                <Ionicons name="person-add" size={18} color={C.gold} />
                <Text style={styles.addMemberText}>Add</Text>
              </Pressable>
            )}
          </View>

          {conversation.participant_details.map((participant) => (
            <MemberItem
              key={participant.user_id}
              participant={participant}
              isCurrentUser={participant.user_id === user?.id}
              isAdmin={conversation.admin_ids?.includes(participant.user_id) ?? false}
              canManage={isAdmin}
              onMakeAdmin={() => handleMakeAdmin(participant.user_id, participant.full_name || 'this member')}
              onRemove={() => handleRemoveMember(participant.user_id, participant.full_name || 'this member')}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.dangerButton, pressed && styles.dangerButtonPressed]}
            onPress={handleLeaveGroup}
            disabled={isLeaving}
          >
            {isLeaving ? (
              <ActivityIndicator size="small" color={C.terracotta} />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color={C.terracotta} />
                <Text style={styles.dangerButtonText}>Leave Group</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    letterSpacing: -0.3,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.cardBg,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  content: {
    flex: 1,
  },

  // Group header
  groupHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: C.ivory,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
  },
  groupAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...SHADOW_SOFT,
  },
  groupAvatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  groupName: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  groupNameInput: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
    paddingBottom: 6,
    minWidth: 200,
    letterSpacing: -0.5,
  },
  groupMemberCount: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  groupDescription: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  groupDescriptionInput: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.charcoal,
    textAlign: 'center',
    lineHeight: 22,
    borderWidth: 0.5,
    borderColor: C.hairline,
    borderRadius: 16,
    padding: 16,
    minWidth: 280,
    minHeight: 70,
    backgroundColor: C.cardBg,
  },

  // Section
  section: {
    backgroundColor: C.ivory,
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: C.hairline,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    letterSpacing: -0.3,
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  addMemberText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },

  // Member item
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    ...SHADOW_SOFT,
  },
  memberAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberAvatarText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  memberUsername: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 3,
  },
  memberOptionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
  },
  memberOptionsButtonPressed: {
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
    transform: [{ scale: 0.95 }],
  },
  adminBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Danger button
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    marginHorizontal: 20,
    borderRadius: 28,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(198, 110, 78, 0.2)',
  },
  dangerButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  dangerButtonText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
});
