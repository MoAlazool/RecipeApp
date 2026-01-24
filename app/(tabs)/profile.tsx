import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, ListItem, Avatar, Button, Switch } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { user, signOut, isAuthenticated } = useAuthStore();

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

  if (!isAuthenticated) {
    return (
      <TabScreenTransition style={styles.authContainer}>
        <View style={[styles.authContainer, { paddingTop: insets.top }]}>
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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottomTabBarHeight }}>
        <View style={styles.header}>
          <Avatar
            size={80}
            rounded
            title={user?.full_name?.[0] || user?.email?.[0] || '?'}
            containerStyle={{ backgroundColor: '#F2330D' }}
          />
          <Text h4 style={styles.name}>{user?.full_name || 'Recipe Lover'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.premiumText}>Pro Member</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <ListItem containerStyle={styles.listItem} onPress={() => {}}>
            <View style={styles.listRow}>
              <Ionicons name="person-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Edit Profile</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={() => {}}>
            <View style={styles.listRow}>
              <Ionicons name="restaurant-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Dietary Preferences</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={() => router.push('/paywall')}>
            <View style={styles.listRow}>
              <Ionicons name="diamond-outline" size={22} color="#F2330D" />
              <Text style={[styles.listTitle, styles.upgradeText]}>
                {user?.is_premium ? 'Manage Subscription' : 'Upgrade to Pro'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <Ionicons name="moon-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Dark Mode</Text>
              <Switch value={false} onValueChange={() => {}} />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <Ionicons name="notifications-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Notifications</Text>
              <Switch value={true} onValueChange={() => {}} />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem}>
            <View style={styles.listRow}>
              <Ionicons name="volume-high-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Voice Feedback</Text>
              <Switch value={true} onValueChange={() => {}} />
            </View>
          </ListItem>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <ListItem containerStyle={styles.listItem} onPress={() => {}}>
            <View style={styles.listRow}>
              <Ionicons name="help-circle-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Help & FAQ</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={() => {}}>
            <View style={styles.listRow}>
              <Ionicons name="mail-outline" size={22} color="#9C5749" />
              <Text style={styles.listTitle}>Contact Support</Text>
              <Ionicons name="chevron-forward" size={18} color="#C8B7B2" />
            </View>
          </ListItem>
          <ListItem containerStyle={styles.listItem} onPress={() => {}}>
            <View style={styles.listRow}>
              <Ionicons name="document-text-outline" size={22} color="#9C5749" />
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
    paddingVertical: 32,
    backgroundColor: '#F8F6F5',
  },
  name: {
    marginTop: 16,
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  email: {
    color: '#9C5749',
    marginTop: 4,
    fontFamily: 'NotoSans_500Medium',
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
  section: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  listItem: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6E2',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listTitle: {
    flex: 1,
    marginLeft: 12,
    color: '#1C100D',
    fontFamily: 'NotoSans_600SemiBold',
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
    color: '#F44336',
    fontFamily: 'NotoSans_600SemiBold',
  },
  version: {
    textAlign: 'center',
    color: '#C8B7B2',
    marginBottom: 32,
    fontFamily: 'NotoSans_500Medium',
  },
});
