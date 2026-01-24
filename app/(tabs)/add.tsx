import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';

export default function AddScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: bottomTabBarHeight }]}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Create</Text>
        <Text style={styles.title}>Add a Recipe</Text>
        <Text style={styles.subtitle}>
          Choose how you want to add your next recipe.
        </Text>
      </View>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/add-recipe?platform=youtube')}>
        <View style={styles.cardIcon}>
          <Ionicons name="logo-youtube" size={28} color="#F2330D" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>From YouTube</Text>
          <Text style={styles.cardDescription}>
            Paste a cooking video URL and we'll extract the recipe automatically.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#1C100D" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/add-recipe?platform=tiktok')}>
        <View style={[styles.cardIcon, styles.cardIconTikTok]}>
          <Ionicons name="logo-tiktok" size={28} color="#000000" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>From TikTok</Text>
          <Text style={styles.cardDescription}>
            Extract recipes from TikTok cooking videos.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#1C100D" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/add-recipe?platform=instagram')}>
        <View style={[styles.cardIcon, styles.cardIconInstagram]}>
          <Ionicons name="logo-instagram" size={28} color="#E4405F" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>From Instagram</Text>
          <Text style={styles.cardDescription}>
            Extract recipes from posts, Reels, and IGTV.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#1C100D" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/add-recipe?mode=manual')}>
        <View style={[styles.cardIcon, styles.cardIconAmber]}>
          <Ionicons name="create" size={28} color="#1C100D" />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>Manual Entry</Text>
          <Text style={styles.cardDescription}>
            Enter ingredients and steps manually for full control.
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#1C100D" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  content: {
    padding: 20,
    // paddingBottom is set dynamically via useBottomTabBarHeight()
  },
  header: {
    marginBottom: 20,
  },
  kicker: {
    color: '#9C5749',
    fontFamily: 'NotoSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 28,
    marginTop: 6,
  },
  subtitle: {
    color: '#9C5749',
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'NotoSans_500Medium',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    marginBottom: 14,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 51, 13, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconTikTok: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  cardIconInstagram: {
    backgroundColor: 'rgba(228, 64, 95, 0.12)',
  },
  cardIconAmber: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
  },
  cardDescription: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
