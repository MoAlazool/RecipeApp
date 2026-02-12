import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/stores/recipeStore';
import { aiService } from '@/services/ai.service';
import { getIngredientEmoji } from '@/utils/ingredientEmojis';
import { getIngredientImage } from '@/utils/ingredientImages';
import type { SuggestedRecipe, ExtractedRecipe, Ingredient } from '@/utils/types';
import { StepList } from '@/components/recipe/StepList';
import { getImage, getData } from '@/utils/imageCache';

// ============================================================
// DESIGN TOKENS — Michelin-Star Luxury
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
  olive: '#6B8E23',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 380;
const NAV_HEIGHT = 48;
const CARD_HORIZONTAL_PADDING = 24;
const CARD_GAP = 10;
const NUM_COLUMNS = 4;
const CARD_SIZE = (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const COLLAPSED_HEIGHT = 220;
// Use Animated.View wrapper instead of AnimatedExpoImage — much lighter for parallax

// Module-level cache for expanded recipes — persists across navigations
const expandedRecipeCache = new Map<string, ExtractedRecipe>();

// ============================================================
// HELPERS
// ============================================================

const getDifficultyLabel = (d: string) => {
  switch (d) {
    case 'beginner': return 'Easy';
    case 'intermediate': return 'Medium';
    case 'advanced': return 'Hard';
    default: return d;
  }
};

const formatAmount = (amount?: number | string): string => {
  if (!amount) return '';
  const s = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(s)) return String(amount);
  if (s === Math.floor(s)) return s.toString();
  if (Math.abs(s - 0.25) < 0.01) return '\u00BC';
  if (Math.abs(s - 0.33) < 0.01) return '\u2153';
  if (Math.abs(s - 0.5) < 0.01) return '\u00BD';
  if (Math.abs(s - 0.67) < 0.01) return '\u2154';
  if (Math.abs(s - 0.75) < 0.01) return '\u00BE';
  return s.toFixed(1).replace(/\.0$/, '');
};

const MEASUREMENT_OR_NOISE_TOKENS = new Set([
  'a', 'an', 'and', 'or', 'of', 'to', 'for', 'with', 'without',
  'cup', 'cups', 'tbsp', 'tsp', 'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons',
  'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'g', 'kg', 'mg', 'ml', 'l', 'liter', 'liters',
  'piece', 'pieces', 'clove', 'cloves', 'slice', 'slices',
  'bunch', 'bunches', 'can', 'cans', 'package', 'packages',
  'fresh', 'chopped', 'diced', 'minced', 'sliced', 'large', 'small', 'medium',
  'optional', 'plus', 'more', 'less', 'some', 'few',
]);

