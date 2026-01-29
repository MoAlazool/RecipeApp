import { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { useRecipeStore } from '@/stores/recipeStore';
import { useShoppingStore } from '@/stores/shoppingStore';
import { useAuthStore } from '@/stores/authStore';
import { ServingAdjuster } from '@/components/recipe/ServingAdjuster';
import { IngredientList } from '@/components/recipe/IngredientList';
import { StepList } from '@/components/recipe/StepList';
import type { Recipe } from '@/utils/types';

const FALLBACK_IMAGE = 'https://via.placeholder.com/800x600';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getRecipe, updateRecipe, deleteRecipe, toggleFavorite, saveRecipeToMyList } = useRecipeStore();
  const { addItemsFromRecipe } = useShoppingStore();
  const { user } = useAuthStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check if the current user owns this recipe
  const isOwner = recipe?.user_id === user?.id;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(scrollY.value, [200, 300], [0, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateY: interpolate(scrollY.value, [200, 300], [-20, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const heroImageStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(scrollY.value, [-300, 0], [1.5, 1], Extrapolation.CLAMP),
        },
        {
          translateY: interpolate(scrollY.value, [-300, 0, 300], [-50, 0, 50], Extrapolation.CLAMP),
        },
      ],
    };
  });

  useEffect(() => {
    loadRecipe();
  }, [id]);

  const loadRecipe = async () => {
    if (!id) return;
    const loadedRecipe = await getRecipe(id);
    setRecipe(loadedRecipe);
    setIsLoading(false);
  };

  const handleServingChange = async (newServings: number) => {
    if (!recipe) return;
    await updateRecipe(recipe.id, { current_servings: newServings });
    setRecipe({ ...recipe, current_servings: newServings });
  };

  const handleAddToShoppingList = () => {
    if (!recipe) return;
    addItemsFromRecipe(recipe.id, recipe.title, recipe.ingredients);
    Alert.alert('Added!', `${recipe.ingredients?.length || 0} ingredients added to shopping list`);
  };

  const handleDelete = () => {
    if (!recipe) return;

    Alert.alert(
      'Delete Recipe',
      `Are you sure you want to delete "${recipe.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[UI] Deleting recipe:', recipe.id);
              await deleteRecipe(recipe.id);
              console.log('[UI] Delete successful, navigating...');
              router.replace('/(tabs)');
            } catch (error: any) {
              console.error('[UI] Delete error:', error);
              console.error('[UI] Error message:', error?.message);
              console.error('[UI] Error code:', error?.code);
              Alert.alert(
                'Delete Failed',
                error?.message || 'Failed to delete recipe. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleFavorite = async () => {
    if (!recipe) return;
    await toggleFavorite(recipe.id);
    setRecipe({ ...recipe, is_favorite: !recipe.is_favorite });
  };

  const handleSaveToMyList = async () => {
    if (!recipe || isSaving) return;

    setIsSaving(true);
    try {
      const savedRecipe = await saveRecipeToMyList(recipe);
      Alert.alert(
        'Recipe Saved!',
        `"${recipe.title}" has been added to your recipes.`,
        [
          {
            text: 'View My Recipe',
            onPress: () => router.replace(`/recipe/${savedRecipe.id}` as any),
          },
          { text: 'Stay Here', style: 'cancel' },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!recipe) return;

    Alert.alert(
      'Share Recipe',
      'How would you like to share this recipe?',
      [
        {
          text: 'Send to Friend',
          onPress: () => handleShareToFriend(),
        },
        {
          text: 'Share Link',
          onPress: async () => {
            try {
              const message = recipe.source_url
                ? `Check out this recipe: ${recipe.title}\n${recipe.source_url}`
                : `Check out this recipe: ${recipe.title}`;
              await Share.share({
                message,
                title: recipe.title,
              });
            } catch (error) {
              // User cancelled or error
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleShareToFriend = () => {
    if (!recipe) return;
    router.push({
      pathname: '/share-recipe' as any,
      params: {
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        recipeThumbnail: recipe.thumbnail_url || '',
        recipeTime: recipe.total_time_minutes?.toString() || '',
        recipeDifficulty: recipe.difficulty || '',
      },
    });
  };


  const handleWatchVideo = async () => {
    if (!recipe?.source_url) {
      Alert.alert('No Video', 'This recipe does not have a linked video.');
      return;
    }

    try {
      // Try to open in YouTube app first
      const youtubeAppUrl = recipe.source_url.replace('https://www.youtube.com', 'youtube://');
      const canOpenYouTube = await Linking.canOpenURL(youtubeAppUrl);

      if (canOpenYouTube) {
        await Linking.openURL(youtubeAppUrl);
      } else {
        // Fallback to browser
        await Linking.openURL(recipe.source_url);
      }
    } catch (error) {
      // Final fallback
      await Linking.openURL(recipe.source_url);
    }
  };

  if (isLoading || !recipe) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingSpinner}>
          <Ionicons name="restaurant" size={48} color="#F2330D" />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </View>
    );
  }

  const scaleFactor = recipe.current_servings / recipe.original_servings;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, headerStyle, { height: insets.top + 44 }]}>
        <View style={styles.stickyHeaderContent}>
          <Text style={styles.stickyHeaderTitle} numberOfLines={1}>{recipe.title}</Text>
        </View>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero} pointerEvents="box-none">
          <Animated.Image
            source={{ uri: recipe.thumbnail_url || FALLBACK_IMAGE }}
            style={[styles.heroImage, heroImageStyle]}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Top Gradient for Navigation */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={styles.heroGradientTop}
            pointerEvents="none"
          />

          {/* Bottom Gradient for Text Readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', styles.container.backgroundColor]} 
            style={styles.heroGradientBottom}
            pointerEvents="none"
          />

          {/* Glass Effect Buttons */}
          <View style={[styles.glassButtonsContainer, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            {/* Back Button (Pill Style) */}
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              style={styles.backButtonPill}
            >
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="chevron-back" size={22} color="#FFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            {/* Right Actions (Circular Style) */}
            <View style={styles.glassButtonsRight} pointerEvents="box-none">
              <TouchableOpacity
                onPress={handleShare}
                activeOpacity={0.8}
                style={styles.glassButtonCircular}
              >
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <Ionicons name="share-outline" size={20} color="#FFF" />
              </TouchableOpacity>

              {isOwner ? (
                <TouchableOpacity
                  onPress={handleDelete}
                  activeOpacity={0.8}
                  style={styles.glassButtonCircular}
                >
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleSaveToMyList}
                  activeOpacity={0.8}
                  style={styles.glassButtonCircular}
                  disabled={isSaving}
                >
                  <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                  <Ionicons
                    name={isSaving ? "hourglass-outline" : "bookmark-outline"}
                    size={20}
                    color="#22C55E"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Info Content */}
          <View style={styles.heroContent} pointerEvents="box-none">
            <Text style={styles.heroTitle} numberOfLines={2} ellipsizeMode="tail">
              {recipe.title}
            </Text>
            {recipe.description && (
              <Text style={styles.heroDescription} numberOfLines={2} ellipsizeMode="tail">
                {recipe.description}
              </Text>
            )}

            {/* Simple Metadata Row */}
            <View style={styles.heroMetaRow} pointerEvents="none">
              <View style={styles.heroMetaItem}>
                <Ionicons name="time-outline" size={18} color="rgba(255,255,255,0.95)" />
                <Text style={styles.heroMetaText}>{recipe.total_time_minutes || 0} min</Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Ionicons name="people-outline" size={18} color="rgba(255,255,255,0.95)" />
                <Text style={styles.heroMetaText}>{recipe.current_servings} servings</Text>
              </View>
              {recipe.calories ? (
                <View style={styles.heroMetaItem}>
                  <Ionicons name="flame-outline" size={18} color="rgba(255,255,255,0.95)" />
                  <Text style={styles.heroMetaText}>{recipe.calories} cal</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* {recipe.source_url && (
          <TouchableOpacity
            style={styles.videoCard}
            onPress={handleWatchVideo}
            activeOpacity={0.8}
          >
            <View style={styles.videoPlayIcon}>
              <Ionicons name="play" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.videoCardContent}>
              <Text style={styles.videoCardLabel}>AI EXTRACT</Text>
              <Text style={styles.videoCardTitle}>Watch cooking video</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
          </TouchableOpacity>
        )} */}


        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recipe Details</Text>
            <Animated.View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>
                {activeTab === 'ingredients'
                  ? `${recipe.ingredients.length} items`
                  : `${recipe.steps.length} steps`}
              </Text>
            </Animated.View>
          </View>

          <View style={styles.segmentedContainer}>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  activeTab === 'ingredients' && styles.segmentActive,
                ]}
                onPress={() => setActiveTab('ingredients')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  activeTab === 'ingredients' && styles.segmentTextActive,
                ]}>
                  Ingredients
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  activeTab === 'steps' && styles.segmentActive,
                ]}
                onPress={() => setActiveTab('steps')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  activeTab === 'steps' && styles.segmentTextActive,
                ]}>
                  Steps
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === 'ingredients' && (
            <ServingAdjuster
              servings={recipe.current_servings}
              originalServings={recipe.original_servings}
              onChange={handleServingChange}
            />
          )}

          <View style={styles.tabContent}>
            {activeTab === 'ingredients' ? (
              <IngredientList
                ingredients={recipe.ingredients}
                scaleFactor={scaleFactor}
              />
            ) : (
              <StepList steps={recipe.steps} />
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {/* Floating Footer */}
      <View style={styles.footerContainer}>
        {!isOwner ? (
          // Show Save button for shared recipes
          <>
            <TouchableOpacity
              style={styles.saveToMyListButton}
              onPress={handleSaveToMyList}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <View style={styles.saveToMyListIcon}>
                <Ionicons
                  name={isSaving ? "hourglass-outline" : "bookmark"}
                  size={20}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.saveToMyListText}>
                {isSaving ? 'Saving...' : 'Save to My Recipes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.startCookingButtonSmall}
              onPress={() => router.push(`/cooking/${recipe.id}`)}
              activeOpacity={0.9}
            >
              <Ionicons name="restaurant" size={22} color="#F2330D" />
            </TouchableOpacity>
          </>
        ) : (
          // Show normal footer for owned recipes
          <>
            <TouchableOpacity
              style={styles.startCookingButton}
              onPress={() => router.push(`/cooking/${recipe.id}`)}
              activeOpacity={0.9}
            >
              <View style={styles.startCookingIcon}>
                <Ionicons name="restaurant" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.startCookingText}>Start Cooking</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addToListButton}
              onPress={handleAddToShoppingList}
              activeOpacity={0.9}
            >
              <Ionicons name="cart-outline" size={22} color="#F2330D" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  scrollContent: {
    paddingBottom: 120, // Enough space for floating footer
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
    backgroundColor: '#F8F6F5',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  stickyHeaderContent: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 50,
  },
  stickyHeaderTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1C100D',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 101, // Above sticky header
    borderRadius: 20,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F6F5',
  },
  loadingSpinner: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: 'NotoSans_500Medium',
    fontSize: 16,
    color: '#9C5749',
  },
  hero: {
    height: 400,
    position: 'relative',
    backgroundColor: '#1C100D',
  // REMOVE rounded corners
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    height: 400,
    width: '100%',
  },
  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroGradientBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 250, // Adjusted height
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 24,
    zIndex: 20,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroDescription: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: 'NotoSans_500Medium',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 24,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 14,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -32, // Negative margin to overlap hero
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  videoPlayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B5B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  videoCardContent: {
    flex: 1,
  },
  videoCardLabel: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 11,
    color: '#F2330D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  videoCardTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1C100D',
  },
  section: {
    marginTop: 24, // أو -12 حسب الذوق
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1C100D',
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontFamily: 'NotoSans_700Bold',
    fontSize: 12,
    color: '#F2330D',
  },
  segmentedContainer: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: '#F2330D',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    color: '#9C5749',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
  tabContent: {
    paddingBottom: 20,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 6,
    borderRadius: 32,
    backgroundColor: 'rgba(248, 246, 245, 0.9)',
  },
  startCookingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F2330D',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  startCookingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCookingText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addToListButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1EF',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  saveToMyListButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  saveToMyListIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveToMyListText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  startCookingButtonSmall: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1EF',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  glassButtonsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  glassButtonsRight: {
    flexDirection: 'row',
    gap: 12,
  },
  glassButtonCircular: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backButtonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  backButtonText: {
    color: '#FFF',
    fontFamily: 'NotoSans_600SemiBold',
    fontSize: 15,
    marginLeft: 4,
  },
});
