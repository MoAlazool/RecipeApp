import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Animated,
  useColorScheme,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { Text, Slider } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeLoadingAnimation } from '@/components/RecipeLoadingAnimation';
import { aiService } from '@/services/ai.service';
import { useAuthStore } from '@/stores/authStore';
import type { SuggestedRecipe, RecipeDifficulty } from '@/utils/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#F2330D',
  olive: '#606C38',
  oliveDark: '#283618',
  oliveLight: '#DDE5B6',
  backgroundLight: '#FCFAF9',
  backgroundDark: '#1A1210',
  cardLight: '#FFFFFF',
  cardDark: '#2A1D1A',
};

interface Ingredient {
  name: string;
  emoji: string;
  selected: boolean;
}

interface Recipe {
  id: string;
  title: string;
  image: string;
  matchPercentage: number;
  time: string;
  difficulty: string;
  description?: string;
  matchedIngredients?: string;
  missingIngredients?: string;
  featured?: boolean;
}

// Placeholder images for AI-suggested recipes
const RECIPE_PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
];

// Map AI SuggestedRecipe to UI Recipe format
function mapSuggestedRecipeToUI(recipe: SuggestedRecipe, index: number): Recipe {
  const difficultyMap: Record<RecipeDifficulty, string> = {
    beginner: 'Easy',
    intermediate: 'Medium',
    advanced: 'Hard',
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return {
    id: `ai-${index + 1}`,
    title: recipe.title,
    image: RECIPE_PLACEHOLDER_IMAGES[index % RECIPE_PLACEHOLDER_IMAGES.length],
    matchPercentage: recipe.match_score ?? 80,
    time: formatTime(recipe.total_time_minutes),
    difficulty: difficultyMap[recipe.difficulty] || 'Easy',
    description: recipe.description,
    matchedIngredients: recipe.ingredients_you_have?.join(', ') ?? '',
    missingIngredients: recipe.ingredients_you_need && recipe.ingredients_you_need.length > 0
      ? recipe.ingredients_you_need.join(', ')
      : undefined,
    featured: index === 0,
  };
}

function IngredientChip({
  ingredient,
  isDark,
}: {
  ingredient: Ingredient;
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
        },
      ]}
    >
      <Text style={styles.chipEmoji}>{ingredient.emoji}</Text>
      <Text
        style={[
          styles.chipText,
          { color: isDark ? '#E2E8F0' : '#334155' },
        ]}
      >
        {ingredient.name}
      </Text>
    </View>
  );
}

