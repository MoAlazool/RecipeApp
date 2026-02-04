import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Image, RefreshControl, Linking } from 'react-native';
import { Text, ListItem, Button, Switch } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { userService } from '@/services/user.service';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { user, signOut, isAuthenticated } = useAuthStore();

  // Preferences
  const {
    darkMode,
    notificationsEnabled,
    voiceFeedback,
    privateAccount,
    setDarkMode,
    setNotificationsEnabled,
    setVoiceFeedback,
    setPrivateAccount,
  } = usePreferencesStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch full profile with stats
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      const fullProfile = await userService.getUserProfile(user.id);
      setProfile(fullProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchProfile();
    }
  }, [isAuthenticated, user?.id, fetchProfile]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        }
      },
    ]);
  };

  const handleFindFriends = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/find-users' as any);
  };

  const handleViewFollowers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/followers' as any);
  };

  const handleViewFollowing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/following' as any);
  };

  const handleBlockedUsers = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/blocked-users' as any);
  };

  const handleDietaryPreferences = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Dietary Preferences',
      'Set your dietary restrictions and preferences to get personalized recipe suggestions.',
      [
        { text: 'Vegetarian', onPress: () => {} },
        { text: 'Vegan', onPress: () => {} },
        { text: 'Gluten-Free', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleToggleDarkMode = (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDarkMode(enabled);
    // Note: Actual dark mode implementation would require theme context
  };

  const handleToggleNotifications = (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(enabled);
  };

  const handleToggleVoiceFeedback = (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoiceFeedback(enabled);
  };

  const handleTogglePrivateAccount = async (enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrivateAccount(enabled);
    try {
      await userService.updateUserProfile({ is_public: !enabled });
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      setPrivateAccount(!enabled); // Revert on error
    }
  };

  const handleHelpFAQ = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://recipeapp.com/help');
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:support@recipeapp.com?subject=Support%20Request');
  };

  const handleTermsPrivacy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('https://recipeapp.com/terms');
  };

  if (!isAuthenticated) {
    return (
      <TabScreenTransition style={styles.authContainer}>
        <View style={[styles.authContainer, { paddingTop: insets.top + 8 }]}>
          <Ionicons name="person-circle-outline" size={96} color="#C8B7B2" />
          <Text h4 style={styles.authTitle}>Sign in to sync your recipes</Text>
          <Text style={styles.authSubtitle}>
            Create an account to save recipes across devices and unlock premium features
          </Text>
          <Button
            title="Sign In"
            onPress={() => router.push('/auth')}
            buttonStyle={styles.authButton}
            titleStyle={styles.authButtonText}
          />
          <Button
            title="Create Account"
            type="outline"
            onPress={() => router.push('/auth?mode=signup')}
            buttonStyle={styles.authButtonOutline}
            titleStyle={styles.authButtonOutlineText}
          />
        </View>
      </TabScreenTransition>
    );
  }

  return (
    <TabScreenTransition style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomTabBarHeight + 20 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#F2330D"
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{getInitials(user?.full_name || user?.email)}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.editAvatarButton}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.name}>{user?.full_name || 'Recipe Lover'}</Text>

          {user?.username ? (
            <Text style={styles.username}>@{user.username}</Text>
          ) : (
            <TouchableOpacity onPress={() => router.push('/setup-username' as any)}>
              <Text style={styles.setUsername}>Set your @username</Text>
            </TouchableOpacity>
          )}

          {user?.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.premiumText}>Pro Member</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statItem} onPress={handleViewFollowers}>
            <Text style={styles.statNumber}>{profile?.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statItem} onPress={handleViewFollowing}>
            <Text style={styles.statNumber}>{profile?.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{profile?.recipes_count || 0}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton} onPress={handleFindFriends}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionText}>Find Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/(tabs)/messages' as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="chatbubbles" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionText}>Messages</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push('/create-group' as any)}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#22C55E' }]}>
              <Ionicons name="people" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionText}>New Group</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <ListItem containerStyle={styles.listItem} onPress={() => router.push('/edit-profile' as any)}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="person-outline" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.listTitle}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={() => router.push('/setup-username' as any)}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
                <Ionicons name="at-outline" size={18} color="#A855F7" />
              </View>
              <Text style={styles.listTitle}>Change Username</Text>
              <Text style={styles.listValue}>@{user?.username || 'not set'}</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={handleDietaryPreferences}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Ionicons name="restaurant-outline" size={18} color="#22C55E" />
              </View>
              <Text style={styles.listTitle}>Dietary Preferences</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={() => router.push('/paywall')}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(242, 51, 13, 0.1)' }]}>
                <Ionicons name="diamond-outline" size={18} color="#F2330D" />
              </View>
              <Text style={[styles.listTitle, styles.upgradeText]}>
                {user?.is_premium ? 'Manage Subscription' : 'Upgrade to Pro'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(156, 87, 73, 0.1)' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#9C5749" />
              </View>
              <Text style={styles.listTitle}>Private Account</Text>
              <Switch value={privateAccount} onValueChange={handleTogglePrivateAccount} />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={handleBlockedUsers}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="ban-outline" size={18} color="#EF4444" />
              </View>
              <Text style={styles.listTitle}>Blocked Users</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                <Ionicons name="moon-outline" size={18} color="#6366F1" />
              </View>
              <Text style={styles.listTitle}>Dark Mode</Text>
              <Switch value={darkMode} onValueChange={handleToggleDarkMode} />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="notifications-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.listTitle}>Notifications</Text>
              <Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(6, 182, 212, 0.1)' }]}>
                <Ionicons name="volume-high-outline" size={18} color="#06B6D4" />
              </View>
              <Text style={styles.listTitle}>Voice Feedback</Text>
              <Switch value={voiceFeedback} onValueChange={handleToggleVoiceFeedback} />
            </View>
          </ListItem>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <ListItem containerStyle={styles.listItem} onPress={handleHelpFAQ}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(156, 87, 73, 0.1)' }]}>
                <Ionicons name="help-circle-outline" size={18} color="#9C5749" />
              </View>
              <Text style={styles.listTitle}>Help & FAQ</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={handleContactSupport}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(156, 87, 73, 0.1)' }]}>
                <Ionicons name="mail-outline" size={18} color="#9C5749" />
              </View>
              <Text style={styles.listTitle}>Contact Support</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={handleTermsPrivacy}>
            <View style={styles.listRow}>
              <View style={[styles.listIcon, { backgroundColor: 'rgba(156, 87, 73, 0.1)' }]}>
                <Ionicons name="document-text-outline" size={18} color="#9C5749" />
              </View>
              <Text style={styles.listTitle}>Terms & Privacy</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
        </View>

        <Button
          title="Sign Out"
          type="clear"
          titleStyle={styles.signOutText}
          onPress={handleSignOut}
          containerStyle={styles.signOutButton}
        />

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F8F6F5',
  },
  authTitle: {
    marginTop: 24,
    textAlign: 'center',
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  authSubtitle: {
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
    color: '#9C5749',
    lineHeight: 22,
    fontFamily: 'NotoSans_500Medium',
  },
  authButton: {
    backgroundColor: '#F2330D',
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 14,
    marginBottom: 12,
  },
  authButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  authButtonOutline: {
    borderColor: '#F2330D',
    borderRadius: 16,
    paddingHorizontal: 48,
    paddingVertical: 14,
  },
  authButtonOutlineText: {
    color: '#F2330D',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#F8F6F5',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1C100D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F8F6F5',
  },
  name: {
    marginTop: 16,
    fontSize: 24,
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  username: {
    color: '#F2330D',
    fontSize: 15,
    fontFamily: 'NotoSans_600SemiBold',
    marginTop: 2,
  },
  setUsername: {
    color: '#3B82F6',
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2CC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  premiumText: {
    color: '#F59E0B',
    fontFamily: 'NotoSans_600SemiBold',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 20,
    paddingVertical: 20,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E8D3CE',
    alignSelf: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#1C100D',
  },
  section: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  listItem: {
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F5F0EE',
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    flex: 1,
    marginLeft: 12,
    color: '#1C100D',
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
  },
  listValue: {
    color: '#9C5749',
    fontSize: 13,
    fontFamily: 'NotoSans_400Regular',
    marginRight: 8,
  },
  upgradeText: {
    color: '#F2330D',
    fontFamily: 'NotoSans_600SemiBold',
  },
  signOutButton: {
    marginTop: 32,
    marginBottom: 16,
  },
  signOutText: {
    color: '#EF4444',
    fontFamily: 'NotoSans_600SemiBold',
  },
  version: {
    textAlign: 'center',
    color: '#C8B7B2',
    marginBottom: 16,
    fontFamily: 'NotoSans_500Medium',
  },
});
