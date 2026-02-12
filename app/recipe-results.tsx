import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Dimensions,
  StatusBar,
  Alert,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  withDelay,
  interpolate,
  Easing,
  FadeIn,
  FadeInDown,
  SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { aiService } from '@/services/ai.service';
import { firebaseService } from '@/services/firebase.service';
import { useAuthStore } from '@/stores/authStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import type { SuggestedRecipe, RecipeDifficulty } from '@/utils/types';
import { storeImage, storeData } from '@/utils/imageCache';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FFFEFB',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  olive: '#6B8E23',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Card dimensions — tall elegant cards
const CARD_WIDTH = SCREEN_WIDTH * 0.6;
const CARD_HEIGHT = CARD_WIDTH * (16 / 9);
const CARD_GAP = 16;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

// Card colors — muted tones that feel luxurious
const CARD_COLORS = [
  '#716B64', '#646B71', '#716464', '#6B7164',
  '#64716B', '#71646B', '#6B6471', '#646471',
];
const RECIPE_CARD_IMAGE_MODE =
  process.env.EXPO_PUBLIC_RECIPE_CARD_IMAGE_MODE === 'background' ? 'background' : 'blocking';
const parsedInitialRecipeCount = Number(process.env.EXPO_PUBLIC_RECIPE_INITIAL_COUNT);
const INITIAL_RECIPE_COUNT =
  Number.isFinite(parsedInitialRecipeCount) && parsedInitialRecipeCount > 0
    ? Math.floor(parsedInitialRecipeCount)
    : 4;
const IMAGE_QUEUE_CONCURRENCY = 2;
const INITIAL_BUILDING_PLACEHOLDER = 'Preparing your recipes';

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
  originalRecipe?: SuggestedRecipe;
  expandedRecipe?: any;
  color: string;
  isBuilding?: boolean;
}

function mapSuggestedRecipeToFlashcard(
  recipe: SuggestedRecipe,
  index: number,
  storeOriginal: boolean = true
): FlashcardRecipe {
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

  const allIngredientsList = [
    ...(recipe.ingredients_you_have || []),
    ...(recipe.ingredients_you_need || []),
  ];

  const mappedIngredients: FlashcardIngredient[] = allIngredientsList.map((ing) => ({
    name: ing,
    inStock: recipe.ingredients_you_have?.includes(ing) || false,
  }));

  return {
    id: `ai-${index + 1}`,
    name: recipe.title,
    image: '',
    prepTime: formatTime(recipe.total_time_minutes),
    difficulty: difficultyMap[recipe.difficulty] || 'Easy',
    matchPercentage: recipe.match_score ?? 80,
    isChefChoice: index === 0,
    ingredients: mappedIngredients,
    originalRecipe: storeOriginal ? recipe : undefined,
    color: CARD_COLORS[index % CARD_COLORS.length],
  };
}

// ============================================================
// RECIPE CARD COMPONENT
// ============================================================

