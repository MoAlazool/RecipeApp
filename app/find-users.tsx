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
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/stores/authStore';
import { useMessagingStore } from '@/stores/messagingStore';
import { EmptyState } from '@/components/ui/EmptyState';
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
  cardBg: 'rgba(26, 21, 16, 0.03)',
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
  onPress: () => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  isAlreadyMember?: boolean;
}

const UserItem = ({ user, onPress, isSelected, isSelectionMode, isAlreadyMember }: UserItemProps) => {
  const avatarColor = getAvatarColor(user.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.userItem,
        isSelected && styles.userItemSelected,
        isAlreadyMember && styles.userItemDisabled,
        pressed && !isAlreadyMember && styles.userItemPressed,
      ]}
      onPress={onPress}
      disabled={isAlreadyMember}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{getInitials(user.full_name)}</Text>
        )}
      </View>

      <View style={styles.userContent}>
        <Text style={[styles.userName, isAlreadyMember && styles.userNameDisabled]} numberOfLines={1}>
          {user.full_name || 'Unknown User'}
        </Text>
        {isAlreadyMember ? (
          <Text style={styles.userAlreadyMember}>Already a member</Text>
        ) : user.bio ? (
          <Text style={styles.userBio} numberOfLines={1}>
            {user.bio}
          </Text>
        ) : null}
      </View>

      {isSelectionMode ? (
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color={C.ivory} />}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={C.muted} />
      )}
    </Pressable>
  );
};

export default function FindUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const { user } = useAuthStore();
  const { addGroupMembers, getConversation } = useMessagingStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [existingMembers, setExistingMembers] = useState<Set<string>>(new Set());

  // Check if we're in "add to group" mode
  const isGroupMode = !!groupId;

  // Load existing group members
  useEffect(() => {
    const loadGroupMembers = async () => {
      if (!groupId) return;
      const conversation = await getConversation(groupId);
      if (conversation) {
        setExistingMembers(new Set(conversation.participants));
      }
    };
    loadGroupMembers();
  }, [groupId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch();
      } else if (searchQuery.trim().length === 0) {
        setUsers([]);
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const results = await userService.searchUsers(searchQuery);
      // Filter out current user
      const filtered = results.filter(u => u.id !== user?.id);
      setUsers(filtered);
    } catch (error) {
      console.error('Search error:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, user?.id]);

  const handleUserPress = useCallback((selectedUser: UserProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isGroupMode) {
      // Toggle selection for group mode
      setSelectedUsers(prev => {
        const next = new Set(prev);
        if (next.has(selectedUser.id)) {
          next.delete(selectedUser.id);
        } else {
          next.add(selectedUser.id);
        }
        return next;
      });
    } else {
      // Navigate to chat with this user
      router.push(`/chat/${selectedUser.id}` as any);
    }
  }, [router, isGroupMode]);

  const handleAddMembers = useCallback(async () => {
    if (!groupId || selectedUsers.size === 0) return;

    setIsAddingMembers(true);
    try {
      await addGroupMembers(groupId, Array.from(selectedUsers));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Members Added',
        `${selectedUsers.size} member(s) added to the group.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error adding members:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to add members');
    } finally {
      setIsAddingMembers(false);
    }
  }, [groupId, selectedUsers, addGroupMembers, router]);

  const renderUser = useCallback(({ item }: { item: UserProfile }) => (
    <UserItem
      user={item}
      onPress={() => handleUserPress(item)}
      isSelected={selectedUsers.has(item.id)}
      isSelectionMode={isGroupMode}
      isAlreadyMember={existingMembers.has(item.id)}
    />
  ), [handleUserPress, selectedUsers, isGroupMode, existingMembers]);

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      {/* Modal Handle */}
      <View style={styles.modalHandleContainer}>
        <View style={styles.modalHandle} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={20} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isGroupMode ? 'Add Members' : 'Find Users'}
        </Text>
        {isGroupMode && selectedUsers.size > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            onPress={handleAddMembers}
            disabled={isAddingMembers}
          >
            {isAddingMembers ? (
              <ActivityIndicator size="small" color={C.ivory} />
            ) : (
              <Text style={styles.addButtonText}>Add ({selectedUsers.size})</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={C.muted} />
          <TextInput
            style={styles.searchTextInput}
            placeholder="Search by name..."
            placeholderTextColor={C.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={[
            styles.listContent,
            users.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            hasSearched ? (
              <EmptyState
                icon="person-outline"
                title="No users found"
                subtitle={`No results for "${searchQuery}"`}
              />
            ) : (
              <View style={styles.hintContainer}>
                <Ionicons name="search" size={48} color={C.hairline} />
                <Text style={styles.hintText}>
                  {isGroupMode
                    ? 'Search for users by their name to add to the group'
                    : 'Search for users by their name to start a conversation'}
                </Text>
              </View>
            )
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.18)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
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
  headerPlaceholder: {
    width: 70,
  },
  addButton: {
    backgroundColor: C.terracotta,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  addButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.ivory,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 24,
    paddingHorizontal: 18,
    gap: 12,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  searchTextInput: {
    flex: 1,
    height: 52,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.charcoal,
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
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
  },
  userItemSelected: {
    borderColor: C.gold,
    borderWidth: 2,
    backgroundColor: 'rgba(212, 175, 55, 0.04)',
  },
  userItemDisabled: {
    opacity: 0.5,
  },
  userItemPressed: {
    opacity: 0.7,
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
  userNameDisabled: {
    color: C.muted,
  },
  userBio: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 3,
  },
  userAlreadyMember: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.gold,
    marginTop: 3,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
  },
  checkboxSelected: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 12,
  },
  hintContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  hintText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
});