const stripIngredientText = (value: string): string => (
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const normalizeIngredientToken = (token: string): string => {
  let value = token;
  if (value.endsWith('es') && value.length > 4 && !value.endsWith('ses')) {
    value = value.slice(0, -2);
  } else if (value.endsWith('s') && value.length > 3 && !value.endsWith('ss')) {
    value = value.slice(0, -1);
  }
  return value;
};

const tokenizeIngredientName = (value: string): string[] => (
  stripIngredientText(value)
    .split(' ')
    .map(normalizeIngredientToken)
    .filter((token) => token.length > 1 && !MEASUREMENT_OR_NOISE_TOKENS.has(token))
);

const isIngredientLikelyInStock = (
  ingredientName: string,
  inStockRawNames: string[]
): boolean => {
  const candidateTokens = tokenizeIngredientName(ingredientName);
  if (candidateTokens.length === 0) return false;

  const candidateNormalized = candidateTokens.join(' ');
  const candidateSet = new Set(candidateTokens);

  return inStockRawNames.some((stockName) => {
    const stockTokens = tokenizeIngredientName(stockName);
    if (stockTokens.length === 0) return false;

    const stockNormalized = stockTokens.join(' ');
    if (!stockNormalized || !candidateNormalized) return false;

    // Exact normalized match
    if (candidateNormalized === stockNormalized) return true;

    // Substring match (e.g. "all purpose flour" vs "flour")
    if (
      (candidateNormalized.length >= 3 && stockNormalized.includes(candidateNormalized)) ||
      (stockNormalized.length >= 3 && candidateNormalized.includes(stockNormalized))
    ) {
      return true;
    }

    // Token overlap match
    const sharedCount = stockTokens.filter((token) => candidateSet.has(token)).length;
    if (sharedCount === 0) return false;

    const minTokenCount = Math.min(candidateTokens.length, stockTokens.length);
    if (minTokenCount <= 1) return sharedCount >= 1;
    if (sharedCount >= 2) return true;

    return sharedCount / minTokenCount >= 0.6;
  });
};

const getRecipeCacheKey = (title?: string): string => (title || '').toLowerCase().trim();

const buildQuickRecipeFromSuggestion = (recipe: SuggestedRecipe): ExtractedRecipe => {
  const ingredientNames = Array.from(new Set(
    [...(recipe.ingredients_you_have || []), ...(recipe.ingredients_you_need || [])]
      .map((name) => (name || '').trim())
      .filter(Boolean)
  ));

  return {
    title: recipe.title,
    description: recipe.description || '',
    cuisine_type: recipe.cuisine_type,
    difficulty: recipe.difficulty || 'beginner',
    total_time_minutes: recipe.total_time_minutes || 0,
    active_time_minutes: recipe.total_time_minutes || 0,
    servings: recipe.servings || 2,
    ingredients: ingredientNames.map((name) => ({ name, category: 'other' })),
    steps: (recipe.preview_steps || []).map((instruction, index) => ({
      step_number: index + 1,
      instruction,
    })),
    nutrition_estimate: recipe.calories_per_serving != null
      ? { calories: recipe.calories_per_serving }
      : undefined,
  };
};

// ============================================================
// INGREDIENT CARD
// ============================================================

interface IngredientCardProps {
  name: string;
  amount: string;
  unit: string;
  isInStock: boolean;
}

const IngredientCard = React.memo(function IngredientCard({
  name,
  amount,
  unit,
  isInStock,
}: IngredientCardProps) {
  const ingredientImage = getIngredientImage(name);
  const emoji = getIngredientEmoji(name);
  const amountDisplay = [amount, unit].filter(Boolean).join(' ');

  return (
    <View style={styles.ingredientCard}>
      <View
        style={[
          styles.ingredientImageArea,
          ingredientImage
            ? { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 }
            : { backgroundColor: '#F5F3EE' },
        ]}
      >
        {ingredientImage ? (
          <ExpoImage
            source={ingredientImage}
            style={styles.ingredientPhoto}
            contentFit="cover"
            recyclingKey={name}
          />
        ) : (
          <Text style={styles.ingredientEmoji}>{emoji}</Text>
        )}
        <View style={[styles.ingredientNotch, isInStock ? styles.ingredientNotchHave : styles.ingredientNotchNeed]}>
          <Ionicons name={isInStock ? 'checkmark' : 'cart'} size={12} color="#FFF" />
        </View>
      </View>
      <Text style={styles.ingredientName} numberOfLines={2}>{name}</Text>
      {amountDisplay ? <Text style={styles.ingredientAmount}>{amountDisplay}</Text> : null}
    </View>
  );
});

// ============================================================
// MAIN SCREEN
// ============================================================

export default function SuggestedRecipeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipe?: string;
    recipeKey?: string;
    sourceUrl?: string;
    imageUrl?: string;
    sourceType?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { addRecipe } = useRecipeStore();

  // Resolve image from cache (avoids megabytes of base64 in URL params)
  const resolvedImageUrl = useMemo(() => getImage(params.imageUrl || ''), [params.imageUrl]);

  const [suggestedRecipe, setSuggestedRecipe] = useState<SuggestedRecipe | null>(null);
  const [fullRecipe, setFullRecipe] = useState<ExtractedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpandingDetails, setIsExpandingDetails] = useState(false);
  const [isExpandedReady, setIsExpandedReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSequenceRef = useRef(0);
  const expansionPromiseRef = useRef<Promise<ExtractedRecipe> | null>(null);

  // --- Parallax scroll (all UI-thread, no JS re-renders) ---
  const STICKY_THRESHOLD = HERO_HEIGHT - NAV_HEIGHT - insets.top;
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const heroImageAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollY.value, [-300, 0], [1.4, 1.1], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [-300, 0, 600], [-120, 0, 240], Extrapolation.CLAMP) },
    ],
  }));

  // Sticky header fades in, floating buttons fade out — pure UI thread
  const stickyHeaderAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [STICKY_THRESHOLD - 40, STICKY_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const floatingBtnsAnim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [STICKY_THRESHOLD - 40, STICKY_THRESHOLD], [1, 0], Extrapolation.CLAMP),
  }));

  // --- Expandable ingredient grid ---
  const ingredientExpandProgress = useSharedValue(0);
  const fullGridHeight = useSharedValue(600);

  const onGridLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    if (h > COLLAPSED_HEIGHT) fullGridHeight.value = h;
  }, []);

  const ingredientGridAnimStyle = useAnimatedStyle(() => {
    const total = Math.max(fullGridHeight.value, COLLAPSED_HEIGHT + 1);
    const h = COLLAPSED_HEIGHT + ingredientExpandProgress.value * (total - COLLAPSED_HEIGHT);
    return { height: h, overflow: 'hidden' as const };
  });

  const fadeAnimStyle = useAnimatedStyle(() => ({
    opacity: 1 - ingredientExpandProgress.value,
  }));

  const showLessAnimStyle = useAnimatedStyle(() => ({
    opacity: ingredientExpandProgress.value,
  }));

  const handleToggleExpand = useCallback(() => {
    const expanding = ingredientExpandProgress.value < 0.5;
    ingredientExpandProgress.value = withTiming(expanding ? 1 : 0, {
      duration: 400,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, []);

  // --- Data loading ---
  useEffect(() => {
    loadRecipeDetails();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, []);

  const getExpandedRecipe = useCallback(async (parsed: SuggestedRecipe): Promise<ExtractedRecipe> => {
    const cacheKey = getRecipeCacheKey(parsed.title);
    if (cacheKey && expandedRecipeCache.has(cacheKey)) {
      return expandedRecipeCache.get(cacheKey)!;
    }

    if (!expansionPromiseRef.current) {
      expansionPromiseRef.current = aiService.expandRecipeFromSuggestion(parsed)
        .then((fullRecipeData) => {
          if (cacheKey) expandedRecipeCache.set(cacheKey, fullRecipeData);
          return fullRecipeData;
        })
        .finally(() => {
          expansionPromiseRef.current = null;
        });
    }

    return expansionPromiseRef.current;
  }, []);

  const loadRecipeDetails = async () => {
    const loadId = ++loadSequenceRef.current;
    try {
      setIsLoading(true);
      setError(null);
      setIsExpandedReady(false);
      setIsExpandingDetails(false);

      // Support both cache key (fast) and legacy JSON param
      let parsed: any;
      if (params.recipeKey) {
        parsed = getData(params.recipeKey);
        if (!parsed) throw new Error('Recipe data expired');
      } else if (params.recipe) {
        parsed = JSON.parse(params.recipe);
      } else {
        throw new Error('No recipe data provided');
      }

      if (loadSequenceRef.current !== loadId) return;

      setSuggestedRecipe(parsed);

      if (parsed.ingredients?.length && parsed.steps?.length) {
        setFullRecipe(parsed as ExtractedRecipe);
        setIsExpandedReady(true);
        return;
      }

      const quickRecipe = buildQuickRecipeFromSuggestion(parsed as SuggestedRecipe);
      setFullRecipe(quickRecipe);
      setIsLoading(false);
      setIsExpandingDetails(true);

      try {
        const fullRecipeData = await getExpandedRecipe(parsed as SuggestedRecipe);
        if (loadSequenceRef.current !== loadId) return;
        setFullRecipe(fullRecipeData);
        setIsExpandedReady(true);
      } catch (expandErr) {
        console.warn('Failed to expand recipe details in background:', expandErr);
      } finally {
        if (loadSequenceRef.current !== loadId) return;
        setIsExpandingDetails(false);
      }
    } catch (err: any) {
      if (loadSequenceRef.current !== loadId) return;
      console.error('Failed to load recipe details:', err);
      setError(err.message || 'Failed to load recipe details');
    } finally {
      if (loadSequenceRef.current !== loadId) return;
      setIsLoading(false);
    }
  };

  // --- Handlers ---
  const handleSaveToFavorites = useCallback(async () => {
    if (!fullRecipe || !suggestedRecipe || isSaving || isSaved) return;
    let didExpandInline = false;
    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let recipeToSave = fullRecipe;
      if (!isExpandedReady) {
        didExpandInline = true;
        setIsExpandingDetails(true);
        recipeToSave = await getExpandedRecipe(suggestedRecipe);
        setFullRecipe(recipeToSave);
        setIsExpandedReady(true);
      }

      await addRecipe(recipeToSave, params.sourceUrl, resolvedImageUrl, params.sourceType as any);
      setIsSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', 'Recipe added to your collection', [
        { text: 'View Collection', onPress: () => { router.dismissAll(); router.replace('/(tabs)'); } },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save recipe');
    } finally {
      if (didExpandInline) {
        setIsExpandingDetails(false);
      }
      setIsSaving(false);
    }
  }, [
    fullRecipe,
    suggestedRecipe,
    isSaving,
    isSaved,
    isExpandedReady,
    params,
    addRecipe,
    router,
    resolvedImageUrl,
    getExpandedRecipe,
  ]);

  const handleCookNow = useCallback(() => {
    Alert.alert('Cook This Recipe?', 'Save this recipe to your collection to start cooking mode', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save & Cook', onPress: handleSaveToFavorites },
    ]);
  }, [handleSaveToFavorites]);

  // --- Memoized computed values (must be before early returns to obey Rules of Hooks) ---
  const suggestionIngredientNames = useMemo(() => {
    if (!suggestedRecipe) return [];
    return Array.from(new Set(
      [...(suggestedRecipe.ingredients_you_have || []), ...(suggestedRecipe.ingredients_you_need || [])]
        .map((name) => (name || '').trim())
        .filter(Boolean)
    ));
  }, [suggestedRecipe]);

  const fullIngredientEntries = useMemo(() => {
    if (!fullRecipe) return [] as { name: string; amount?: number | string; unit?: string }[];
    return fullRecipe.ingredients.map((ingredient) => {
      const rawIngredient = ingredient as any;
      if (typeof rawIngredient === 'string') {
        return { name: rawIngredient.trim() };
      }
      return {
        name: (rawIngredient.name || '').trim(),
        amount: rawIngredient.amount as number | string | undefined,
        unit: rawIngredient.unit || '',
      };
    }).filter((item) => !!item.name);
  }, [fullRecipe]);

  const processedIngredients = useMemo(() => {
    if (!suggestedRecipe) return [];
    const inStock = suggestedRecipe.ingredients_you_have || [];

    // Keep ingredient availability UI stable using suggestion ingredient list.
    // This avoids badge/card counts jumping when expanded recipe details load later.
    const baseNames = suggestionIngredientNames.length > 0
      ? suggestionIngredientNames
      : fullIngredientEntries.map((item) => item.name);

    return baseNames.map((name) => {
      const matchedEntry = fullIngredientEntries.find((item) =>
        isIngredientLikelyInStock(name, [item.name]) || isIngredientLikelyInStock(item.name, [name])
      );
      const amount = matchedEntry?.amount != null ? formatAmount(matchedEntry.amount) : '';
      const unit = matchedEntry?.unit || '';
      const isInStock = name ? isIngredientLikelyInStock(name, inStock) : false;
      return { name, amount, unit, isInStock };
    });
  }, [suggestedRecipe, suggestionIngredientNames, fullIngredientEntries]);

  const totalIngredients = processedIngredients.length;
  const inStockCount = useMemo(() => processedIngredients.filter((i) => i.isInStock).length, [processedIngredients]);
  const missingCount = Math.max(0, totalIngredients - inStockCount);
  const needsExpandable = totalIngredients > NUM_COLUMNS * 2;
  // Convert ingredients to Ingredient[] for StepList (handles string | object)
  const ingredientsForSteps = useMemo((): Ingredient[] => {
    if (!fullRecipe) return [];
    return fullRecipe.ingredients.map((ing) => {
      if (typeof ing === 'string') return { name: ing, category: 'other' } as Ingredient;
      const obj = ing as any;
      return { category: 'other', ...obj } as Ingredient;
    });
  }, [fullRecipe]);
  const hasNutrition = useMemo(() => !!(
    fullRecipe?.nutrition_estimate && (
      fullRecipe.nutrition_estimate.calories != null ||
      fullRecipe.nutrition_estimate.protein_g != null ||
      fullRecipe.nutrition_estimate.carbs_g != null ||
      fullRecipe.nutrition_estimate.fat_g != null
    )
  ), [fullRecipe]);

  // --- Loading state ---
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="restaurant" size={48} color={C.gold} />
        <Text style={styles.loadingText}>Preparing your recipe...</Text>
      </View>
    );
  }

  // --- Error state ---
  if (error || !fullRecipe || !suggestedRecipe) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={48} color={C.terracotta} />
        </View>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>{error || 'Failed to load recipe'}</Text>
        <Pressable
          style={({ pressed }) => [styles.errorBtn, pressed && { transform: [{ scale: 0.97 }] }]}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Sticky Header — always mounted, animated opacity (no JS re-renders) */}
      <Animated.View style={[styles.stickyHeader, stickyHeaderAnim, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.stickyHeaderInner}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={C.charcoal} />
          </TouchableOpacity>
          <Text style={styles.stickyTitle} numberOfLines={1}>{fullRecipe.title}</Text>
          <TouchableOpacity onPress={handleSaveToFavorites} hitSlop={8} disabled={isSaved}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={22} color={isSaved ? C.terracotta : C.charcoal} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Floating hero buttons — always mounted, fade out on scroll */}
      <Animated.View style={[styles.floatingBtnsWrap, floatingBtnsAnim]} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.heroBtn, styles.heroBtnBack, { top: insets.top + 10 }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={20} color="#FFF" />
          <Text style={styles.heroBtnBackText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.heroBtn, styles.heroBtnRight, { top: insets.top + 10 }]}
          onPress={handleSaveToFavorites}
          activeOpacity={0.85}
          disabled={isSaved || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? C.terracotta : '#FFF'} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Scroll Content */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Image — animate the wrapper View, not ExpoImage itself */}
        <View style={styles.heroWrap}>
          <Animated.View style={[styles.heroImageWrap, heroImageAnim]}>
            <ExpoImage
              source={{ uri: resolvedImageUrl || 'https://via.placeholder.com/800x600' }}
              style={styles.heroImage}
              contentFit="cover"
            />
          </Animated.View>
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={styles.heroGradTop} pointerEvents="none" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.heroGradBottom} pointerEvents="none" />
        </View>

        {/* Content Card */}
        <View style={styles.card}>
          <View style={styles.sheetHandle} />

          {/* Title */}
          <Text style={styles.title}>{fullRecipe.title}</Text>

          {/* Description */}
          {fullRecipe.description && (
            <Text style={styles.description}>{fullRecipe.description}</Text>
          )}

          {/* Match + Source badges */}
          <View style={styles.badgeRow}>
            {suggestedRecipe.match_score != null && (
              <View style={styles.matchBadge}>
                <Ionicons name="leaf" size={13} color={C.olive} />
                <Text style={styles.matchBadgeText}>{suggestedRecipe.match_score}% match</Text>
              </View>
            )}
            <View style={styles.timeBadge}>
              <Ionicons name="time-outline" size={13} color={C.muted} />
              <Text style={styles.timeBadgeText}>{fullRecipe.total_time_minutes} min</Text>
            </View>
            <View style={styles.timeBadge}>
              <Ionicons name="bar-chart-outline" size={13} color={C.muted} />
              <Text style={styles.timeBadgeText}>{getDifficultyLabel(fullRecipe.difficulty)}</Text>
            </View>
          </View>

          {isExpandingDetails && !isExpandedReady && (
            <View style={styles.detailLoadingHint}>
              <ActivityIndicator size="small" color={C.gold} />
              <Text style={styles.detailLoadingHintText}>
                Loading full steps and measurements...
              </Text>
            </View>
          )}

          {/* Gold hairline */}
          <View style={styles.goldHairline} />

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>SKILL LEVEL</Text>
              <Text style={styles.statValue}>{getDifficultyLabel(fullRecipe.difficulty)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>COOK TIME</Text>
              <Text style={styles.statValue}>
                {(() => {
                  const t = fullRecipe.total_time_minutes || 0;
                  if (t < 60) return `${t}m`;
                  const h = Math.round(t / 60 * 2) / 2;
                  return h % 1 ? `${Math.floor(h)}½hr` : `${h}hr`;
                })()}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>INGREDIENTS</Text>
              <Text style={styles.statValue}>{totalIngredients}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>SERVINGS</Text>
              <Text style={styles.statValue}>{fullRecipe.servings}</Text>
            </View>
          </View>

          <View style={styles.goldHairline} />

          {/* ── INGREDIENTS ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHeading}>Ingredients</Text>
            <View style={styles.pantryBadge}>
              <Ionicons name="checkmark-circle" size={14} color={C.olive} />
              <Text style={styles.pantryBadgeText}>{inStockCount} available</Text>
              <Text style={styles.pantryBadgeSeparator}>•</Text>
              <Ionicons name="cart-outline" size={14} color={C.terracotta} />
              <Text style={styles.pantryNeedText}>{missingCount} needed</Text>
            </View>
          </View>

          {needsExpandable ? (
            <View>
              <Animated.View style={ingredientGridAnimStyle}>
                <View style={styles.ingredientGrid} onLayout={onGridLayout}>
                  {processedIngredients.map((ing, i) => (
                    <IngredientCard
                      key={i}
                      name={ing.name}
                      amount={ing.amount}
                      unit={ing.unit}
                      isInStock={ing.isInStock}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* Gradient fade + View All */}
              <Animated.View style={[styles.ingredientFadeWrap, fadeAnimStyle]} pointerEvents="box-none">
                <Pressable
                  style={({ pressed }) => [StyleSheet.absoluteFillObject, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 8 }, pressed && { opacity: 0.85 }]}
                  onPress={handleToggleExpand}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.6)', C.ivory]}
                    style={styles.ingredientFade}
                    pointerEvents="none"
                  />
                  <View style={styles.viewAllBtn}>
                    <Text style={styles.viewAllText}>View all {totalIngredients}</Text>
                    <Ionicons name="chevron-down" size={16} color={C.muted} />
                  </View>
                </Pressable>
              </Animated.View>

              {/* Show less */}
              <Animated.View style={showLessAnimStyle} pointerEvents="box-none">
                <Pressable
                  style={({ pressed }) => [styles.viewAllBtn, { marginTop: 12 }, pressed && { opacity: 0.7 }]}
                  onPress={handleToggleExpand}
                >
                  <Text style={styles.viewAllText}>Show less</Text>
                  <Ionicons name="chevron-up" size={16} color={C.muted} />
                </Pressable>
              </Animated.View>
            </View>
          ) : (
            <View style={styles.ingredientGrid}>
              {processedIngredients.map((ing, i) => (
                <IngredientCard
                  key={i}
                  name={ing.name}
                  amount={ing.amount}
                  unit={ing.unit}
                  isInStock={ing.isInStock}
                />
              ))}
            </View>
          )}

          {/* ── COOKING STEPS ── */}
          <Text style={[styles.sectionHeading, { marginTop: 40, marginBottom: 18 }]}>Cooking Steps</Text>
          {fullRecipe.steps.length > 0 ? (
            <StepList steps={fullRecipe.steps} ingredients={ingredientsForSteps} />
          ) : (
            <View style={styles.pendingStepsWrap}>
              <ActivityIndicator size="small" color={C.gold} />
              <Text style={styles.pendingStepsText}>Preparing full cooking steps...</Text>
            </View>
          )}

          {/* ── NUTRITION ── */}
          {hasNutrition && (
            <>
              <Text style={[styles.sectionHeading, { marginTop: 40, marginBottom: 18 }]}>Nutrition Profile</Text>
              <View style={styles.nutritionGrid}>
                {fullRecipe.nutrition_estimate!.calories != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(198, 110, 78, 0.06)' }]}>
                    <Ionicons name="flame" size={20} color={C.terracotta} />
                    <Text style={[styles.nutritionVal, { color: C.terracotta }]}>{fullRecipe.nutrition_estimate!.calories}</Text>
                    <Text style={styles.nutritionLbl}>Calories</Text>
                  </View>
                )}
                {fullRecipe.nutrition_estimate!.protein_g != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(212, 175, 55, 0.06)' }]}>
                    <Ionicons name="barbell" size={20} color={C.gold} />
                    <Text style={[styles.nutritionVal, { color: C.gold }]}>{fullRecipe.nutrition_estimate!.protein_g}g</Text>
                    <Text style={styles.nutritionLbl}>Protein</Text>
                  </View>
                )}
                {fullRecipe.nutrition_estimate!.carbs_g != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(138, 133, 120, 0.06)' }]}>
                    <Ionicons name="nutrition" size={20} color={C.muted} />
                    <Text style={[styles.nutritionVal, { color: C.muted }]}>{fullRecipe.nutrition_estimate!.carbs_g}g</Text>
                    <Text style={styles.nutritionLbl}>Carbs</Text>
                  </View>
                )}
                {fullRecipe.nutrition_estimate!.fat_g != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(26, 21, 16, 0.04)' }]}>
                    <Ionicons name="water" size={20} color={C.charcoal} />
                    <Text style={[styles.nutritionVal, { color: C.charcoal }]}>{fullRecipe.nutrition_estimate!.fat_g}g</Text>
                    <Text style={styles.nutritionLbl}>Fat</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={{ height: 140 }} />
        </View>
      </Animated.ScrollView>

      {/* ── FLOATING DOCK ── */}
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={styles.dockBg} />
        <View style={styles.dockHairline} />
        <View style={styles.dockInner}>
          <Pressable
            style={({ pressed }) => [
              styles.dockSecondaryBtn,
              isSaved && styles.dockSavedBtn,
              pressed && !isSaved && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={handleSaveToFavorites}
            disabled={isSaving || isSaved}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={C.charcoal} />
            ) : (
              <>
                <Ionicons name={isSaved ? 'checkmark-circle' : 'heart-outline'} size={18} color={isSaved ? C.gold : C.charcoal} />
                <Text style={[styles.dockSecondaryText, isSaved && { color: C.gold }]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.dockPrimaryBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={handleCookNow}
          >
            <Text style={styles.dockPrimaryText}>COOK NOW!</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.ivory },
  scrollContent: { paddingBottom: 0 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.ivory, gap: 16 },
  loadingText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: C.muted },

  // Error
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.ivory, paddingHorizontal: 40, gap: 12 },
  errorIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(198, 110, 78, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  errorTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, color: C.charcoal },
  errorText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: C.muted, textAlign: 'center' },
  errorBtn: { backgroundColor: C.terracotta, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, marginTop: 16 },
  errorBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFF' },

  // Sticky Header
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: C.ivory, borderBottomWidth: 0.5, borderBottomColor: C.hairline },
  stickyHeaderInner: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  stickyTitle: { flex: 1, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 17, color: C.charcoal, textAlign: 'center', marginHorizontal: 12 },

  // Hero
  heroWrap: { height: HERO_HEIGHT, backgroundColor: '#1A1510', overflow: 'hidden' },
  heroImageWrap: { ...StyleSheet.absoluteFillObject },
  heroImage: { width: '100%', height: '100%' },
  heroGradTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  heroGradBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 250 },
  floatingBtnsWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  heroBtn: { position: 'absolute', zIndex: 50, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  heroBtnBack: { width: 'auto' as any, flexDirection: 'row', paddingHorizontal: 12, gap: 2, borderRadius: 21, left: 16 },
  heroBtnBackText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: '#FFF' },
  heroBtnRight: { right: 16 },

  // Card
  card: { marginTop: -170, borderTopLeftRadius: 64, borderTopRightRadius: 64, backgroundColor: C.ivory, paddingHorizontal: CARD_HORIZONTAL_PADDING, paddingTop: 36, minHeight: 400, alignItems: 'stretch' as const },
  sheetHandle: { position: 'absolute', top: 10, alignSelf: 'center', width: 48, height: 4, borderRadius: 2, backgroundColor: 'rgba(0, 0, 0, 0.08)' },

  // Title
  title: { fontFamily: 'PlayfairDisplay_800ExtraBold', fontSize: 28, color: C.charcoal, lineHeight: 36, letterSpacing: -0.5, marginBottom: 10 },

  // Description
  description: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#8E8E93', lineHeight: 21, marginBottom: 10 },

  // Badge row
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 22, flexWrap: 'wrap' },
  matchBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(107, 142, 35, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    borderWidth: 0.5, borderColor: 'rgba(107, 142, 35, 0.2)',
  },
  matchBadgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.olive },
  timeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.cardBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    borderWidth: 0.5, borderColor: C.hairline,
  },
  timeBadgeText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: C.muted },
  detailLoadingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
    marginBottom: 18,
  },
  detailLoadingHintText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },

  // Gold hairline
  goldHairline: { height: 0.5, backgroundColor: 'rgba(212, 175, 55, 0.25)', marginBottom: 22 },

  // Stats
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  stat: { flex: 1 },
  statLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, color: C.muted, letterSpacing: 1.2, marginBottom: 5 },
  statValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: C.charcoal },

  // Sections
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionHeading: { fontFamily: 'PlayfairDisplay_800ExtraBold', fontSize: 24, color: C.charcoal },

  // Pantry badge
  pantryBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pantryBadgeText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.olive },
  pantryBadgeSeparator: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.muted },
  pantryNeedText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.terracotta },

  // Ingredient grid
  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  ingredientCard: { width: CARD_SIZE, marginBottom: 6 },
  ingredientImageArea: {
    width: CARD_SIZE, height: CARD_SIZE, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(26, 21, 16, 0.06)',
  },
  ingredientEmoji: { fontSize: 32 },
  ingredientPhoto: { width: '100%', height: '100%', borderRadius: 18 },
  ingredientNotch: {
    position: 'absolute', bottom: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  ingredientNotchHave: { backgroundColor: C.olive },
  ingredientNotchNeed: { backgroundColor: 'rgba(198, 110, 78, 0.6)' },
  ingredientName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.charcoal, textAlign: 'left', marginTop: 7 },
  ingredientAmount: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.muted, textAlign: 'left', marginTop: 2 },

  // Ingredient collapse / expand
  ingredientFadeWrap: { marginTop: -180, height: 180 },
  ingredientFade: { ...StyleSheet.absoluteFillObject },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24,
    backgroundColor: 'rgba(26, 21, 16, 0.05)', borderWidth: 0.5, borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  viewAllText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: C.muted, letterSpacing: 0.3 },
  pendingStepsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  pendingStepsText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
  },

  // Nutrition
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nutritionCard: { flex: 1, minWidth: '45%' as any, alignItems: 'center', padding: 16, borderRadius: 18, gap: 5 },
  nutritionVal: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  nutritionLbl: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: C.muted, letterSpacing: 0.5 },

  // Floating Dock
  dock: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    shadowColor: '#1A1510', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06, shadowRadius: 30, elevation: 14,
  },
  dockBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.95)' },
  dockHairline: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(212, 175, 55, 0.18)' },
  dockInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  dockSecondaryBtn: {
    flex: 0.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.cardBg, borderRadius: 28, paddingVertical: 16,
    borderWidth: 0.5, borderColor: C.hairline,
  },
  dockSavedBtn: { borderColor: 'rgba(212, 175, 55, 0.3)', backgroundColor: 'rgba(212, 175, 55, 0.08)' },
  dockSecondaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: C.charcoal, letterSpacing: 0.3 },
  dockPrimaryBtn: {
    flex: 0.6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.terracotta, borderRadius: 28, paddingVertical: 16,
    shadowColor: C.terracotta, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  dockPrimaryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#FFF', letterSpacing: 0.8 },
});
