import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { userService } from '@/services/user.service';
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

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      const [userProfile, following] = await Promise.all([
        userService.getUserProfile(userId),
        userService.isFollowing(userId),
      ]);

      setProfile(userProfile);
      setIsFollowing(following);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollow = useCallback(async () => {
    if (!userId || isFollowLoading) return;

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await userService.unfollowUser(userId);
        setIsFollowing(false);
        if (profile) {
          setProfile({ ...profile, followers_count: profile.followers_count - 1 });
        }
      } else {
        await userService.followUser(userId);
        setIsFollowing(true);
        if (profile) {
          setProfile({ ...profile, followers_count: profile.followers_count + 1 });
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error following/unfollowing:', error);
    } finally {
      setIsFollowLoading(false);
    }
  }, [userId, isFollowing, isFollowLoading, profile]);

  const handleMessage = useCallback(() => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${userId}` as any);
  }, [userId, router]);

  const handleBlockUser = useCallback(async () => {
    if (!userId || !profile) return;

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile.full_name || profile.username}? They won't be able to message you or see your recipes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await userService.blockUser(userId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Blocked', `${profile.full_name || 'User'} has been blocked.`);
              router.back();
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', error.message || 'Failed to block user');
            }
          },
        },
      ]
    );
  }, [userId, profile, router]);

  const handleReportUser = useCallback(() => {
    if (!userId || !profile) return;

    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      [
        {
          text: 'Spam',
          onPress: () => submitReport('spam'),
        },
        {
          text: 'Inappropriate Content',
          onPress: () => submitReport('inappropriate_content'),
        },
        {
          text: 'Harassment',
          onPress: () => submitReport('harassment'),
        },
        {
          text: 'Other',
          onPress: () => submitReport('other'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [userId, profile]);

  const submitReport = useCallback(async (reason: string) => {
    if (!userId) return;

    try {
      await userService.reportUser(userId, reason);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
    } catch (error: any) {
      console.error('Error reporting user:', error);
      Alert.alert('Error', error.message || 'Failed to submit report');
    }
  }, [userId]);

  const handleMoreOptions = useCallback(() => {
    if (!userId || currentUser?.id === userId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Block User', 'Report User'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleBlockUser();
          } else if (buttonIndex === 2) {
            handleReportUser();
          }
        }
      );
    } else {
      Alert.alert('Options', undefined, [
        { text: 'Block User', style: 'destructive', onPress: handleBlockUser },
        { text: 'Report User', onPress: handleReportUser },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [userId, handleBlockUser, handleReportUser, currentUser?.id]);

  const avatarColor = getAvatarColor(userId || '');
  const isOwnProfile = currentUser?.id === userId;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#1C100D" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#1C100D" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="person-outline" size={48} color="#E8D3CE" />
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top }}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={fetchProfile} tintColor="#F2330D" />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#1C100D" />
        </TouchableOpacity>
        {!isOwnProfile && (
          <TouchableOpacity style={styles.menuButton} onPress={handleMoreOptions}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#1C100D" />
          </TouchableOpacity>
        )}
        {isOwnProfile && <View style={styles.menuButton} />}
      </View>

      {/* Profile Info */}
      <View style={styles.profileSection}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(profile.full_name)}</Text>
          )}
          {profile.is_online && <View style={styles.onlineIndicator} />}
        </View>

        <Text style={styles.profileName}>{profile.full_name || 'Unknown User'}</Text>
        {profile.username && (
          <Text style={styles.profileUsername}>@{profile.username}</Text>
        )}
        {profile.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.recipes_count}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.followers_count}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.following_count}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!isOwnProfile && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followButtonActive,
              ]}
              onPress={handleFollow}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? '#F2330D' : '#FFFFFF'} />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? 'person-remove' : 'person-add'}
                    size={18}
                    color={isFollowing ? '#F2330D' : '#FFFFFF'}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowing && styles.followButtonTextActive,
                    ]}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
              <Ionicons name="chatbubble-outline" size={18} color="#F2330D" />
              <Text style={styles.messageButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Public Recipes Section (placeholder) */}
      <View style={styles.recipesSection}>
        <Text style={styles.sectionTitle}>Public Recipes</Text>
        <View style={styles.emptyRecipes}>
          <Ionicons name="restaurant-outline" size={32} color="#E8D3CE" />
          <Text style={styles.emptyRecipesText}>
            {isOwnProfile ? 'You haven\'t shared any recipes yet' : 'No public recipes yet'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 12,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 36,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#F8F6F5',
  },
  profileName: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
    marginBottom: 8,
  },
  profileBio: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  followButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2330D',
    shadowOpacity: 0.1,
  },
  followButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#FFFFFF',
  },
  followButtonTextActive: {
    color: '#F2330D',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F2330D',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  messageButtonText: {
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
  },
  recipesSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 16,
  },
  emptyRecipes: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyRecipesText: {
    fontSize: 14,
    fontFamily: 'NotoSans_400Regular',
    color: '#9C5749',
    marginTop: 12,
  },
});