function FeaturedRecipeCard({
  recipe,
  isDark,
  onPress,
}: {
  recipe: Recipe;
  isDark: boolean;
  onPress: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Mock data for ingredients split (in a real app, this would come from the recipe object)
  const inStock = recipe.matchedIngredients ? recipe.matchedIngredients.split(', ') : [];
  const needed = recipe.missingIngredients ? recipe.missingIngredients.split(', ') : [];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        delay: 100,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        delay: 100,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.featuredCard,
        {
          backgroundColor: isDark ? COLORS.cardDark : COLORS.cardLight,
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable onPress={onPress}>
        <View style={styles.featuredImageContainer}>
          <Image source={{ uri: recipe.image }} style={styles.featuredImage} />
          <View style={styles.featuredImageOverlay} />

          {/* Chef's Choice Badge */}
          <View style={[styles.chefsChoiceBadge, { backgroundColor: isDark ? 'rgba(17,24,39,0.9)' : 'rgba(255,255,255,0.95)' }]}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.olive} />
            <Text style={[styles.chefsChoiceText, { color: isDark ? '#FFF' : '#0F172A' }]}>CHEF'S CHOICE</Text>
          </View>

          {/* Match Badge */}
          <View
            style={[
              styles.matchBadge,
              { backgroundColor: COLORS.primary },
            ]}
          >
            <Text style={styles.matchText}>{recipe.matchPercentage}% MATCH</Text>
          </View>

          {/* Bottom Overlay Info */}
          <View style={styles.featuredBottomOverlay}>
            <Text style={styles.featuredTitleOverride} numberOfLines={2}>{recipe.title}</Text>
            <View style={styles.featuredMetaRow}>
              <View style={styles.glassBadge}>
                <Ionicons name="time-outline" size={14} color="#FFF" />
                <Text style={styles.glassBadgeText}>{recipe.time}</Text>
              </View>
              <View style={styles.glassBadge}>
                <Ionicons name="flame-outline" size={14} color="#FFF" />
                <Text style={styles.glassBadgeText}>{recipe.difficulty}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.featuredContent}>
          <View style={styles.ingredientsGrid}>
            <View style={styles.ingredientCol}>
              <View style={styles.ingredientHeader}>
                <View style={[styles.dot, { backgroundColor: COLORS.olive }]} />
                <Text style={styles.ingredientLabel}>IN STOCK</Text>
              </View>
              <Text style={[styles.ingredientListText, { color: isDark ? '#D1D5DB' : '#334155' }]}>
                {inStock.length > 0 ? inStock.join(', ') : 'All ingredients'}
              </Text>
            </View>

            {needed.length > 0 && (
              <View style={[styles.ingredientCol, styles.ingredientColBorder, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#F1F5F9' }]}>
                <View style={styles.ingredientHeader}>
                  <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.ingredientLabel}>NEEDED</Text>
                </View>
                <Text style={[styles.ingredientListText, { color: isDark ? '#D1D5DB' : '#334155' }]}>
                  {needed.join(', ')}
                </Text>
              </View>
            )}
          </View>

          <Pressable style={[styles.viewRecipeButton, { backgroundColor: isDark ? '#FFFFFF' : '#0F172A' }]} onPress={onPress}>
            <Text style={[styles.viewRecipeButtonText, { color: isDark ? '#0F172A' : '#FFFFFF' }]}>View Step-by-Step Guide</Text>
            <Ionicons name="arrow-forward" size={18} color={isDark ? '#0F172A' : '#FFFFFF'} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CompactRecipeCard({
  recipe,
  isDark,
  onPress,
  delay = 0,
}: {
  recipe: Recipe;
  isDark: boolean;
  onPress: () => void;
  delay?: number;
}) {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        delay,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        delay,
      }),
    ]).start();
  }, [delay]);

  const isReady = !recipe.missingIngredients;
  const missingCount = recipe.missingIngredients ? recipe.missingIngredients.split(',').length : 0;

  return (
    <Animated.View
      style={[
        styles.compactCard,
        {
          backgroundColor: isDark ? COLORS.cardDark : COLORS.cardLight,
          borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Pressable style={styles.compactCardInner} onPress={onPress}>
        <View style={styles.compactImageContainer}>
          <Image source={{ uri: recipe.image }} style={styles.compactImage} />
          <View style={styles.compactImageOverlay} />

          <View style={[styles.compactStatusBadge, { backgroundColor: isReady ? COLORS.olive : '#FB923C' }]}>
            <Text style={styles.compactStatusText}>{isReady ? 'READY' : `MISSING ${missingCount}`}</Text>
          </View>

          <View style={styles.compactTimeBadge}>
            <Ionicons name="time-outline" size={12} color="#FFF" />
            <Text style={styles.compactTimeText}>{recipe.time}</Text>
          </View>
        </View>

        <View style={styles.compactContent}>
          <Text
            style={[
              styles.compactTitle,
              { color: isDark ? '#FFFFFF' : '#0F172A' },
            ]}
            numberOfLines={2}
          >
            {recipe.title}
          </Text>
          <View style={styles.compactMeta}>
            <Ionicons
              name={isReady ? "checkmark-circle" : "bag-handle"}
              size={14}
              color={isReady ? COLORS.olive : COLORS.primary}
            />
            <Text style={styles.compactMetaText}>
              {isReady ? 'All ingredients' : recipe.missingIngredients && recipe.missingIngredients.split(',')[0] + ' needed'}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}



export default function RecipeResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ingredients?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuthStore();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [allRecipesByMealType, setAllRecipesByMealType] = useState<{
    breakfast: Recipe[];
    lunch: Recipe[];
    dinner: Recipe[];
  }>({
    breakfast: [],
    lunch: [],
    dinner: [],
  });
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Smart time-based meal type selection
  const getTimeBasedMealType = (): 'breakfast' | 'lunch' | 'dinner' => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'breakfast';
    if (hour >= 12 && hour < 17) return 'lunch';
    return 'dinner';
  };

  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner'>(getTimeBasedMealType());

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Filter State
  const [filters, setFilters] = useState({
    sortBy: 'relevance',
    dietary: [] as string[],
    time: 45,
    difficulty: null as string | null,
    tools: [] as string[],
  });

  const toggleFilter = (type: 'dietary' | 'tools', value: string) => {
    setFilters(prev => {
      const current = prev[type];
      const exists = current.includes(value);
      return {
        ...prev,
        [type]: exists ? current.filter(d => d !== value) : [...current, value]
      };
    });
  };

  const setSingleFilter = (type: 'sortBy' | 'time' | 'difficulty', value: any) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const applyFilters = () => {
    setFilterModalVisible(false);
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      fetchRecipeSuggestions(selectedIngredients);
    }
  };

  // Parse ingredients from params
  useEffect(() => {
    if (params.ingredients) {
      try {
        const parsed = JSON.parse(params.ingredients);
        if (Array.isArray(parsed)) {
          setIngredients(
            parsed.map((item: { name: string; emoji: string }) => ({
              name: item.name,
              emoji: item.emoji,
              selected: true,
            }))
          );
        }
      } catch (e) {
        console.log('Failed to parse ingredients:', e);
      }
    }
  }, [params.ingredients]);

  // Fetch recipe suggestions when ingredients change
  useEffect(() => {
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      fetchRecipeSuggestions(selectedIngredients);
    }
  }, [ingredients]);

  const fetchRecipeSuggestions = async (ingredientList: Ingredient[]) => {
    try {
      setIsLoadingRecipes(true);
      setError(null);

      const ingredientNames = ingredientList.map((i) => i.name);

      // Fetch recipes for all three meal types simultaneously
      const mealTypes: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];

      const recipePromises = mealTypes.map(async (mealTypeKey) => {
        const userPreferences = user
          ? {
              dietary_restrictions: [...(user.dietary_restrictions || []), ...filters.dietary],
              cooking_style: user.cooking_style,
              max_time_minutes: filters.time,
              difficulty_level: filters.difficulty,
              kitchen_tools: filters.tools,
              meal_type: mealTypeKey,
            }
          : {
              dietary_restrictions: filters.dietary,
              max_time_minutes: filters.time,
              difficulty_level: filters.difficulty,
              kitchen_tools: filters.tools,
              meal_type: mealTypeKey,
            };

        const suggestions = await aiService.suggestRecipesFromIngredients(
          ingredientNames,
          userPreferences
        );

        // Sort by match percentage (highest first)
        const sortedSuggestions = suggestions.sort((a, b) =>
          (b.match_score ?? 0) - (a.match_score ?? 0)
        );

        return {
          mealType: mealTypeKey,
          recipes: sortedSuggestions.map(mapSuggestedRecipeToUI),
        };
      });

      const results = await Promise.all(recipePromises);

      // Organize recipes by meal type
      const organizedRecipes = {
        breakfast: results.find((r) => r.mealType === 'breakfast')?.recipes || [],
        lunch: results.find((r) => r.mealType === 'lunch')?.recipes || [],
        dinner: results.find((r) => r.mealType === 'dinner')?.recipes || [],
      };

      setAllRecipesByMealType(organizedRecipes);
    } catch (err) {
      console.error('Failed to fetch recipe suggestions:', err);
      setError('Failed to find recipes. Please try again.');
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const handleMealTypeChange = (newMealType: 'breakfast' | 'lunch' | 'dinner') => {
    if (newMealType === mealType) return;
    setMealType(newMealType);
    // No need to refetch - recipes are already loaded!
  };

  const handleBack = () => {
    router.back();
  };

  const handleRecipePress = (recipeId: string) => {
    router.push(`/recipe/${recipeId}`);
  };

  const handleRetry = () => {
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      fetchRecipeSuggestions(selectedIngredients);
    }
  };

  // Get recipes for current meal type
  const currentRecipes = allRecipesByMealType[mealType];

  // Get emojis from selected ingredients for the loading animation
  const selectedIngredients = ingredients.filter((i) => i.selected);
  const ingredientEmojis = selectedIngredients.map((i) => i.emoji);

  // Show full-screen loading animation while fetching recipes
  if (isLoadingRecipes && selectedIngredients.length > 0) {
    return (
      <RecipeLoadingAnimation
        ingredientCount={selectedIngredients.length}
        ingredientEmojis={ingredientEmojis}
      />
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: isDark
              ? 'rgba(26,18,16,0.95)'
              : 'rgba(252,250,249,0.95)',
            borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Pressable style={styles.backButton} onPress={handleBack}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={isDark ? '#E5E7EB' : '#374151'}
            />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text
              style={[
                styles.headerTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              AI-Powered Meal Suggestions
            </Text>
          </View>
          <Pressable style={styles.notificationButton}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={isDark ? '#E5E7EB' : '#374151'}
            />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {/* Ingredients Section */}
        <View style={styles.ingredientsSection}>
          <View style={styles.ingredientsHeader}>
            <Text style={styles.sectionLabel}>Base Ingredients</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
            {ingredients.map((ingredient, index) => (
              <IngredientChip
                key={`${index}-${ingredient.name}`}
                ingredient={ingredient}
                isDark={isDark}
              />
            ))}
          </ScrollView>
        </View>

        {/* Meal Type Section */}
        <View style={styles.mealTypeSection}>
          <Text style={styles.mealTypeSectionLabel}>MEAL TYPE</Text>
          <View style={styles.mealTypeSegmented}>
            <Pressable
              style={[
                styles.mealTypeTab,
                mealType === 'breakfast' && styles.mealTypeTabActive,
                {
                  backgroundColor: mealType === 'breakfast'
                    ? COLORS.primary
                    : isDark
                    ? 'rgba(255,255,255,0.05)'
                    : '#FFFFFF',
                  borderColor: mealType === 'breakfast'
                    ? COLORS.primary
                    : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : '#E5E7EB',
                },
              ]}
              onPress={() => handleMealTypeChange('breakfast')}
            >
              <Ionicons
                name="sunny-outline"
                size={20}
                color={mealType === 'breakfast' ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.mealTypeTabText,
                  {
                    color: mealType === 'breakfast'
                      ? '#FFFFFF'
                      : isDark
                      ? '#9CA3AF'
                      : '#6B7280',
                  },
                ]}
              >
                Breakfast
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.mealTypeTab,
                mealType === 'lunch' && styles.mealTypeTabActive,
                {
                  backgroundColor: mealType === 'lunch'
                    ? COLORS.primary
                    : isDark
                    ? 'rgba(255,255,255,0.05)'
                    : '#FFFFFF',
                  borderColor: mealType === 'lunch'
                    ? COLORS.primary
                    : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : '#E5E7EB',
                },
              ]}
              onPress={() => handleMealTypeChange('lunch')}
            >
              <Ionicons
                name="restaurant-outline"
                size={20}
                color={mealType === 'lunch' ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.mealTypeTabText,
                  {
                    color: mealType === 'lunch'
                      ? '#FFFFFF'
                      : isDark
                      ? '#9CA3AF'
                      : '#6B7280',
                  },
                ]}
              >
                Lunch
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.mealTypeTab,
                mealType === 'dinner' && styles.mealTypeTabActive,
                {
                  backgroundColor: mealType === 'dinner'
                    ? COLORS.primary
                    : isDark
                    ? 'rgba(255,255,255,0.05)'
                    : '#FFFFFF',
                  borderColor: mealType === 'dinner'
                    ? COLORS.primary
                    : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : '#E5E7EB',
                },
              ]}
              onPress={() => handleMealTypeChange('dinner')}
            >
              <Ionicons
                name="moon-outline"
                size={20}
                color={mealType === 'dinner' ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.mealTypeTabText,
                  {
                    color: mealType === 'dinner'
                      ? '#FFFFFF'
                      : isDark
                      ? '#9CA3AF'
                      : '#6B7280',
                  },
                ]}
              >
                Dinner
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Recipes Section */}
        <View style={styles.recipesSection}>
          {/* Error State */}
          {error && !isLoadingRecipes && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
              <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {error}
              </Text>
              <Pressable style={styles.retryButton} onPress={handleRetry}>
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          )}

          {/* Recipe Results */}
          {!isLoadingRecipes && !error && (
            <>
              {currentRecipes.length > 0 ? (
                <>
                  {/* Recipe Slider Header */}
                  <View style={styles.sliderHeader}>
                    <Text style={[styles.sliderTitle, { color: isDark ? '#FFF' : '#0F172A' }]}>
                      Top Matches for {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                    </Text>
                    <Text style={styles.sliderSubtitle}>
                      Swipe to browse • Sorted by match %
                    </Text>
                  </View>

                  {/* Horizontal Recipe Slider */}
                  <FlatList
                    data={currentRecipes}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.recipeSliderContainer}
                    snapToInterval={SCREEN_WIDTH - 32}
                    decelerationRate="fast"
                    renderItem={({ item }) => (
                      <View style={styles.sliderCardWrapper}>
                        <FeaturedRecipeCard
                          recipe={item}
                          isDark={isDark}
                          onPress={() => handleRecipePress(item.id)}
                        />
                      </View>
                    )}
                  />

                  {/* Alternatives Section */}
                  {currentRecipes.length > 3 && (
                    <>
                      <View style={styles.alternativesHeader}>
                        <Text style={[styles.alternativesTitle, { color: isDark ? '#FFF' : '#0F172A' }]}>
                          More Options
                        </Text>
                      </View>

                      <View style={styles.alternativesGrid}>
                        {currentRecipes.slice(3).map((recipe, index) => (
                          <CompactRecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            isDark={isDark}
                            onPress={() => handleRecipePress(recipe.id)}
                            delay={(index + 1) * 100}
                          />
                        ))}
                      </View>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="restaurant-outline" size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  <Text style={[styles.emptyText, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                    No {mealType} recipes found for these ingredients
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Floating Filter Button */}
      <View style={[styles.filterButtonContainer, { bottom: insets.bottom + 32 }]}>
        <Pressable
          style={[styles.filterButton, { backgroundColor: isDark ? '#FFF' : '#0F172A' }]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons name="options-outline" size={20} color={isDark ? '#0F172A' : '#FFF'} />
          <Text style={[styles.filterButtonText, { color: isDark ? '#0F172A' : '#FFF' }]}>FILTER</Text>
        </Pressable>
      </View>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1A1210' : '#FFFFFF', padding: 0 }]}>
            {/* Header */}
            <View style={styles.modalHeaderNew}>
              <Text style={[styles.modalTitleNew, { color: isDark ? '#FFF' : '#1A1210' }]}>Filter Settings</Text>
              <Pressable
                style={styles.closeButtonNew}
                onPress={() => setFilterModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={'#1A1210'} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBodyNew} showsVerticalScrollIndicator={false}>
              {/* Sort By */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>SORT BY</Text>
                <View style={styles.filterOptions}>
                  {['relevance', 'time', 'match %'].map(sort => {
                    const isSelected = filters.sortBy === sort;
                    return (
                      <Pressable
                        key={sort}
                        onPress={() => setSingleFilter('sortBy', sort)}
                        style={[
                          styles.filterPill,
                          isSelected && styles.filterPillSelected,
                          { borderColor: isDark ? '#333' : '#E5E7EB', backgroundColor: isSelected ? 'rgba(242, 51, 13, 0.05)' : (isDark ? '#1A1210' : '#FFF') }
                        ]}
                      >
                        <Text style={[
                          styles.filterPillText,
                          isSelected && styles.filterPillTextSelected,
                          { color: isSelected ? COLORS.primary : (isDark ? '#9CA3AF' : '#4B5563') }
                        ]}>{sort === 'match %' ? 'Match %' : sort.charAt(0).toUpperCase() + sort.slice(1)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Dietary */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>DIETARY PREFERENCES</Text>
                <View style={styles.filterOptions}>
                  {['vegan', 'keto', 'gluten-free', 'paleo', 'vegetarian'].map(diet => {
                    const isSelected = filters.dietary.includes(diet);
                    return (
                      <Pressable
                        key={diet}
                        onPress={() => toggleFilter('dietary', diet)}
                        style={[
                          styles.filterPill,
                          isSelected && styles.filterPillSelected,
                          { borderColor: isDark ? '#333' : '#E5E7EB', backgroundColor: isSelected ? 'rgba(242, 51, 13, 0.05)' : (isDark ? '#1A1210' : '#FFF') }
                        ]}
                      >
                        <Text style={[
                          styles.filterPillText,
                          isSelected && styles.filterPillTextSelected,
                          { color: isSelected ? COLORS.primary : (isDark ? '#9CA3AF' : '#4B5563') }
                        ]}>{diet === 'gluten-free' ? 'Gluten-Free' : diet.charAt(0).toUpperCase() + diet.slice(1)}</Text>
                        {isSelected && <MaterialIcons name="check" size={16} color={COLORS.primary} style={{ marginLeft: 4 }} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Prep Time */}
              <View style={styles.filterSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={styles.filterSectionTitle}>PREP TIME</Text>
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeBadgeText}>Up to {filters.time || 60} mins</Text>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 8 }}>
                  <Slider
                    value={filters.time || 60}
                    onValueChange={(val) => setSingleFilter('time', Math.round(val))}
                    maximumValue={60}
                    minimumValue={0}
                    step={5}
                    allowTouchTrack
                    trackStyle={{ height: 4, borderRadius: 2 }}
                    thumbStyle={{ height: 24, width: 24, backgroundColor: COLORS.primary, borderColor: '#FFF', borderWidth: 4 }}
                    minimumTrackTintColor={COLORS.primary}
                    maximumTrackTintColor={isDark ? '#333' : '#E2E8F0'}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={styles.sliderLabel}>0 mins</Text>
                    <Text style={styles.sliderLabel}>60+ mins</Text>
                  </View>
                </View>
              </View>

              {/* Difficulty */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>DIFFICULTY</Text>
                <View style={styles.difficultyGrid}>
                  {[
                    { id: 'beginner', label: 'Easy', icon: 'signal-cellular-1' },
                    { id: 'intermediate', label: 'Intermediate', icon: 'signal-cellular-2' },
                    { id: 'advanced', label: 'Expert', icon: 'signal-cellular-3' }
                  ].map((level) => {
                    const isSelected = filters.difficulty === level.id;
                    return (
                      <Pressable
                        key={level.id}
                        onPress={() => setSingleFilter('difficulty', level.id)}
                        style={[
                          styles.difficultyCard,
                          isSelected && styles.difficultyCardSelected,
                          {
                            backgroundColor: isSelected ? COLORS.primary : (isDark ? '#FFFFFF' : '#FFFFFF'),
                            borderColor: isSelected ? COLORS.primary : (isDark ? '#333' : '#E5E7EB')
                          }
                        ]}
                      >
                        <View style={{ marginBottom: 8 }}>
                          <MaterialCommunityIcons
                            name={level.icon as any}
                            size={24}
                            color={isSelected ? '#FFF' : '#D1D5DB'}
                          />
                        </View>
                        <Text style={[
                          styles.difficultyLabel,
                          isSelected && styles.difficultyLabelSelected,
                          { color: isSelected ? '#FFF' : '#4B5563' }
                        ]}>{level.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Kitchen Tools */}
              <View style={[styles.filterSection, { marginBottom: 100 }]}>
                <Text style={styles.filterSectionTitle}>KITCHEN TOOLS</Text>
                <View style={styles.filterOptions}>
                  {[
                    { id: 'air_fryer', label: 'Air Fryer', icon: 'fan' },
                    { id: 'oven', label: 'Oven', icon: 'stove' },
                    { id: 'stovetop', label: 'Stovetop', icon: 'fire' },
                    { id: 'slow_cooker', label: 'Slow Cooker', icon: 'timer-outline' },
                    { id: 'blender', label: 'Blender', icon: 'blender' }
                  ].map(tool => {
                    const isSelected = filters.tools.includes(tool.id);
                    return (
                      <Pressable
                        key={tool.id}
                        onPress={() => toggleFilter('tools', tool.id)}
                        style={[
                          styles.filterPill,
                          isSelected && styles.filterPillSelected,
                          { borderColor: isDark ? '#333' : '#E5E7EB', backgroundColor: isSelected ? 'rgba(242, 51, 13, 0.05)' : (isDark ? '#1A1210' : '#FFF') }
                        ]}
                      >
                        <MaterialCommunityIcons name={tool.icon as any} size={18} color={isSelected ? COLORS.primary : '#9CA3AF'} style={{ marginRight: 6 }} />
                        <Text style={[
                          styles.filterPillText,
                          isSelected && styles.filterPillTextSelected,
                          { color: isSelected ? COLORS.primary : (isDark ? '#9CA3AF' : '#4B5563') }
                        ]}>{tool.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: isDark ? '#333' : '#F3F4F6' }]}>
              <Pressable
                style={styles.resetButton}
                onPress={() => setFilters({
                  sortBy: 'relevance',
                  dietary: [],
                  time: 45,
                  difficulty: null,
                  tools: []
                })}
              >
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable
                style={[styles.applyButton, { backgroundColor: COLORS.primary }]}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    marginLeft: -8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    lineHeight: 24,
  },
  notificationButton: {
    width: 40,
    height: 40,
    marginRight: -8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FCFAF9',
  },
  scrollView: {
    flex: 1,
    paddingTop: 100,
  },
  ingredientsSection: {
    paddingVertical: 16,
  },
  ingredientsHeader: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  chipsContainer: {
    paddingHorizontal: 24,
    gap: 10,
    paddingBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  chipEmoji: {
    fontSize: 18,
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  recipesSection: {
    paddingHorizontal: 24,
    gap: 24,
  },
  featuredCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 4,
  },
  featuredImageContainer: {
    height: 256,
    overflow: 'hidden',
    position: 'relative',
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  featuredImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  chefsChoiceBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  chefsChoiceText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  matchBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  matchText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  featuredBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 40,
  },
  featuredTitleOverride: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  glassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  glassBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
  },
  featuredContent: {
    padding: 20,
  },
  ingredientsGrid: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  ingredientCol: {
    flex: 1,
    gap: 8,
  },
  ingredientColBorder: {
    paddingLeft: 16,
    borderLeftWidth: 1,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 1,
  },
  ingredientListText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    lineHeight: 20,
  },
  viewRecipeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 2,
  },
  viewRecipeButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  alternativesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alternativesTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.primary,
  },
  alternativesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  compactCard: {
    width: (SCREEN_WIDTH - 64) / 2, // 2 columns with padding and gap
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  compactCardInner: {
    flexDirection: 'column', // Stack vertically
    height: 'auto',
  },
  compactImageContainer: {
    width: '100%',
    height: 128,
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  compactImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  compactStatusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  compactStatusText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  compactTimeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  compactTimeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
  },
  compactContent: {
    padding: 12,
    gap: 8,
  },
  compactTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    lineHeight: 18,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactMetaText: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'NotoSans_500Medium',
  },
  filterButtonContainer: {
    position: 'absolute',
    right: 24,
    zIndex: 40,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  filterButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  modalBody: {
    flex: 1,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
    borderWidth: 1,
  },
  filterOptionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterOptionText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
  },
  filterOptionTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },

  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
  },
  modalHeaderNew: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitleNew: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.5,
  },
  closeButtonNew: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBodyNew: {
    flex: 1,
    paddingHorizontal: 24,
  },
  filterSectionTitle: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1, // Default border width
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPillSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(242, 51, 13, 0.05)',
    borderWidth: 1.5,
  },
  filterPillText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  filterPillTextSelected: {
    color: COLORS.primary,
  },
  timeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1210',
  },
  sliderLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
  },
  difficultyGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  difficultyCard: {
    flex: 1,
    aspectRatio: 1, // Square
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  difficultyCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    borderWidth: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  difficultyLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
  },
  difficultyLabelSelected: {
    color: '#FFFFFF',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  resetButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFF',
  },
  mealTypeSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  mealTypeSectionLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  mealTypeSegmented: {
    flexDirection: 'row',
    gap: 8,
  },
  mealTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  mealTypeTabActive: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mealTypeTabText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sliderHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sliderTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 4,
  },
  sliderSubtitle: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9CA3AF',
  },
  recipeSliderContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sliderCardWrapper: {
    width: SCREEN_WIDTH - 48,
    marginHorizontal: 8,
  },
});
