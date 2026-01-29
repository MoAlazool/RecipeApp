import { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
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

export default function FollowersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();

  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const fetchFollowers = useCallback(async () => {
    if (!user?.id) return;

    try {
      const followersList = await userService.getFollowers(user.id);
      setFollowers(followersList);

      // Check which ones current user is following back
      const followingStatus: Record<string, boolean> = {};
      await Promise.all(
        followersList.map(async (follower) => {
          followingStatus[follower.id] = await userService.isFollowing(follower.id);
        })
      );
      setFollowingMap(followingStatus);
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFollowers();
  }, [fetchFollowers]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFollowers();
  }, [fetchFollowers]);

  const handleToggleFollow = useCallback(async (targetUserId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isCurrentlyFollowing = followingMap[targetUserId];

    // Optimistic update
    setFollowingMap(prev => ({ ...prev, [targetUserId]: !isCurrentlyFollowing }));

    try {
      if (isCurrentlyFollowing) {
        await userService.unfollowUser(targetUserId);
      } else {
        await userService.followUser(targetUserId);
      }
    } catch (error) {
      // Revert on error
      setFollowingMap(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing }));
      console.error('Error toggling follow:', error);
    }
  }, [followingMap]);

  const handleViewProfile = useCallback((userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/profile/${userId}` as any);
  }, [router]);

  const renderFollower = useCallback(({ item }: { item: UserProfile }) => {
    const isFollowing = followingMap[item.id];

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
          style={[styles.followButton, isFollowing && styles.followButtonActive]}
          onPress={() => handleToggleFollow(item.id)}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [followingMap, handleToggleFollow, handleViewProfile]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#1C100D" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Followers</Text>
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
        <Text style={styles.headerTitle}>Followers</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={followers}
        renderItem={renderFollower}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#F2330D" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#E8D3CE" />
            <Text style={styles.emptyText}>No followers yet</Text>
            <Text style={styles.emptySubtext}>Share your recipes to get followers!</Text>
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
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2330D',
  },
  followButtonActive: {
    backgroundColor: '#F5F0EE',
  },
  followButtonText: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  followButtonTextActive: {
    color: '#9C5749',
  },
  emptyContainer: {
    alignItems: 'center',
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
  },
});
