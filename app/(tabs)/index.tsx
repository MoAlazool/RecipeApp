import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ImageBackground,
} from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';

export default function RecipesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { recipes, isLoading, fetchRecipes } = useRecipeStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [allRecipesOffset, setAllRecipesOffset] = useState<number | null>(null);
  const listRef = useRef<FlatList<any>>(null);

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(search.toLowerCase())
  );

  const recentRecipes = useMemo(() => filteredRecipes.slice(0, 5), [filteredRecipes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  }, []);

  const scrollToAllRecipes = () => {
    if (listRef.current && allRecipesOffset !== null) {
      listRef.current.scrollToOffset({ offset: allRecipesOffset, animated: true });
    }
  };

  const renderRecipe = ({ item }: { item: any }) => (
    <RecipeCard
      recipe={item}
      onPress={() => router.push(`/recipe/${item.id}`)}
      onCook={() => router.push(`/cooking/${item.id}`)}
    />
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topBar}>
        <View style={styles.userBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name?.[0] || user?.email?.[0] || 'R').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{user?.full_name || 'Chef'}</Text>
          </View>
        </View>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.topBarAddButton}
            onPress={() => router.push('/add-recipe')}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={20} color="#F2330D" style={styles.searchIcon} />
        <TextInput
          placeholder="Search recipes or paste link..."
          placeholderTextColor="#9C5749"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        <TouchableOpacity
          style={styles.searchMic}
          onPress={() => router.push('/add-recipe')}
        >
          <Ionicons name="link-outline" size={18} color="#9C5749" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.heroCard}
        onPress={() => router.push('/add-recipe')}
        activeOpacity={0.95}
      >
        <View style={styles.heroAccent} />
        <View style={styles.heroContent}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconRow}>
              <View style={[styles.heroIcon, styles.heroIconSmall]}>
                <Ionicons name="logo-youtube" size={18} color="#FF0000" />
              </View>
              <View style={[styles.heroIcon, styles.heroIconSmall]}>
                <Ionicons name="logo-tiktok" size={18} color="#000000" />
              </View>
              <View style={[styles.heroIcon, styles.heroIconSmall]}>
                <Ionicons name="logo-instagram" size={18} color="#E4405F" />
              </View>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>New</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>Turn Any Video into a Recipe</Text>
          <Text style={styles.heroSubtitle}>
            Paste a link from YouTube, TikTok, or Instagram to extract ingredients and steps with AI.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.heroPrimary}
              onPress={() => router.push('/add-recipe')}
            >
              <Ionicons name="link" size={16} color="#FFFFFF" />
              <Text style={styles.heroPrimaryText}>Paste Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroSecondary}>
              <Ionicons name="clipboard-outline" size={18} color="#1C100D" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.quickGrid}>
        <TouchableOpacity
          style={styles.quickCard}
          onPress={() => router.push('/fridge-scan')}
        >
          <View style={styles.quickIconSecondary}>
            <Ionicons name="camera" size={22} color="#556B2F" />
          </View>
          <Text style={styles.quickTitle}>Scan Fridge</Text>
          <Text style={styles.quickSubtitle}>Cook with what you have</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={scrollToAllRecipes}>
          <View style={styles.quickIconAccent}>
            <Ionicons name="bookmark" size={22} color="#F59E0B" />
          </View>
          <Text style={styles.quickTitle}>Browse Saved</Text>
          <Text style={styles.quickSubtitle}>Your personal cookbook</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recently Saved</Text>
        <TouchableOpacity onPress={scrollToAllRecipes}>
          <Text style={styles.sectionLink}>View All</Text>
        </TouchableOpacity>
      </View>

      {recentRecipes.length > 0 ? (
        <FlatList
          data={recentRecipes}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.recentCard}
              onPress={() => router.push(`/recipe/${item.id}`)}
              activeOpacity={0.95}
            >
              <ImageBackground
                source={{ uri: item.thumbnail_url || 'https://via.placeholder.com/300x200' }}
                style={styles.recentImage}
                imageStyle={styles.recentImageRadius}
              >
                <View style={styles.recentOverlay} />
                <TouchableOpacity style={styles.favoriteButton}>
                  <Ionicons
                    name={item.is_favorite ? "heart" : "heart-outline"}
                    size={20}
                    color={item.is_favorite ? "#F2330D" : "#9CA3AF"}
                  />
                </TouchableOpacity>
                <View style={styles.recentMeta}>
                  <Ionicons name="time-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.recentMetaText}>
                    {item.total_time_minutes || 15} min
                  </Text>
                </View>
              </ImageBackground>
              <View style={styles.recentBody}>
                <View style={styles.recentTags}>
                  {item.difficulty ? (
                    <View style={styles.tagChip}>
                      <Text style={styles.tagChipText}>{item.difficulty}</Text>
                    </View>
                  ) : null}
                  {item.cuisine_type ? (
                    <View style={styles.tagChipMuted}>
                      <Text style={styles.tagChipTextMuted}>{item.cuisine_type}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.recentTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={styles.recentDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.recentEmpty}>
          <Text style={styles.recentEmptyText}>No recent recipes yet.</Text>
        </View>
      )}

      <View
        style={styles.sectionHeader}
        onLayout={(event) => setAllRecipesOffset(event.nativeEvent.layout.y)}
      >
        <Text style={styles.sectionTitle}>All Recipes</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={filteredRecipes}
        renderItem={renderRecipe}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.list, { paddingBottom: bottomTabBarHeight }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="book-outline"
              title="No recipes yet"
              subtitle="Add your first recipe from a video URL"
              action={
                <Button
                  title="Add Recipe"
                  onPress={() => router.push('/add-recipe')}
                  buttonStyle={styles.addButton}
                  titleStyle={styles.addButtonText}
                />
              }
            />
          ) : null
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  greeting: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 12,
  },
  name: {
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBarAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 52,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 15,
    color: '#1C100D',
  },
  searchMic: {
    padding: 6,
    borderRadius: 12,
  },
  heroCard: {
    marginTop: 16,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE6E2',
    overflow: 'hidden',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  heroAccent: {
    position: 'absolute',
    top: -30,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
  },
  heroContent: {
    padding: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroIconRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(242, 51, 13, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
  },
  heroBadge: {
    backgroundColor: 'rgba(85, 107, 47, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: '#556B2F',
    fontFamily: 'NotoSans_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 20,
    color: '#1C100D',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  heroButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  heroPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
  },
  heroPrimaryText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
  },
  heroSecondary: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F7F1EE',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 16,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    padding: 16,
  },
  quickIconSecondary: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(85, 107, 47, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickIconAccent: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  quickTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#1C100D',
  },
  quickSubtitle: {
    fontFamily: 'NotoSans_500Medium',
    fontSize: 12,
    color: '#9C5749',
    marginTop: 4,
  },
  sectionHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1C100D',
  },
  sectionLink: {
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 12,
    color: '#F2330D',
  },
  recentList: {
    paddingVertical: 16,
    gap: 14,
  },
  recentTags: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(85, 107, 47, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagChipText: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#556B2F',
  },
  tagChipMuted: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagChipTextMuted: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    color: '#F59E0B',
  },
  recentCard: {
    width: 280,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  recentImage: {
    height: 176,
    justifyContent: 'flex-end',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recentImageRadius: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  recentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  recentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    margin: 10,
    alignSelf: 'flex-start',
  },
  recentMetaText: {
    color: '#FFFFFF',
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 11,
  },
  recentBody: {
    padding: 16,
  },
  recentTitle: {
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  recentDescription: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 12,
    marginTop: 6,
  },
  recentEmpty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    padding: 16,
    marginTop: 12,
  },
  recentEmptyText: {
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
  },
  list: {
    // paddingBottom is set dynamically via useBottomTabBarHeight()
  },
  addButton: {
    backgroundColor: '#F2330D',
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  addButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
