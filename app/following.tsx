import { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { userService } from '@/services/user.service';
import type { UserProfile } from '@/utils/types';

const AVATAR_COLORS = [
  '#F2330D', '#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6',
];

const getAvatarColor = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
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

export default function FollowingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchFollowing = useCallback(async () => {
    if (!user?.id) return;

    try {
      const followingList = await userService.getFollowing(user.id);
      setFollowing(followingList);
    } catch (error) {
      console.error('Error fetching following:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFollowing();
  }, [fetchFollowing]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFollowing();
  }, [fetchFollowing]);

  const handleUnfollow = useCallback(async (targetUser: UserProfile) => {
    Alert.alert(
      'Unfollow',
      `Are you sure you want to unfollow ${targetUser.full_name || targetUser.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            // Optimistic update
            setFollowing(prev => prev.filter(u => u.id !== targetUser.id));

            try {
              await userService.unfollowUser(targetUser.id);
            } catch (error) {
              // Revert on error
              setFollowing(prev => [...prev, targetUser]);
              console.error('Error unfollowing:', error);
            }
          },
        },
      ]
    );
  }, []);

  const handleViewProfile = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/profile/${userId}` as any);
  }, [router]);

  const renderFollowing = useCallback(({ item }: { item: UserProfile }) => {
    return (
      <TouchableOpacity style={styles.userRow} onPress={() => handleViewProfile(item.id)}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.id) }]}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(item.full_name)}</Text>
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.full_name || 'Unknown User'}</Text>
          {item.username && <Text style={styles.userUsername}>@{item.username}</Text>}
        </View>

        <TouchableOpacity
          style={styles.followingButton}
          onPress={() => handleUnfollow(item)}
        >
          <Text style={styles.followingButtonText}>Following</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [handleUnfollow, handleViewProfile]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1C100D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Following</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1C100D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Following</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={following}
        renderItem={renderFollowing}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#F2330D" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="person-add-outline" size={48} color="#E8D3CE" />
            <Text style={styles.emptyText}>Not following anyone yet</Text>
            <Text style={styles.emptySubtext}>Find friends to follow and share recipes!</Text>
            <TouchableOpacity
              style={styles.findFriendsButton}
              onPress={() => router.push('/find-users' as any)}
            >
              <Ionicons name="search" size={18} color="#FFFFFF" />
              <Text style={styles.findFriendsText}>Find Friends</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE8',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
  },
  userUsername: {
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 2,
  },
  followingButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F0EE',
  },
  followingButtonText: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#C8B7B2',
    marginTop: 4,
    textAlign: 'center',
  },
  findFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  findFriendsText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
});
