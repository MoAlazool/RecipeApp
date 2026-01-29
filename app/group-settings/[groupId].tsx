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
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import type { Conversation, ConversationParticipant } from '@/utils/types';

// Avatar colors based on user ID
const AVATAR_COLORS = [
  '#F2330D', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6',
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

  const handleLongPress = () => {
    if (!canManage || isCurrentUser) return;

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
    <TouchableOpacity
      style={styles.memberItem}
      onLongPress={handleLongPress}
      activeOpacity={canManage && !isCurrentUser ? 0.7 : 1}
    >
      <View style={[styles.memberAvatar, { backgroundColor: avatarColor }]}>
        {participant.avatar_url ? (
          <Image source={{ uri: participant.avatar_url }} style={styles.memberAvatarImage} />
        ) : (
          <Text style={styles.memberAvatarText}>{getInitials(participant.full_name)}</Text>
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
        <Ionicons name="ellipsis-vertical" size={18} color="#9C5749" />
      )}
    </TouchableOpacity>
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

  useEffect(() => {
    const loadConversation = async () => {
      if (!groupId) return;

      // Try to use currentConversation first
      if (currentConversation?.id === groupId) {
        setConversation(currentConversation);
        setEditName(currentConversation.group_name || '');
        setEditDescription(currentConversation.group_description || '');
        return;
      }

      // Otherwise fetch it
      const conv = await getConversation(groupId);
      if (conv) {
        setConversation(conv);
        setEditName(conv.group_name || '');
        setEditDescription(conv.group_description || '');
      }
    };

    loadConversation();
  }, [groupId, currentConversation]);

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

      // Update local state
      setConversation(prev => prev ? {
        ...prev,
        group_name: editName.trim(),
        group_description: editDescription.trim(),
      } : null);
    } catch (error) {
      console.error('Error updating group:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update group info');
    } finally {
      setIsSaving(false);
    }
  }, [conversation, editName, editDescription, isAdmin, updateGroupInfo]);

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

              // Update local state
              setConversation(prev => prev ? {
                ...prev,
                participants: prev.participants.filter(id => id !== memberId),
                participant_details: prev.participant_details.filter(p => p.user_id !== memberId),
              } : null);
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  }, [conversation, isAdmin, removeGroupMember]);

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

              // Update local state
              setConversation(prev => prev ? {
                ...prev,
                admin_ids: [...(prev.admin_ids || []), memberId],
              } : null);
            } catch (error) {
              console.error('Error making admin:', error);
              Alert.alert('Error', 'Failed to make admin');
            }
          },
        },
      ]
    );
  }, [conversation, isAdmin, makeGroupAdmin]);

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
        <ActivityIndicator size="large" color="#F2330D" />
      </View>
    );
  }

  const avatarColor = getAvatarColor(conversation.id);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1C100D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        {isAdmin && !isEditing && (
          <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
        {isEditing && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#F2330D" />
            ) : (
              <Text style={styles.editButtonText}>Save</Text>
            )}
          </TouchableOpacity>
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
              <Ionicons name="people" size={48} color="#FFFFFF" />
            )}
          </View>

          {isEditing ? (
            <TextInput
              style={styles.groupNameInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Group name"
              placeholderTextColor="#C8B7B2"
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
              placeholderTextColor="#C8B7B2"
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
              <TouchableOpacity style={styles.addMemberButton} onPress={handleAddMembers}>
                <Ionicons name="person-add" size={18} color="#F2330D" />
                <Text style={styles.addMemberText}>Add</Text>
              </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleLeaveGroup}
            disabled={isLeaving}
          >
            {isLeaving ? (
              <ActivityIndicator size="small" color="#F44336" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color="#F44336" />
                <Text style={styles.dangerButtonText}>Leave Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
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
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  editButton: {
    width: 60,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
  },
  content: {
    flex: 1,
  },
  groupHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  groupAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  groupAvatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  groupName: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    textAlign: 'center',
    marginBottom: 4,
  },
  groupNameInput: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    textAlign: 'center',
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#F2330D',
    paddingBottom: 4,
    minWidth: 200,
  },
  groupMemberCount: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginBottom: 12,
  },
  groupDescription: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#6E4A42',
    textAlign: 'center',
    lineHeight: 20,
  },
  groupDescriptionInput: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#1C100D',
    textAlign: 'center',
    lineHeight: 20,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    borderRadius: 8,
    padding: 12,
    minWidth: 280,
    minHeight: 60,
    backgroundColor: '#F8F6F5',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addMemberText: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
  },
  memberUsername: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 1,
  },
  adminBadge: {
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 10,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
  },
  dangerButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F44336',
  },
});
