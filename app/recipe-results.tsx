import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  useColorScheme,
  Pressable,
  Text,
  Dimensions,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeLoadingAnimation } from '@/components/RecipeLoadingAnimation';
import { RecipeFlashcard } from '@/components/RecipeFlashcard';
import { MealTypeTabs } from '@/components/MealTypeTabs';
import { PantryChips } from '@/components/PantryChips';
import { aiService } from '@/services/ai.service';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { getIngredientEmoji } from '@/utils/ingredientEmojis';
import { getRecipeImage } from '@/utils/recipePlaceholders';
import type { SuggestedRecipe, RecipeDifficulty } from '@/utils/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

interface Ingredient {
  name: string;
  emoji: string;
  selected: boolean;
}

interface FlashcardIngredient {
  name: string;
  inStock: boolean;
}

interface FlashcardRecipe {
  id: string;
  name: string;
  image: string;
  prepTime: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  matchPercentage: number;
  isChefChoice: boolean;
  ingredients: FlashcardIngredient[];
  // Store original AI recipe for detail view
  originalRecipe?: SuggestedRecipe;
}

const RECIPE_PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
];

const COLORS = {
  primary: '#FF4B2B',
  olive: '#606C38',
  charcoal: '#121417',
  backgroundLight: '#FDFDFD',
  backgroundDark: '#1A1210',
};

