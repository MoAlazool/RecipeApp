import { useState, useCallback, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useMessagingStore } from '@/stores/messagingStore';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/utils/types';

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
  cream: '#F8F6F5',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
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
          <Image
            source={{ uri: user.avatar_url }}
            style={styles.avatarImage}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
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
        {isSelected && <Ionicons name="checkmark" size={14} color={C.ivory} />}
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

      const group = await createGroup(
        groupName.trim(),
        memberIds,
        groupDescription.trim() || undefined
      );

      if (group) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({
          pathname: '/chat/[userId]' as any,
          params: { userId: 'group', conversationId: group.id },
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to create group. Please try again.');
      }
    } catch (error: any) {
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
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: 0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Modal Handle */}
      <View style={styles.modalHandleContainer}>
        <View style={styles.modalHandle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name={step === 'members' ? 'close' : 'chevron-back'} size={22} color={C.charcoal} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {step === 'members' ? 'New Group' : 'Group Details'}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.nextButton,
            !canProceed && styles.nextButtonDisabled,
            pressed && canProceed && styles.nextButtonPressed,
          ]}
          onPress={step === 'members' ? handleNext : handleCreate}
          disabled={!canProceed || isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color={C.ivory} />
          ) : (
            <Text style={[styles.nextButtonText, !canProceed && styles.nextButtonTextDisabled]}>
              {step === 'members' ? 'Next' : 'Create'}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Gold hairline */}
      <View style={styles.headerHairline} />

      {step === 'members' ? (
        <>
          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <View style={styles.selectedContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedScroll}
              >
                {selectedMembers.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.selectedMember}
                    onPress={() => removeMember(member.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.selectedAvatar, { backgroundColor: getAvatarColor(member.id) }]}>
                      {member.avatar_url ? (
                        <Image
                          source={{ uri: member.avatar_url }}
                          style={styles.selectedAvatarImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <Text style={styles.selectedAvatarText}>{getInitials(member.full_name)}</Text>
                      )}
                      <View style={styles.removeIcon}>
                        <Ionicons name="close" size={10} color={C.ivory} />
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
              <Ionicons name="search" size={18} color={C.muted} />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search users to add..."
                placeholderTextColor={C.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Results */}
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={C.gold} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              contentContainerStyle={[
                styles.listContent,
                searchResults.length === 0 && styles.listContentEmpty,
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => (
                searchQuery.length >= 2 ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                      <Ionicons name="person-outline" size={40} color={C.gold} />
                    </View>
                    <Text style={styles.emptyTitle}>No users found</Text>
                    <Text style={styles.emptySubtitle}>
                      Try a different search term
                    </Text>
                  </View>
                ) : (
                  <View style={styles.hintContainer}>
                    <View style={styles.hintIconContainer}>
                      <Ionicons name="people-outline" size={40} color={C.gold} />
                    </View>
                    <Text style={styles.hintTitle}>Add Members</Text>
                    <Text style={styles.hintSubtitle}>
                      Search for users to invite to your group
                    </Text>
                  </View>
                )
              )}
            />
          )}
        </>
      ) : (
        /* Group Details */
        <ScrollView
          style={styles.detailsContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.groupIconContainer}>
            <View style={styles.groupIcon}>
              <Ionicons name="people" size={36} color={C.gold} />
            </View>
            <Text style={styles.groupIconLabel}>Group Avatar</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter a name for your group"
              placeholderTextColor={C.muted}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
            />
            <Text style={styles.inputHint}>{groupName.length}/50</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description <Text style={styles.inputLabelOptional}>(optional)</Text></Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              placeholder="What's this group about?"
              placeholderTextColor={C.muted}
              value={groupDescription}
              onChangeText={setGroupDescription}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.inputHint}>{groupDescription.length}/200</Text>
          </View>

          <View style={styles.membersPreview}>
            <View style={styles.membersPreviewHeader}>
              <Ionicons name="people" size={20} color={C.gold} />
              <Text style={styles.membersPreviewTitle}>
                {selectedMembers.length + 1} Members
              </Text>
            </View>
            <View style={styles.membersPreviewAvatars}>
              {/* Show current user first */}
              <View style={[styles.previewAvatar, { backgroundColor: getAvatarColor(user?.id || ''), zIndex: 10 }]}>
                {user?.avatar_url ? (
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={styles.previewAvatarImage}
                    contentFit="cover"
                  />
                ) : (
                  <Text style={styles.previewAvatarText}>{getInitials(user?.full_name)}</Text>
                )}
              </View>
              {/* Show selected members */}
              {selectedMembers.slice(0, 4).map((member, index) => (
                <View
                  key={member.id}
                  style={[
                    styles.previewAvatar,
                    { backgroundColor: getAvatarColor(member.id), marginLeft: -10, zIndex: 9 - index }
                  ]}
                >
                  {member.avatar_url ? (
                    <Image
                      source={{ uri: member.avatar_url }}
                      style={styles.previewAvatarImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={styles.previewAvatarText}>{getInitials(member.full_name)}</Text>
                  )}
                </View>
              ))}
              {selectedMembers.length > 4 && (
                <View style={[styles.previewAvatar, styles.previewAvatarMore, { marginLeft: -10 }]}>
                  <Text style={styles.previewAvatarMoreText}>+{selectedMembers.length - 4}</Text>
                </View>
              )}
            </View>
            <Text style={styles.membersPreviewSubtitle}>
              You and {selectedMembers.length} other{selectedMembers.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.cream,
  },

  // Modal Handle
  modalHandleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: C.ivory,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: C.ivory,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  headerTitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  nextButton: {
    backgroundColor: C.terracotta,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    ...SHADOW_SOFT,
    shadowColor: C.terracotta,
    shadowOpacity: 0.3,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  nextButtonDisabled: {
    backgroundColor: C.hairline,
    shadowOpacity: 0,
  },
  nextButtonText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.ivory,
  },
  nextButtonTextDisabled: {
    color: C.muted,
  },
  headerHairline: {
    height: 0.5,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },

  // Selected Members
  selectedContainer: {
    backgroundColor: C.ivory,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    paddingVertical: 16,
  },
  selectedScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  selectedMember: {
    alignItems: 'center',
    width: 64,
  },
  selectedAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW_SOFT,
  },
  selectedAvatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  selectedAvatarText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  removeIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.ivory,
  },
  selectedName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    marginTop: 6,
    textAlign: 'center',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: C.ivory,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  searchTextInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.charcoal,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flex: 1,
  },

  // User Item
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.ivory,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  userItemSelected: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  userItemPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    ...SHADOW_SOFT,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  userContent: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  userUsername: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 2,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.ivory,
  },
  checkboxSelected: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
  },

  // Hint State
  hintContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  hintIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  hintTitle: {
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    marginBottom: 8,
  },
  hintSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Details Step
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  groupIconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  groupIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderStyle: 'dashed',
  },
  groupIconLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 12,
  },

  // Input Group
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    marginBottom: 10,
  },
  inputLabelOptional: {
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
  },
  textInput: {
    backgroundColor: C.ivory,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.charcoal,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  inputHint: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'right',
    marginTop: 6,
  },

  // Members Preview
  membersPreview: {
    backgroundColor: C.ivory,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  membersPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  membersPreviewTitle: {
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  membersPreviewAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.ivory,
  },
  previewAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  previewAvatarText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  previewAvatarMore: {
    backgroundColor: C.muted,
  },
  previewAvatarMoreText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  membersPreviewSubtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
  },
});
