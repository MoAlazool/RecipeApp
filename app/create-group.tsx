import { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/utils/types';

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

interface UserItemProps {
  user: UserProfile;
  isSelected: boolean;
  onToggle: () => void;
}

const UserItem = ({ user, isSelected, onToggle }: UserItemProps) => {
  const avatarColor = getAvatarColor(user.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.userItem,
        isSelected && styles.userItemSelected,
        pressed && styles.userItemPressed,
      ]}
      onPress={onToggle}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{getInitials(user.full_name)}</Text>
        )}
      </View>

      <View style={styles.userContent}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.full_name || 'Unknown User'}
        </Text>
        {user.username && (
          <Text style={styles.userUsername}>@{user.username}</Text>
        )}
      </View>

      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
        {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
};

export default function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { createGroup } = useMessagingStore();

  const [step, setStep] = useState<'members' | 'details'>('members');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const toggleMember = useCallback((member: UserProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers(prev => {
      const exists = prev.some(m => m.id === member.id);
      if (exists) {
        return prev.filter(m => m.id !== member.id);
      }
      if (prev.length >= 49) {
        return prev; // Max 50 members including creator
      }
      return [...prev, member];
    });
  }, []);

  const removeMember = useCallback((memberId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMembers(prev => prev.filter(m => m.id !== memberId));
  }, []);

  const handleNext = useCallback(() => {
    if (selectedMembers.length < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('details');
  }, [selectedMembers]);

  const handleBack = useCallback(() => {
    if (step === 'details') {
      setStep('members');
    } else {
      router.back();
    }
  }, [step, router]);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim() || selectedMembers.length < 1 || isCreating) return;

    setIsCreating(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const memberIds = selectedMembers.map(m => m.id);

      console.log('[CreateGroup] Creating group with name:', groupName.trim());
      console.log('[CreateGroup] Member IDs:', memberIds);

      const group = await createGroup(
        groupName.trim(),
        memberIds,
        groupDescription.trim() || undefined
      );

      console.log('[CreateGroup] Group created:', group);

      if (group) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Navigate to the new group chat using conversationId parameter
        router.replace({
          pathname: '/chat/[userId]' as any,
          params: { userId: 'group', conversationId: group.id },
        });
      } else {
        console.error('[CreateGroup] Group creation returned null');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to create group. Please try again.');
      }
    } catch (error: any) {
      console.error('[CreateGroup] Error creating group:', error);
      console.error('[CreateGroup] Error message:', error?.message);
      console.error('[CreateGroup] Error code:', error?.code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Failed to Create Group',
        error?.message || 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  }, [groupName, groupDescription, selectedMembers, createGroup, router, isCreating]);

  const renderUserItem = useCallback(({ item }: { item: UserProfile }) => (
    <UserItem
      user={item}
      isSelected={selectedMembers.some(m => m.id === item.id)}
      onToggle={() => toggleMember(item)}
    />
  ), [selectedMembers, toggleMember]);

  const canProceed = step === 'members' ? selectedMembers.length >= 1 : groupName.trim().length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name={step === 'members' ? 'close' : 'chevron-back'} size={24} color="#1C100D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 'members' ? 'New Group' : 'Group Details'}
        </Text>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
          onPress={step === 'members' ? handleNext : handleCreate}
          disabled={!canProceed || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.nextButtonText, !canProceed && styles.nextButtonTextDisabled]}>
              {step === 'members' ? 'Next' : 'Create'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {step === 'members' ? (
        <>
          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <View style={styles.selectedContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedScroll}>
                {selectedMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.selectedMember}
                    onPress={() => removeMember(member.id)}
                  >
                    <View style={[styles.selectedAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                      {member.avatar_url ? (
                        <Image source={{ uri: member.avatar_url }} style={styles.selectedAvatarImage} />
                      ) : (
                        <Text style={styles.selectedAvatarText}>{getInitials(member.full_name)}</Text>
                      )}
                      <View style={styles.removeIcon}>
                        <Ionicons name="close" size={10} color="#FFFFFF" />
                      </View>
                    </View>
                    <Text style={styles.selectedName} numberOfLines={1}>
                      {member.full_name?.split(' ')[0] || 'User'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInput}>
              <Ionicons name="search" size={20} color="#9C5749" />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search users..."
                placeholderTextColor="#9C5749"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#9C5749" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Results */}
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F2330D" />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                searchQuery.length >= 2 ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="person-outline" size={48} color="#E8D3CE" />
                    <Text style={styles.emptyText}>No users found</Text>
                  </View>
                ) : (
                  <View style={styles.hintContainer}>
                    <Ionicons name="people" size={48} color="#E8D3CE" />
                    <Text style={styles.hintText}>
                      Search for users to add to your group
                    </Text>
                  </View>
                )
              )}
            />
          )}
        </>
      ) : (
        /* Group Details */
        <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.groupIconContainer}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={40} color="#F2330D" />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Group Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter group name"
              placeholderTextColor="#C8B7B2"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What's this group about?"
              placeholderTextColor="#C8B7B2"
              value={groupDescription}
              onChangeText={setGroupDescription}
              maxLength={200}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.membersPreview}>
            <Text style={styles.membersPreviewTitle}>
              {selectedMembers.length + 1} members
            </Text>
            <Text style={styles.membersPreviewSubtitle}>
              You and {selectedMembers.length} other{selectedMembers.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </ScrollView>
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
  nextButton: {
    backgroundColor: '#F2330D',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nextButtonDisabled: {
    backgroundColor: '#E8D3CE',
  },
  nextButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  nextButtonTextDisabled: {
    color: '#9C5749',
  },
  selectedContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    paddingBottom: 12,
  },
  selectedScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  selectedMember: {
    alignItems: 'center',
    width: 60,
  },
  selectedAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  selectedAvatarText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  removeIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1C100D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedName: {
    fontSize: 11,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
    marginTop: 4,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  userItemSelected: {
    backgroundColor: 'rgba(242, 51, 13, 0.05)',
    borderWidth: 1,
    borderColor: '#F2330D',
  },
  userItemPressed: {
    opacity: 0.7,
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
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8D3CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#F2330D',
    borderColor: '#F2330D',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 12,
  },
  hintContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  hintText: {
    fontSize: 15,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  groupIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  groupIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: 'NotoSans_400Regular',
    color: '#1C100D',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  membersPreview: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  membersPreviewTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  membersPreviewSubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 4,
  },
});
