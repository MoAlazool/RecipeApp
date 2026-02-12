import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@rneui/themed';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { useRecipeStore } from '@/stores/recipeStore';
import { useAuthStore } from '@/stores/authStore';
import { useCookbookStore } from '@/stores/cookbookStore';
import { useUsageStore } from '@/stores/usageStore';
import { FREE_PLAN_LIMITS } from '@/utils/types';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';

const { width: SCREEN_W } = Dimensions.get('window');
const RECENT_CARD_W = SCREEN_W * 0.68;
const RECENT_CARD_H = RECENT_CARD_W * 1.15;

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  charcoal: '#1A1510',
  muted: '#8A8578',
  terracotta: '#B8845C',
  gold: '#D4AF37',
  hairline: 'rgba(26, 21, 16, 0.06)',
};

export default function RecipesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { recipes, isLoading, fetchRecipes } = useRecipeStore();
  const { user } = useAuthStore();
  const { fetchCookbooks } = useCookbookStore();
  const isPremium = user?.is_premium ?? false;
  const recipesUsed = useUsageStore((s) => s.recipesUsed);
  const scansUsed = useUsageStore((s) => s.scansUsed);
  const chatsUsed = useUsageStore((s) => s.chatsUsed);
  const recipesLeft = Math.max(0, FREE_PLAN_LIMITS.recipes_per_week - recipesUsed);
  const scansLeft = Math.max(0, FREE_PLAN_LIMITS.scans_per_week - scansUsed);
  const chatsLeft = Math.max(0, FREE_PLAN_LIMITS.ai_chats_per_week - chatsUsed);
  const daysUntilReset = useUsageStore((s) => s.getDaysUntilReset());
  const [search, setSearch] = useState('');
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allRecipesOffset, setAllRecipesOffset] = useState<number | null>(null);
  const listRef = useRef<FlatList<any>>(null);

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(search.toLowerCase())
  );

  const recentRecipes = useMemo(() => filteredRecipes.slice(0, 5), [filteredRecipes]);

  // Fetch cookbooks on mount
  useState(() => { fetchCookbooks(); });

  // Sync usage on focus; close usage card on blur
  useFocusEffect(
    useCallback(() => {
      useUsageStore.getState().syncFromFirebase();
      return () => setUsageExpanded(false);
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRecipes(), fetchCookbooks(), useUsageStore.getState().syncFromFirebase()]);
    setRefreshing(false);
  }, []);

  const scrollToAllRecipes = () => {
    if (listRef.current && allRecipesOffset !== null) {
      listRef.current.scrollToOffset({ offset: allRecipesOffset, animated: true });
    }
  };

  const handlePasteLink = useCallback(async () => {
    try {
      const clipboardText = (await Clipboard.getStringAsync()).trim();
      if (!clipboardText) {
        Alert.alert('Clipboard Empty', 'Copy a video link first and try again.');
        return;
      }

      router.push({
        pathname: '/add-recipe',
        params: {
          url: clipboardText,
          autoExtract: '1',
        },
      });
    } catch {
      Alert.alert('Paste Failed', 'Could not access your clipboard.');
    }
  }, [router]);

  const renderRecipe = ({ item }: { item: any }) => (
    <RecipeCard
      recipe={item}
      onPress={() => router.push(`/recipe/${item.id}`)}
      onCook={() => router.push(`/cooking/${item.id}`)}
    />
  );

  const hasRecipes = recipes.length > 0;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.userBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name?.[0] || user?.email?.[0] || 'R').toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.greeting}>{hasRecipes ? 'WELCOME BACK,' : 'WELCOME,'}</Text>
            <Text style={styles.name}>{user?.full_name || 'Chef'}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.usagePill}
          onPress={() => setUsageExpanded((v) => !v)}
          activeOpacity={0.8}
        >
          {isPremium ? (
            <Ionicons name="infinite" size={18} color="#FFFFFF" />
          ) : (
            <Text style={styles.usagePillText}>
              {recipesLeft}/{FREE_PLAN_LIMITS.recipes_per_week}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Expandable glass usage card */}
      {usageExpanded && (
        <>
          <View style={styles.usageGlassWrap}>
            <BlurView intensity={60} tint="light" style={styles.usageGlass}>
              <View style={styles.usageGlassInner}>
                {([
                  { icon: 'restaurant-outline' as const, label: 'Recipes', remaining: recipesLeft, total: FREE_PLAN_LIMITS.recipes_per_week, color: '#C66E4E' },
                  { icon: 'scan-outline' as const, label: 'Scans', remaining: scansLeft, total: FREE_PLAN_LIMITS.scans_per_week, color: '#D4AF37' },
                  { icon: 'chatbubbles-outline' as const, label: 'AI Chat', remaining: chatsLeft, total: FREE_PLAN_LIMITS.ai_chats_per_week, color: '#6B8E23' },
                ] as const).map((item, index, arr) => {
                  const progress = isPremium ? 1 : Math.min(item.remaining / item.total, 1);
                  return (
                    <View key={item.label} style={[styles.usageRow, index < arr.length - 1 && styles.usageRowBorder]}>
                      <View style={[styles.usageIconDot, { backgroundColor: `${item.color}18` }]}>
                        <Ionicons name={item.icon} size={14} color={item.color} />
                      </View>
                      <Text style={styles.usageRowLabel}>{item.label}</Text>
                      <View style={styles.usageBarBg}>
                        <View style={[styles.usageBarFill, { width: `${progress * 100}%` as any, backgroundColor: item.color }]} />
                      </View>
                      {isPremium ? (
                        <Ionicons name="infinite" size={16} color={item.color} />
                      ) : (
                        <Text style={styles.usageRowCount}>{item.remaining}/{item.total}</Text>
                      )}
                    </View>
                  );
                })}
                {!isPremium && (
                  <View style={styles.usageFooter}>
                    <Ionicons name="time-outline" size={12} color={C.muted} />
                    <Text style={styles.usageFooterText}>
                      {daysUntilReset === 0 ? 'Resets today' : `Resets in ${daysUntilReset}d`}
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/paywall')} style={styles.usageUpgradeLink}>
                      <Text style={styles.usageUpgradeLinkText}>Upgrade</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </BlurView>
          </View>
        </>
      )}

      {/* Search bar — only when there are recipes to search */}
      {hasRecipes && (
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color={C.muted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search your recipes..."
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
      )}

      {/* Quick actions — only when user has recipes (avoids duplication with Get Started) */}
      {hasRecipes && (
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={handlePasteLink} activeOpacity={0.8}>
            <View style={[styles.quickIcon, { backgroundColor: 'rgba(198, 110, 78, 0.10)' }]}>
              <Ionicons name="link" size={17} color={C.terracotta} />
            </View>
            <Text style={styles.quickLabel}>Paste Link</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/fridge-scan')} activeOpacity={0.8}>
            <View style={[styles.quickIcon, { backgroundColor: 'rgba(212, 175, 55, 0.10)' }]}>
              <MaterialCommunityIcons name="crop-free" size={17} color={C.gold} />
            </View>
            <Text style={styles.quickLabel}>Scan Fridge</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/cookbook-scan')} activeOpacity={0.8}>
            <View style={[styles.quickIcon, { backgroundColor: 'rgba(26, 21, 16, 0.06)' }]}>
              <Ionicons name="reader-outline" size={17} color={C.charcoal} />
            </View>
            <Text style={styles.quickLabel}>Scan Book</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasRecipes ? (
        <>
          {/* Recent section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={scrollToAllRecipes}>
              <Text style={styles.sectionLink}>See all</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={recentRecipes}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
            snapToInterval={RECENT_CARD_W + 12}
            decelerationRate="fast"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.recentCard}
                onPress={() => router.push(`/recipe/${item.id}`)}
                activeOpacity={0.95}
              >
                <Image
                  source={{ uri: item.thumbnail_url }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  transition={300}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  style={styles.recentGradient}
                />
                <View style={styles.recentContent}>
                  {item.cuisine_type ? (
                    <Text style={styles.recentCuisine}>{item.cuisine_type.toUpperCase()}</Text>
                  ) : null}
                  <Text style={styles.recentTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.recentMeta}>
                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.recentMetaText}>
                      {item.total_time_minutes || 15} min
                    </Text>
                    {item.difficulty ? (
                      <>
                        <Text style={styles.recentMetaDot}>&middot;</Text>
                        <Text style={styles.recentMetaText}>{item.difficulty}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* All recipes */}
          <View
            style={styles.sectionHeader}
            onLayout={(event) => setAllRecipesOffset(event.nativeEvent.layout.y)}
          >
            <Text style={styles.sectionTitle}>All Recipes</Text>
            <TouchableOpacity onPress={() => router.push('/cookbooks' as any)}>
              <Text style={styles.sectionLink}>See All</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        /* ── New user: Get Started section ── */
        <View style={styles.getStartedSection}>
          <Text style={styles.getStartedTitle}>Start your collection</Text>
          <Text style={styles.getStartedSubtitle}>
            Add your first recipe to get cooking
          </Text>

          <View style={styles.getStartedCards}>
            <TouchableOpacity
              style={styles.getStartedCard}
              onPress={handlePasteLink}
              activeOpacity={0.85}
            >
              <View style={[styles.getStartedCardIcon, { backgroundColor: 'rgba(198, 110, 78, 0.10)' }]}>
                <Ionicons name="link" size={22} color={C.terracotta} />
              </View>
              <Text style={styles.getStartedCardTitle}>Paste a link</Text>
              <Text style={styles.getStartedCardDesc}>
                Copy a recipe URL from TikTok, Instagram, or any website
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.getStartedCard}
              onPress={() => router.push('/fridge-scan')}
              activeOpacity={0.85}
            >
              <View style={[styles.getStartedCardIcon, { backgroundColor: 'rgba(212, 175, 55, 0.10)' }]}>
                <MaterialCommunityIcons name="crop-free" size={22} color={C.gold} />
              </View>
              <Text style={styles.getStartedCardTitle}>Scan your fridge</Text>
              <Text style={styles.getStartedCardDesc}>
                Take a photo and get recipe ideas from what you have
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.getStartedCard}
              onPress={() => router.push('/cookbook-scan')}
              activeOpacity={0.85}
            >
              <View style={[styles.getStartedCardIcon, { backgroundColor: 'rgba(26, 21, 16, 0.06)' }]}>
                <Ionicons name="reader-outline" size={22} color={C.charcoal} />
              </View>
              <Text style={styles.getStartedCardTitle}>Scan a cookbook</Text>
              <Text style={styles.getStartedCardDesc}>
                Point your camera at a recipe page to save it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <TabScreenTransition style={styles.container}>
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
          !isLoading && hasRecipes ? (
            <EmptyState
              icon="search-outline"
              title="No matches"
              subtitle="Try a different search term"
            />
          ) : null
        }
      />
      {usageExpanded && (
        <Pressable style={styles.usageDismiss} onPress={() => setUsageExpanded(false)} />
      )}
    </TabScreenTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 6,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
  },
  greeting: {
    color: C.muted,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  name: {
    color: C.charcoal,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    marginTop: 1,
  },
  usagePill: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usagePillText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Usage glass card ──
  usageDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  usageGlassWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  usageGlass: {
    overflow: 'hidden',
  },
  usageGlassInner: {
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  usageRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 21, 16, 0.08)',
  },
  usageIconDot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageRowLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.charcoal,
    width: 58,
  },
  usageBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(26, 21, 16, 0.07)',
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageRowCount: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.muted,
    minWidth: 28,
    textAlign: 'right',
  },
  usageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: 10,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 21, 16, 0.08)',
  },
  usageFooterText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: C.muted,
    flex: 1,
  },
  usageUpgradeLink: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(198, 110, 78, 0.12)',
  },
  usageUpgradeLinkText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.terracotta,
  },

  // ── Search ──
  searchWrapper: {
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  searchIcon: {
    marginRight: 7,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.charcoal,
  },

  // ── Quick actions ──
  quickGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.charcoal,
  },

  // ── Section headers ──
  sectionHeader: {
    marginTop: 22,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
  },
  sectionLink: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.terracotta,
  },
  sectionCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
  },

  // ── Recent recipe cards ──
  recentList: {
    paddingTop: 10,
    paddingBottom: 2,
    gap: 12,
  },
  recentCard: {
    width: RECENT_CARD_W,
    height: RECENT_CARD_H,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E8E2D8',
  },
  recentGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: RECENT_CARD_H * 0.55,
  },
  recentContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  recentCuisine: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  recentTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 23,
    marginBottom: 6,
  },
  recentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentMetaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  recentMetaDot: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },

  // ── Get Started (new user) ──
  getStartedSection: {
    marginTop: 28,
  },
  getStartedTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: C.charcoal,
    marginBottom: 6,
  },
  getStartedSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
    marginBottom: 18,
  },
  getStartedCards: {
    gap: 10,
  },
  getStartedCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'column',
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  getStartedCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  getStartedCardTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: C.charcoal,
    marginBottom: 4,
  },
  getStartedCardDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
  },

  // ── List / empty ──
  list: {},
  ctaButton: {
    backgroundColor: C.charcoal,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
});