interface RecipeCardProps {
  recipe: FlashcardRecipe;
  index: number;
  scrollX: SharedValue<number>;
  onPress: (recipe: FlashcardRecipe) => void;
  onFavorite: (recipe: FlashcardRecipe) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = React.memo(({
  recipe,
  index,
  scrollX,
  onPress,
  onFavorite,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const favoriteScale = useSharedValue(1);

  const inputRange = [
    (index - 1) * (CARD_WIDTH + CARD_GAP),
    index * (CARD_WIDTH + CARD_GAP),
    (index + 1) * (CARD_WIDTH + CARD_GAP),
  ];

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.85, 1, 0.85],
      'clamp'
    );
    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      [15, 0, -15],
      'clamp'
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.5, 1, 0.5],
      'clamp'
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [20, 0, 20],
      'clamp'
    );

    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateY}deg` },
        { scale },
        { translateY },
      ],
      opacity,
    };
  });

  // Content slides up when card becomes active
  const contentStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [30, 0, 30],
      'clamp'
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      'clamp'
    );
    return { transform: [{ translateY }], opacity };
  });

  const handleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaved(!isSaved);
    favoriteScale.value = withSequence(
      withSpring(0.75, { damping: 10, stiffness: 400 }),
      withSpring(1.2, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onFavorite(recipe);
  };

  const favoriteAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favoriteScale.value }],
  }));

  return (
    <Animated.View style={[styles.cardWrapper, cardStyle]}>
      <Pressable
        style={styles.card}
        onPress={() => onPress(recipe)}
      >
        {/* Image */}
        {recipe.image ? (
          <ExpoImage
            source={{ uri: recipe.image }}
            style={styles.cardImage}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View style={styles.cardImageFallback}>
            <Ionicons name="sparkles-outline" size={26} color="rgba(255,255,255,0.45)" />
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
          style={styles.cardGradient}
        />

        {/* Top badges */}
        <View style={styles.cardTopRow}>
          <View style={styles.matchBadge}>
            <Text style={styles.matchBadgeText}>{recipe.matchPercentage}%</Text>
          </View>
          <Animated.View style={favoriteAnimStyle}>
            <Pressable
              onPress={handleFavorite}
              style={[styles.favBtn, isSaved && styles.favBtnActive]}
              hitSlop={10}
            >
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={18}
                color="#FFF"
              />
            </Pressable>
          </Animated.View>
        </View>

        {/* Bottom content */}
        <Animated.View style={[styles.cardBottom, contentStyle]}>
          {recipe.isChefChoice && (
            <View style={styles.chefBadge}>
              <Ionicons name="sparkles" size={10} color={C.gold} />
              <Text style={styles.chefBadgeText}>Chef's Pick</Text>
            </View>
          )}

          <Text style={styles.cardTitle} numberOfLines={2}>
            {recipe.name}
          </Text>

          <View style={styles.cardMeta}>
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaChipText}>{recipe.prepTime}</Text>
            </View>
            <View style={styles.metaDot} />
            <View style={styles.metaChip}>
              <MaterialCommunityIcons name="chef-hat" size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.metaChipText}>{recipe.difficulty}</Text>
            </View>
          </View>

          <View style={styles.tapHint}>
            <View style={styles.tapHintIcon}>
              <Ionicons name="expand-outline" size={14} color="#FFF" />
            </View>
            <Text style={styles.tapHintText}>Tap to expand</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================
// BUILDING CARD — Simmering ripple animation
// ============================================================

interface BuildingCardProps {
  name: string;
  index: number;
  scrollX: SharedValue<number>;
  progress: string;
}

const RIPPLE_SIZE = 180;

const BuildingCard: React.FC<BuildingCardProps> = React.memo(({ name, index, scrollX, progress }) => {
  // Three staggered ripple rings
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple3 = useSharedValue(0);
  // Animated progress line
  const lineX = useSharedValue(-1);

  useEffect(() => {
    const rippleAnim = (delay: number) =>
      withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 2800, easing: Easing.out(Easing.quad) }),
          -1,
          false
        )
      );
    ripple1.value = rippleAnim(0);
    ripple2.value = rippleAnim(900);
    ripple3.value = rippleAnim(1800);

    lineX.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(-1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
  }, []);

  const inputRange = [
    (index - 1) * (CARD_WIDTH + CARD_GAP),
    index * (CARD_WIDTH + CARD_GAP),
    (index + 1) * (CARD_WIDTH + CARD_GAP),
  ];

  const cardStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollX.value, inputRange, [0.85, 1, 0.85], 'clamp');
    const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], 'clamp');
    const translateY = interpolate(scrollX.value, inputRange, [20, 0, 20], 'clamp');
    return {
      transform: [{ perspective: 1000 }, { scale }, { translateY }],
      opacity,
    };
  });

  const ripple1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ripple1.value, [0, 1], [0.15, 1.3]) }],
    opacity: interpolate(ripple1.value, [0, 0.3, 1], [0.25, 0.12, 0]),
  }));
  const ripple2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ripple2.value, [0, 1], [0.15, 1.3]) }],
    opacity: interpolate(ripple2.value, [0, 0.3, 1], [0.25, 0.12, 0]),
  }));
  const ripple3Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(ripple3.value, [0, 1], [0.15, 1.3]) }],
    opacity: interpolate(ripple3.value, [0, 0.3, 1], [0.25, 0.12, 0]),
  }));

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(lineX.value, [-1, 0, 1], [-40, 0, 40]) }],
  }));

  return (
    <Animated.View style={[styles.cardWrapper, cardStyle]}>
      <View style={[styles.card, styles.buildingCard]}>
        {/* Subtle diagonal gradient */}
        <LinearGradient
          colors={['rgba(212, 175, 55, 0.05)', 'transparent', 'rgba(198, 110, 78, 0.04)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Ripple rings expanding from center */}
        <View style={styles.rippleCenter}>
          <Animated.View style={[styles.rippleRing, ripple1Style]} />
          <Animated.View style={[styles.rippleRing, ripple2Style]} />
          <Animated.View style={[styles.rippleRing, ripple3Style]} />
        </View>

        {/* Content */}
        <View style={styles.buildingContent}>
          {progress ? (
            <Text style={styles.buildingCounter}>{progress}</Text>
          ) : null}
          <Text style={styles.buildingName} numberOfLines={2}>{name}</Text>
          {/* Animated gold line */}
          <View style={styles.buildingLineTrack}>
            <Animated.View style={[styles.buildingLineFill, lineStyle]} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

// ============================================================
// MAIN SCREEN
// ============================================================

export default function RecipeResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    ingredients?: string;
    sourceType?: string;
    mealType?: string;
    difficulty?: string;
    sortBy?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { addRecipe } = useRecipeStore();
  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<FlashcardRecipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewedRecipes, setViewedRecipes] = useState<string[]>([]);
  const [rejectedRecipes, setRejectedRecipes] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [buildingRecipeName, setBuildingRecipeName] = useState<string | null>(null);
  const [totalExpected, setTotalExpected] = useState(0);

  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);
  const generationIdRef = useRef(0);
  const generationStartedAtRef = useRef(0);
  const hasLoggedFirstCardRef = useRef(false);

  const queueRecipeImagesInBackground = useCallback((
    queue: { cardId: string; title: string }[],
    generationId: number
  ) => {
    if (RECIPE_CARD_IMAGE_MODE !== 'background' || queue.length === 0) return;

    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < queue.length) {
        if (generationIdRef.current !== generationId) return;
        const task = queue[nextIndex++];
        try {
          const base64 = await aiService.generateRecipeImage(task.title);
          if (generationIdRef.current !== generationId) return;
          const imageUri = `data:image/png;base64,${base64}`;
          setRecipes((prev) => prev.map((card) => (
            card.id === task.cardId ? { ...card, image: imageUri } : card
          )));
        } catch (error) {
          console.warn(`[RecipeResults] Background image generation failed for "${task.title}"`, error);
        }
      }
    };

    for (let i = 0; i < IMAGE_QUEUE_CONCURRENCY; i++) {
      worker().catch((error) => {
        console.warn('[RecipeResults] Background image worker failed', error);
      });
    }
  }, []);

  const getSelectedMealType = (): MealType => {
    if (params.mealType && params.mealType !== 'any') {
      const mealMap: Record<string, MealType> = {
        breakfast: 'Breakfast',
        lunch: 'Lunch',
        dinner: 'Dinner',
        snack: 'Lunch',
      };
      return mealMap[params.mealType] || 'Dinner';
    }
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'Breakfast';
    if (hour >= 12 && hour < 17) return 'Lunch';
    return 'Dinner';
  };

  const getInitialSortBy = (): 'match' | 'time' | 'difficulty' => {
    if (params.sortBy === 'time') return 'time';
    if (params.sortBy === 'difficulty') return 'difficulty';
    return 'match';
  };

  const [mealType] = useState<MealType>(getSelectedMealType());
  const [sortBy] = useState<'match' | 'time' | 'difficulty'>(getInitialSortBy());
  const isFridgeScanSource = params.sourceType === 'fridge_scan';

  // Computed display data: real cards + optional building placeholder
  const displayData = useMemo(() => {
    if (!buildingRecipeName) return recipes;
    const buildingCard: FlashcardRecipe = {
      id: 'building-card',
      name: buildingRecipeName,
      image: '',
      prepTime: '',
      difficulty: 'Easy',
      matchPercentage: 0,
      isChefChoice: false,
      ingredients: [],
      color: CARD_COLORS[recipes.length % CARD_COLORS.length],
      isBuilding: true,
    };
    return [...recipes, buildingCard];
  }, [recipes, buildingRecipeName]);

  // Active card background color
  const activeColor = displayData[activeIndex]?.color || '#716B64';

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(activeColor, { duration: 800 }),
  }));

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

  // Fetch when ingredients change
  useEffect(() => {
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      fetchRecipeSuggestions(selectedIngredients, false);
    }
  }, [ingredients]);

  const getMealTimeLimit = (meal: string): number => {
    switch (meal.toLowerCase()) {
      case 'breakfast': return 25;
      case 'lunch': return 40;
      case 'dinner': return 60;
      default: return 45;
    }
  };

  const getDifficultyLevel = (): string => {
    if (params.difficulty === 'easy') return 'beginner';
    if (params.difficulty === 'medium') return 'intermediate';
    if (params.difficulty === 'hard') return 'advanced';
    return 'any';
  };

  const fetchRecipeSuggestions = async (ingredientList: Ingredient[], isLoadMore: boolean = false) => {
    // Gate check for free users — only on initial generation, not "load more"
    if (!isLoadMore && !isFridgeScanSource) {
      const allowed = await checkGate('recipe');
      if (!allowed) {
        setIsLoadingRecipes(false);
        setIsLoadingMore(false);
        setBuildingRecipeName(null);
        setTotalExpected(0);
        if (recipes.length === 0) {
          setError('Weekly recipe limit reached. Start your free trial to continue.');
        }
        return;
      }
    }

    const currentGenId = ++generationIdRef.current;
    if (!isLoadMore) {
      generationStartedAtRef.current = Date.now();
      hasLoggedFirstCardRef.current = false;
    }

    try {
      if (isLoadMore) {
        setIsLoadingMore(true);
        setBuildingRecipeName(null);
      } else {
        setIsLoadingRecipes(true);
        setRecipes([]);
        setActiveIndex(0);
        setBuildingRecipeName(INITIAL_BUILDING_PLACEHOLDER);
        // Count recipe usage only for non-fridge flows.
        if (!isFridgeScanSource) {
          firebaseService.incrementUsage('recipe');
        }
      }
      setError(null);
      setTotalExpected(0);

      const ingredientNames = ingredientList.map((i) => i.name);
      const currentMealType = mealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';

      const userPreferences = {
        dietary_restrictions: user?.dietary_restrictions || [],
        cooking_style: user?.cooking_style || 'any',
        max_time_minutes: getMealTimeLimit(currentMealType),
        meal_type: currentMealType,
        difficulty_level: getDifficultyLevel(),
        default_servings: 2,
        recipe_count: isLoadMore ? 4 : INITIAL_RECIPE_COUNT,
        recently_viewed_recipes: viewedRecipes,
        recently_rejected_recipes: rejectedRecipes,
        style_preferences: params.sortBy === 'time' ? ['quick', 'easy'] :
                          params.sortBy === 'calories' ? ['healthy', 'light'] : [],
      };

      const suggestionsStartedAt = Date.now();
      const suggestions = await aiService.suggestRecipesFromIngredients(
        ingredientNames,
        userPreferences
      );
      console.log(
        `[Perf][RecipeResults] Suggestions ready in ${Date.now() - suggestionsStartedAt}ms for ${suggestions.length} recipes`
      );

      if (generationIdRef.current !== currentGenId) return;

      const sorted = suggestions.sort((a, b) => {
        if (sortBy === 'time') return a.total_time_minutes - b.total_time_minutes;
        if (sortBy === 'difficulty') {
          const order = { beginner: 1, intermediate: 2, advanced: 3 };
          return (order[a.difficulty] || 2) - (order[b.difficulty] || 2);
        }
        return (b.match_score ?? 0) - (a.match_score ?? 0);
      });

      // Switch from loading screen to progressive card generation
      setIsLoadingRecipes(false);
      setIsLoadingMore(false);
      setTotalExpected(sorted.length);

      if (!isLoadMore) {
        setActiveIndex(0);
      }

      const startIndex = isLoadMore ? recipes.length : 0;
      if (RECIPE_CARD_IMAGE_MODE === 'blocking') {
        setTotalExpected(sorted.length);

        const blockingCards: FlashcardRecipe[] = [];
        for (let i = 0; i < sorted.length; i++) {
          if (generationIdRef.current !== currentGenId) return;

          setBuildingRecipeName(sorted[i].title);
          const card = mapSuggestedRecipeToFlashcard(sorted[i], startIndex + i);

          try {
            const base64 = await aiService.generateRecipeImage(sorted[i].title);
            card.image = `data:image/png;base64,${base64}`;
          } catch {
            card.image = '';
          }

          if (generationIdRef.current !== currentGenId) return;

          blockingCards.push(card);
          if (isLoadMore) {
            setRecipes((prev) => [...prev, card]);
          } else {
            setRecipes([...blockingCards]);
          }
          setViewedRecipes((prev) => [...prev, card.name].slice(-20));
        }

        setBuildingRecipeName(null);
        setTotalExpected(0);
        return;
      }

      const cards = sorted.map((suggestion, i) => (
        mapSuggestedRecipeToFlashcard(suggestion, startIndex + i)
      ));

      if (generationIdRef.current !== currentGenId) return;

      setRecipes((prev) => (isLoadMore ? [...prev, ...cards] : cards));
      setViewedRecipes((prev) => [...prev, ...cards.map((card) => card.name)].slice(-20));
      setBuildingRecipeName(null);
      setTotalExpected(0);
      console.log(`[Perf][RecipeResults] Seeded ${cards.length} cards instantly`);

      queueRecipeImagesInBackground(
        cards.map((card) => ({ cardId: card.id, title: card.name })),
        currentGenId
      );
    } catch (err) {
      if (generationIdRef.current !== currentGenId) return;
      console.error('Failed to fetch recipe suggestions:', err);
      setError('Failed to find recipes. Please try again.');
      setIsLoadingRecipes(false);
      setIsLoadingMore(false);
      setBuildingRecipeName(null);
      setTotalExpected(0);
    }
  };

  const handleGenerateMore = useCallback(() => {
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      fetchRecipeSuggestions(selectedIngredients, true);
    }
  }, [ingredients, mealType, viewedRecipes]);

  const handleCardPress = useCallback((recipe: FlashcardRecipe) => {
    if (recipe.isBuilding) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Recipe detail expands on-demand if full details are not preloaded.
    const recipeData = recipe.expandedRecipe || recipe.originalRecipe;
    if (recipeData) {
      const imageKey = storeImage(recipe.image);
      const recipeKey = storeData(recipeData);
      router.push({
        pathname: '/suggested-recipe-detail',
        params: {
          recipeKey,
          imageUrl: imageKey,
          sourceType: params.sourceType || 'ai_chef',
        },
      });
    }
  }, [router, params.sourceType]);

  const handleFavoritePress = async (recipe: FlashcardRecipe) => {
    if (!recipe.originalRecipe) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Use already-expanded recipe if available, otherwise expand now
      const fullRecipe = recipe.expandedRecipe || await aiService.expandRecipeFromSuggestion(recipe.originalRecipe);
      await addRecipe(fullRecipe, undefined, recipe.image || undefined, (params.sourceType || 'ai_chef') as any);
      Alert.alert('Saved!', `${recipe.name} added to your collection`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save recipe');
    }
  };

  const handleRetry = useCallback(() => {
    const selectedIngredients = ingredients.filter((i) => i.selected);
    if (selectedIngredients.length > 0) {
      setViewedRecipes([]);
      setRejectedRecipes([]);
      fetchRecipeSuggestions(selectedIngredients, false);
    }
  }, [ingredients]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    scrollX.value = x;
    const newIndex = Math.round(x / (CARD_WIDTH + CARD_GAP));
    if (newIndex >= 0 && newIndex < displayData.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [displayData.length, activeIndex]);

  useEffect(() => {
    if (recipes.length === 0 || hasLoggedFirstCardRef.current || generationStartedAtRef.current === 0) {
      return;
    }
    hasLoggedFirstCardRef.current = true;
    console.log(`[Perf][RecipeResults] First card visible in ${Date.now() - generationStartedAtRef.current}ms`);
  }, [recipes.length]);

  // Auto-scroll to building card as new recipes appear
  useEffect(() => {
    if (buildingRecipeName && displayData.length > 0 && flatListRef.current) {
      const buildingIndex = displayData.length - 1;
      // Only auto-scroll if user is near the end (not scrolled back)
      if (activeIndex >= buildingIndex - 1) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: buildingIndex * (CARD_WIDTH + CARD_GAP),
            animated: true,
          });
        }, 350);
      }
    }
  }, [displayData.length]);

  const progressText = totalExpected > 0
    ? `${recipes.length + 1} of ${totalExpected}`
    : '';

  const renderCard = ({ item, index }: { item: FlashcardRecipe; index: number }) => {
    if (item.isBuilding) {
      return (
        <BuildingCard
          name={item.name}
          index={index}
          scrollX={scrollX}
          progress={progressText}
        />
      );
    }
    return (
      <RecipeCard
        recipe={item}
        index={index}
        scrollX={scrollX}
        onPress={handleCardPress}
        onFavorite={handleFavoritePress}
      />
    );
  };

  return (
    <Animated.View style={[styles.container, bgStyle]}>
      <StatusBar barStyle="light-content" />

      {/* Soft ambient light */}
      <View style={styles.ambientLight} />

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(600)}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel}>
            {mealType.toUpperCase()}
          </Text>
          <Text style={styles.headerTitle}>Curated for You</Text>
        </View>

        <Pressable
          onPress={handleGenerateMore}
          style={[styles.headerBtn, !!buildingRecipeName && { opacity: 0.4 }]}
          hitSlop={12}
          disabled={!!buildingRecipeName || isLoadingMore}
        >
          {(isLoadingMore || buildingRecipeName) ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="refresh-outline" size={22} color="#FFF" />
          )}
        </Pressable>
      </Animated.View>

      {/* Subtitle */}
      <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.subtitleWrap}>
        <Text style={styles.subtitle}>
          {isLoadingRecipes && recipes.length === 0
            ? 'Preparing your recipe cards...'
            : buildingRecipeName && totalExpected > 0
            ? `${recipes.length + 1} / ${totalExpected}`
            : `${recipes.length} recipes crafted from your ingredients`
          }
        </Text>
        {(isLoadingRecipes || !!buildingRecipeName || isLoadingMore) && (
          <Text style={styles.subtitleHint}>
            Keep this tab open while we prepare your recipes.
          </Text>
        )}
      </Animated.View>

      {/* Carousel */}
      <View style={styles.carouselContainer}>
        {error ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={handleRetry}
            >
              <Ionicons name="refresh" size={16} color={C.charcoal} />
              <Text style={styles.retryBtnText}>Try Again</Text>
            </Pressable>
          </View>
        ) : isLoadingRecipes && displayData.length === 0 ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.loadingInlineText}>Preparing recipes...</Text>
          </View>
        ) : displayData.length === 0 ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No recipes found</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayData}
            renderItem={renderCard}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{
              paddingHorizontal: SIDE_PADDING,
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + CARD_GAP,
              offset: (CARD_WIDTH + CARD_GAP) * index,
              index,
            })}
          />
        )}
      </View>

      {/* Dot Indicators */}
      {displayData.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(500).delay(400)}
          style={[styles.dotsContainer, { bottom: insets.bottom + 80 }]}
        >
          {displayData.map((item, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                activeIndex === i ? styles.dotActive : styles.dotInactive,
                item.isBuilding && styles.dotBuilding,
              ]}
            />
          ))}
        </Animated.View>
      )}

      {/* Bottom Action */}
      {displayData.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(500).delay(500)}
          style={[styles.bottomAction, { paddingBottom: insets.bottom + 16 }]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.viewRecipeBtn,
              pressed && !displayData[activeIndex]?.isBuilding && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              displayData[activeIndex]?.isBuilding && { opacity: 0.5 },
            ]}
            onPress={() => {
              const active = displayData[activeIndex];
              if (active && !active.isBuilding) handleCardPress(active);
            }}
            disabled={displayData[activeIndex]?.isBuilding}
          >
            <Text style={styles.viewRecipeBtnText}>
              {displayData[activeIndex]?.isBuilding ? 'Crafting...' : 'View Full Recipe'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={C.charcoal} />
          </Pressable>
        </Animated.View>
      )}

      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />
    </Animated.View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ambientLight: {
    position: 'absolute',
    top: '-25%',
    left: '-20%',
    width: '150%',
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  headerLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 4,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // Subtitle
  subtitleWrap: {
    paddingHorizontal: 40,
    paddingTop: 12,
    paddingBottom: 20,
    alignItems: 'center',
  },
  subtitle: {
    fontFamily: 'NotoSans_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  subtitleHint: {
    marginTop: 4,
    fontFamily: 'NotoSans_400Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.33)',
    textAlign: 'center',
  },

  // Carousel
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingInline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingInlineText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  // Card
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: CARD_GAP,
  },
  card: {
    flex: 1,
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#2A2520',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 20,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  cardImageFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // Card top row
  cardTopRow: {
    position: 'absolute',
    top: 20,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    backdropFilter: 'blur(10)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  matchBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  favBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  favBtnActive: {
    backgroundColor: C.terracotta,
    borderColor: C.terracotta,
  },

  // Card bottom
  cardBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    paddingBottom: 28,
  },
  chefBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    marginBottom: 10,
  },
  chefBadgeText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: C.gold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#FFF',
    lineHeight: 28,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaChipText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tapHintIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapHintText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Dots
  dotsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 28,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Bottom Action
  bottomAction: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  viewRecipeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 16,
    paddingHorizontal: 36,
    borderRadius: 28,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  viewRecipeBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1A1510',
    letterSpacing: 0.3,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  retryBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1A1510',
  },

  // Building card — simmering ripple
  buildingCard: {
    backgroundColor: '#1E1A16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleCenter: {
    position: 'absolute',
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  buildingContent: {
    alignItems: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  buildingCounter: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1,
  },
  buildingName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
  },
  buildingLineTrack: {
    width: 56,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 4,
  },
  buildingLineFill: {
    width: 28,
    height: '100%',
    borderRadius: 1,
    backgroundColor: C.gold,
    opacity: 0.5,
    alignSelf: 'center',
  },
  dotBuilding: {
    width: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.5)',
  },
});
