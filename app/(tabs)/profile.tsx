import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Image, RefreshControl, Linking } from 'react-native';
import { Text, Switch } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { registerForPushNotifications } from '@/services/notifications.service';
import { userService } from '@/services/user.service';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
import type { UserProfile } from '@/utils/types';

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

  const {
    notificationsEnabled,
    privateAccount,
    setNotificationsEnabled,
    setPrivateAccount,
  } = usePreferencesStore();

  const isPremium = user?.is_premium ?? false;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        onPress: () => signOut()
      },
    ]);
  };

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);



  const handleToggleNotifications = async (enabled: boolean) => {
    tap();
    if (enabled) {
      const token = await registerForPushNotifications();
      if (!token) {
        Alert.alert('Notifications Disabled', 'Please enable notifications in your device settings.', [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }
    }
    setNotificationsEnabled(enabled);
  };

  const handleTogglePrivateAccount = async (enabled: boolean) => {
    tap();
    setPrivateAccount(enabled);
    try {
      await userService.updateUserProfile({ is_public: !enabled });
    } catch (error) {
      console.error('Error updating privacy setting:', error);
      setPrivateAccount(!enabled);
    }
  };

  // ── Row helper ──
  const Row = ({ icon, label, onPress, trailing, accent }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress?: () => void;
    trailing?: React.ReactNode;
    accent?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={19} color={accent ? '#C66E4E' : '#8A8578'} />
      <Text style={[styles.rowLabel, accent && styles.rowLabelAccent]}>{label}</Text>
      {trailing || (onPress && <Ionicons name="chevron-forward" size={16} color="#D5D1CB" />)}
    </TouchableOpacity>
  );

  // ── Not authenticated ──
  if (!isAuthenticated) {
    return (
      <TabScreenTransition style={styles.screen}>
        <View style={[styles.authWrap, { paddingTop: insets.top + 40 }]}>
          <View style={styles.authIconWrap}>
            <Ionicons name="person-outline" size={36} color="#C66E4E" />
          </View>
          <View style={styles.authLine} />
          <Text style={styles.authTitle}>Sign in to sync recipes</Text>
          <Text style={styles.authSubtitle}>
            Save across devices and unlock all features
          </Text>
          <TouchableOpacity
            style={styles.authBtn}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.authBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/auth?mode=signup')}>
            <Text style={styles.authCreateText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </TabScreenTransition>
    );
  }

  return (
    <TabScreenTransition style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: bottomTabBarHeight + 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#C66E4E" />
        }
      >
        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatarRing}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{getInitials(user?.full_name || user?.email)}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{user?.full_name || 'Recipe Lover'}</Text>
                {user?.is_premium && (
                  <View style={styles.proBadge}>
                    <Ionicons name="star" size={10} color="#D4AF37" />
                    <Text style={styles.proText}>Pro</Text>
                  </View>
                )}
              </View>
              {user?.username ? (
                <Text style={styles.username}>@{user.username}</Text>
              ) : (
                <TouchableOpacity onPress={() => router.push('/setup-username' as any)}>
                  <Text style={styles.setUsername}>Set your @username</Text>
                </TouchableOpacity>
              )}
              {profile?.recipes_count != null && (
                <Text style={styles.recipeCount}>{profile.recipes_count} recipes saved</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/edit-profile' as any)}
          >
            <Ionicons name="pencil-outline" size={15} color="#1A1510" />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Subscription ── */}
        <Text style={styles.groupLabel}>Subscription</Text>
        <View style={styles.group}>
          <Row
            icon={isPremium ? 'star' : 'person-outline'}
            label={isPremium ? 'Eito Pro' : 'Free Plan'}
            onPress={() => router.push('/subscription')}
            accent={isPremium}
          />
        </View>

        {/* ── Settings ── */}
        <Text style={styles.groupLabel}>Settings</Text>
        <View style={styles.group}>
          <Row icon="at-outline" label="Username" onPress={() => router.push('/setup-username' as any)}
            trailing={<><Text style={styles.rowValue}>@{user?.username || 'not set'}</Text><Ionicons name="chevron-forward" size={16} color="#D5D1CB" /></>}
          />
          <Row icon="notifications-outline" label="Notifications"
            trailing={<Switch value={notificationsEnabled} onValueChange={handleToggleNotifications} />}
          />
          <Row icon="lock-closed-outline" label="Private Account"
            trailing={<Switch value={privateAccount} onValueChange={handleTogglePrivateAccount} />}
          />
        </View>

        {/* ── Support ── */}
        <Text style={styles.groupLabel}>Support</Text>
        <View style={styles.group}>
          <Row icon="help-circle-outline" label="Help & FAQ" onPress={() => router.push('/help-faq' as any)} />
          <Row icon="mail-outline" label="Contact Us" onPress={() => Linking.openURL('mailto:support@example.com?subject=Support%20Request')} />
          <Row icon="document-text-outline" label="Terms & Privacy" onPress={() => router.push('/terms-privacy' as any)} />
        </View>

        {/* ── Sign Out ── */}
        <View style={styles.group}>
          <Row icon="log-out-outline" label="Sign Out" onPress={handleSignOut} />
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  // ── Auth ──
  authWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  authIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  authLine: {
    width: 32,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
    marginBottom: 20,
  },
  authTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#1A1510',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#B5B0A7',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  authBtn: {
    backgroundColor: '#C66E4E',
    borderRadius: 20,
    paddingHorizontal: 48,
    paddingVertical: 14,
    marginBottom: 16,
  },
  authBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  authCreateText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#C66E4E',
  },

  // ── Profile Card ──
  profileCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginTop: 8,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(26, 21, 16, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1A1510',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  name: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: '#1A1510',
    flexShrink: 1,
  },
  username: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#B5B0A7',
    marginTop: 2,
  },
  setUsername: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#C66E4E',
    marginTop: 2,
  },
  recipeCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#D5D1CB',
    marginTop: 4,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  proText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#D4AF37',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    borderRadius: 14,
    paddingVertical: 11,
  },
  editBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#1A1510',
  },



  // ── Groups ──
  groupLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: '#B5B0A7',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  group: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 21, 16, 0.06)',
  },
  rowLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#1A1510',
  },
  rowLabelAccent: {
    color: '#C66E4E',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  rowValue: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#B5B0A7',
    marginRight: 4,
  },


  version: {
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#D5D1CB',
    marginTop: 24,
    marginBottom: 16,
  },
});