async function mapSuggestedRecipeToFlashcard(
  recipe: SuggestedRecipe,
  index: number,
  availableIngredients: string[],
  storeOriginal: boolean = true
): Promise<FlashcardRecipe> {
  const difficultyMap: Record<RecipeDifficulty, 'Easy' | 'Medium' | 'Hard'> = {
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

  // Map ingredients to flashcard format
  const allIngredientsList = [
    ...(recipe.ingredients_you_have || []),
    ...(recipe.ingredients_you_need || []),
  ];

  const mappedIngredients: FlashcardIngredient[] = allIngredientsList.map((ing) => ({
    name: ing,
    inStock: recipe.ingredients_you_have?.includes(ing) || false,
  }));

  // Generate AI image for recipe
  let recipeImage = '';
  try {
    const base64 = await aiService.generateRecipeImage(recipe.title);
    recipeImage = `data:image/png;base64,${base64}`;
  } catch {
    recipeImage = getRecipeImage(
      recipe.image_url,
      recipe.title,
      recipe.cuisine_type,
      recipe.ingredients_you_have
    );
  }

  return {
    id: `ai-${index + 1}`,
    name: recipe.title,
    image: recipeImage,
    prepTime: formatTime(recipe.total_time_minutes),
    difficulty: difficultyMap[recipe.difficulty] || 'Easy',
    matchPercentage: recipe.match_score ?? 80,
    isChefChoice: index === 0, // First recipe is chef's choice
    ingredients: mappedIngredients,
    originalRecipe: storeOriginal ? recipe : undefined,
  };
}

export default function RecipeResultsFlashcardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ingredients?: string; sourceType?: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuthStore();
  const { addRecipe } = useRecipeStore();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [allRecipesByMealType, setAllRecipesByMealType] = useState<{
    Breakfast: FlashcardRecipe[];
    Lunch: FlashcardRecipe[];
    Dinner: FlashcardRecipe[];
  }>({
    Breakfast: [],
    Lunch: [],
    Dinner: [],
  });
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Smart time-based meal type selection
  const getTimeBasedMealType = (): MealType => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Breakfast';
    if (hour >= 12 && hour < 17) return 'Lunch';
    return 'Dinner';
  };

  const [mealType, setMealType] = useState<MealType>(getTimeBasedMealType());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [sortBy, setSortBy] = useState<'match' | 'time' | 'difficulty'>('match');
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');

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
      const mealTypes: ('breakfast' | 'lunch' | 'dinner')[] = ['breakfast', 'lunch', 'dinner'];

      // Meal-specific time limits for better suggestions
      const getMealTimeLimit = (meal: 'breakfast' | 'lunch' | 'dinner'): number => {
        switch (meal) {
          case 'breakfast': return 20; // Morning rush: 5-20 minutes
          case 'lunch': return 35;     // Midday efficiency: 15-35 minutes
          case 'dinner': return 60;    // Evening leisure: 30-60 minutes
        }
      };

      const recipePromises = mealTypes.map(async (mealTypeKey) => {
        const userPreferences = user
          ? {
              dietary_restrictions: user.dietary_restrictions || [],
              cooking_style: user.cooking_style,
              max_time_minutes: getMealTimeLimit(mealTypeKey),
              meal_type: mealTypeKey,
            }
          : {
              dietary_restrictions: [],
              max_time_minutes: getMealTimeLimit(mealTypeKey),
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

        // Map recipes with async image fetching
        const recipes = await Promise.all(
          sortedSuggestions.map((recipe, index) =>
            mapSuggestedRecipeToFlashcard(recipe, index, ingredientNames)
          )
        );

        return {
          mealType: mealTypeKey,
          recipes,
        };
      });

      const results = await Promise.all(recipePromises);

      // Organize recipes by meal type
      const organizedRecipes = {
        Breakfast: results.find((r) => r.mealType === 'breakfast')?.recipes || [],
        Lunch: results.find((r) => r.mealType === 'lunch')?.recipes || [],
        Dinner: results.find((r) => r.mealType === 'dinner')?.recipes || [],
      };

      setAllRecipesByMealType(organizedRecipes);
    } catch (err) {
      console.error('Failed to fetch recipe suggestions:', err);
      setError('Failed to find recipes. Please try again.');
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const sortRecipes = (recipes: FlashcardRecipe[]): FlashcardRecipe[] => {
    const sorted = [...recipes];
    switch (sortBy) {
      case 'match':
        return sorted.sort((a, b) => b.matchPercentage - a.matchPercentage);
      case 'time':
        return sorted.sort((a, b) => {
          const parseTime = (time: string) => {
            const match = time.match(/(\d+)/);
            return match ? parseInt(match[1]) : 0;
          };
          return parseTime(a.prepTime) - parseTime(b.prepTime);
        });
      case 'difficulty':
        const difficultyOrder = { Easy: 1, Medium: 2, Hard: 3 };
        return sorted.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
      default:
        return sorted;
    }
  };

  const handleMealTypeChange = (newMealType: MealType) => {
    if (newMealType === mealType) return;
    setMealType(newMealType);
    setCurrentIndex(0); // Reset to first card when changing meal type
  };

  const handleSortChange = (newSortBy: 'match' | 'time' | 'difficulty') => {
    setSortBy(newSortBy);
    setSortModalVisible(false);
    setCurrentIndex(0); // Reset to first card
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    const currentRecipes = sortRecipes(allRecipesByMealType[mealType]);

    if (direction === 'right') {
      // Swipe right = next card
      setCurrentIndex((prev) => (prev + 1) % currentRecipes.length);
    } else {
      // Swipe left = previous card
      setCurrentIndex((prev) => (prev - 1 + currentRecipes.length) % currentRecipes.length);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleCardPress = (recipe: FlashcardRecipe) => {
    // Navigate to detail view with the original AI recipe data
    if (recipe.originalRecipe) {
      router.push({
        pathname: '/suggested-recipe-detail',
        params: {
          recipe: JSON.stringify(recipe.originalRecipe),
          imageUrl: recipe.image,
          sourceType: params.sourceType || 'ai_chef',
        },
      });
    }
  };

  const handleFavoritePress = async (recipe: FlashcardRecipe) => {
    // Save recipe to favorites
    if (!recipe.originalRecipe) return;

    try {
      // Convert suggested recipe to full recipe format
      const fullRecipe = await aiService.expandRecipeFromSuggestion(recipe.originalRecipe);
      await addRecipe(fullRecipe, undefined, undefined, (params.sourceType || 'ai_chef') as any);

      // Show success feedback
      Alert.alert('Saved!', `${recipe.name} added to your collection`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save recipe');
    }
  };

  const handleCookNow = () => {
    const currentRecipes = allRecipesByMealType[mealType];
    const currentRecipe = currentRecipes[currentIndex];
    if (currentRecipe) {
      // For AI-suggested recipes, navigate to detail view instead
      handleCardPress(currentRecipe);
    }
  };

  const handleRetry = () => {
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      fetchRecipeSuggestions(selectedIngredients);
    }
  };

  const handleAddIngredient = () => {
    setShowAddModal(true);
    setManualItemName('');
  };

  const handleConfirmAddItem = async () => {
    if (!manualItemName.trim()) return;

    const newIngredient: Ingredient = {
      name: manualItemName.trim(),
      emoji: getIngredientEmoji(manualItemName.trim()),
      selected: true,
    };

    // Add to ingredients list
    const updatedIngredients = [...ingredients, newIngredient];
    setIngredients(updatedIngredients);

    // Refetch recipes with the new ingredient
    const selectedIngredients = updatedIngredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      await fetchRecipeSuggestions(selectedIngredients);
    }

    setShowAddModal(false);
    setManualItemName('');
  };

  const currentRecipes = sortRecipes(allRecipesByMealType[mealType]);
  const currentRecipe = currentRecipes[currentIndex];
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
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight },
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? COLORS.backgroundDark : COLORS.backgroundLight}
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: isDark
              ? 'rgba(26,18,16,0.95)'
              : 'rgba(253,253,253,0.95)',
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
              Flashcard Suggestions
            </Text>
          </View>
          <View style={styles.backButton} />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Meal Type Tabs */}
        <View style={styles.tabsContainer}>
          <MealTypeTabs
            activeType={mealType}
            onSelect={handleMealTypeChange}
            isDark={isDark}
          />
        </View>

        {/* Pantry Chips */}
        <View style={styles.pantryContainer}>
          <PantryChips
            ingredients={selectedIngredients.map((i) => i.name)}
            onAddPress={handleAddIngredient}
            isDark={isDark}
          />
        </View>

        {/* Section Title */}
        <View style={styles.sectionTitle}>
          <Text
            style={[
              styles.title,
              { color: isDark ? '#FFFFFF' : COLORS.charcoal },
            ]}
          >
            Top Matches for {mealType}
          </Text>
          <Text style={styles.subtitle}>
            Swipe to browse <Text style={styles.dot}>•</Text> Sorted by match %
          </Text>
        </View>

        {/* Flashcard Area */}
        <View style={styles.flashcardContainer}>
          {!error && currentRecipes.length > 0 && currentRecipe ? (
            <RecipeFlashcard
              recipe={currentRecipe}
              nextRecipe={currentRecipes[(currentIndex + 1) % currentRecipes.length]}
              onSwipe={handleSwipe}
              activeIndex={currentIndex}
              totalItems={currentRecipes.length}
              isDark={isDark}
              onCardPress={handleCardPress}
              onFavoritePress={handleFavoritePress}
            />
          ) : error ? (
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
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
              <Text style={[styles.emptyText, { color: isDark ? '#9CA3AF' : '#64748B' }]}>
                No {mealType.toLowerCase()} recipes found
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.actionBar}>
            <Pressable
              style={styles.cookButton}
              onPress={handleCookNow}
              disabled={!currentRecipe}
            >
              <Text style={styles.cookButtonText}>COOK THIS MEAL NOW</Text>
              <Ionicons name="restaurant" size={18} color="#FFFFFF" />
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              style={styles.settingsButton}
              onPress={() => setSortModalVisible(true)}
            >
              <Ionicons name="options-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Sort/Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={sortModalVisible}
        onRequestClose={() => setSortModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#1A1210' : '#FFFFFF' },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isDark ? '#FFFFFF' : '#121417' },
                ]}
              >
                Sort Recipes
              </Text>
              <Pressable
                style={styles.closeButton}
                onPress={() => setSortModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </Pressable>
            </View>

            {/* Sort Options */}
            <ScrollView style={styles.modalBody}>
              <View style={styles.sortSection}>
                <Text style={styles.sectionLabel}>SORT BY</Text>

                <Pressable
                  style={[
                    styles.sortOption,
                    sortBy === 'match' && styles.sortOptionActive,
                    {
                      backgroundColor: sortBy === 'match'
                        ? 'rgba(255, 75, 43, 0.1)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#F9FAFB',
                      borderColor: sortBy === 'match'
                        ? COLORS.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : '#E5E7EB',
                    },
                  ]}
                  onPress={() => handleSortChange('match')}
                >
                  <View style={styles.sortOptionContent}>
                    <Ionicons
                      name="trending-up"
                      size={24}
                      color={sortBy === 'match' ? COLORS.primary : '#9CA3AF'}
                    />
                    <View style={styles.sortOptionText}>
                      <Text
                        style={[
                          styles.sortOptionTitle,
                          {
                            color: sortBy === 'match'
                              ? COLORS.primary
                              : isDark
                              ? '#E5E7EB'
                              : '#1F2937',
                          },
                        ]}
                      >
                        Best Match
                      </Text>
                      <Text style={styles.sortOptionDescription}>
                        Highest ingredient match %
                      </Text>
                    </View>
                  </View>
                  {sortBy === 'match' && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.sortOption,
                    sortBy === 'time' && styles.sortOptionActive,
                    {
                      backgroundColor: sortBy === 'time'
                        ? 'rgba(255, 75, 43, 0.1)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#F9FAFB',
                      borderColor: sortBy === 'time'
                        ? COLORS.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : '#E5E7EB',
                    },
                  ]}
                  onPress={() => handleSortChange('time')}
                >
                  <View style={styles.sortOptionContent}>
                    <Ionicons
                      name="time-outline"
                      size={24}
                      color={sortBy === 'time' ? COLORS.primary : '#9CA3AF'}
                    />
                    <View style={styles.sortOptionText}>
                      <Text
                        style={[
                          styles.sortOptionTitle,
                          {
                            color: sortBy === 'time'
                              ? COLORS.primary
                              : isDark
                              ? '#E5E7EB'
                              : '#1F2937',
                          },
                        ]}
                      >
                        Fastest First
                      </Text>
                      <Text style={styles.sortOptionDescription}>
                        Shortest prep time
                      </Text>
                    </View>
                  </View>
                  {sortBy === 'time' && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.sortOption,
                    sortBy === 'difficulty' && styles.sortOptionActive,
                    {
                      backgroundColor: sortBy === 'difficulty'
                        ? 'rgba(255, 75, 43, 0.1)'
                        : isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : '#F9FAFB',
                      borderColor: sortBy === 'difficulty'
                        ? COLORS.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : '#E5E7EB',
                    },
                  ]}
                  onPress={() => handleSortChange('difficulty')}
                >
                  <View style={styles.sortOptionContent}>
                    <Ionicons
                      name="bar-chart-outline"
                      size={24}
                      color={sortBy === 'difficulty' ? COLORS.primary : '#9CA3AF'}
                    />
                    <View style={styles.sortOptionText}>
                      <Text
                        style={[
                          styles.sortOptionTitle,
                          {
                            color: sortBy === 'difficulty'
                              ? COLORS.primary
                              : isDark
                              ? '#E5E7EB'
                              : '#1F2937',
                          },
                        ]}
                      >
                        Easiest First
                      </Text>
                      <Text style={styles.sortOptionDescription}>
                        Simple to complex
                      </Text>
                    </View>
                  </View>
                  {sortBy === 'difficulty' && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Ingredient Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.addModalOverlay}
        >
          <Pressable
            style={styles.addModalBackdrop}
            onPress={() => setShowAddModal(false)}
          />
          <View
            style={[
              styles.addModalContent,
              { backgroundColor: isDark ? '#1A1210' : '#FFFFFF' },
            ]}
          >
            <View style={styles.addModalHeader}>
              <Text
                style={[
                  styles.addModalTitle,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                Add Ingredient
              </Text>
              <Pressable
                onPress={() => setShowAddModal(false)}
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={isDark ? '#9CA3AF' : '#64748B'}
                />
              </Pressable>
            </View>

            <View style={styles.addModalBody}>
              <Text
                style={[
                  styles.addInputLabel,
                  { color: isDark ? '#D1D5DB' : '#64748B' },
                ]}
              >
                Ingredient Name
              </Text>
              <TextInput
                style={[
                  styles.addTextInput,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
                  },
                ]}
                placeholder="e.g., Tomatoes, Milk, Eggs..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={manualItemName}
                onChangeText={setManualItemName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleConfirmAddItem}
              />
            </View>

            <View style={styles.addModalFooter}>
              <Pressable
                style={[
                  styles.addModalButton,
                  styles.addModalCancelButton,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.05)'
                      : '#F3F4F6',
                  },
                ]}
                onPress={() => setShowAddModal(false)}
              >
                <Text
                  style={[
                    styles.addModalButtonText,
                    { color: isDark ? '#D1D5DB' : '#64748B' },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.addModalButton,
                  styles.addModalConfirmButton,
                  !manualItemName.trim() && styles.addModalButtonDisabled,
                ]}
                onPress={handleConfirmAddItem}
                disabled={!manualItemName.trim()}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.addModalConfirmButtonText}>Add Ingredient</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
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
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  tabsContainer: {
    marginBottom: 8,
  },
  pantryContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#94A3B8',
    marginTop: 8,
  },
  dot: {
    fontSize: 10,
    opacity: 0.4,
  },
  flashcardContainer: {
    flex: 1,
    marginBottom: 16,
  },
  bottomBar: {
    paddingTop: 16,
  },
  actionBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.charcoal,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  cookButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cookButtonText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  settingsButton: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
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
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    maxHeight: '70%',
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  sortSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  sortOptionActive: {
    borderWidth: 2,
  },
  sortOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  sortOptionText: {
    flex: 1,
    gap: 4,
  },
  sortOptionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sortOptionDescription: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: '#9CA3AF',
  },
  addModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  addModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  addModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  addModalTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  addModalBody: {
    marginBottom: 24,
  },
  addInputLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 8,
  },
  addTextInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'NotoSans_400Regular',
  },
  addModalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  addModalButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addModalCancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  addModalConfirmButton: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addModalButtonDisabled: {
    opacity: 0.5,
  },
  addModalButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  addModalConfirmButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
