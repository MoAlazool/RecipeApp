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
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
import { useAuthStore } from '@/stores/authStore';
import { EmptyState } from '@/components/ui/EmptyState';
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
  onPress: () => void;
}

const UserItem = ({ user, onPress }: UserItemProps) => {
  const avatarColor = getAvatarColor(user.id);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.userItem,
        pressed && styles.userItemPressed,
      ]}
      onPress={onPress}
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
        {user.bio && (
          <Text style={styles.userBio} numberOfLines={1}>
            {user.bio}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9C5749" />
    </Pressable>
  );
};

export default function FindUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
      setUsers(results);
    } catch (error) {
      console.error('Search error:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleUserPress = useCallback((selectedUser: UserProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to chat with this user
    router.push(`/chat/${selectedUser.id}` as any);
  }, [router]);

  const handleViewProfile = useCallback((selectedUser: UserProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/profile/${selectedUser.id}` as any);
  }, [router]);

  const renderUser = useCallback(({ item }: { item: UserProfile }) => (
    <UserItem user={item} onPress={() => handleUserPress(item)} />
  ), [handleUserPress]);

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
        <Text style={styles.headerTitle}>Find Users</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color="#9C5749" />
          <TextInput
            style={styles.searchTextInput}
            placeholder="Search by name..."
            placeholderTextColor="#9C5749"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9C5749" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
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
                <Ionicons name="search" size={48} color="#E8D3CE" />
                <Text style={styles.hintText}>
                  Search for users by their name to start a conversation
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
  userBio: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
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
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
});
