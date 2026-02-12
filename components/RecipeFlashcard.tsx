import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolate,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

// ============================================================================
// DESIGN TOKENS — Matching Recipe Detail Screen
// ============================================================================

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

// ============================================================================
// TYPES
// ============================================================================

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
  originalRecipe?: any;
}

interface StandardIngredient {
  name: string;
  amount?: number;
  unit?: string;
  category: string;
  notes?: string;
  checked?: boolean;
  is_optional?: boolean;
}

interface StandardRecipe {
  id: string;
  title: string;
  thumbnail_url?: string;
  total_time_minutes: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  is_favorite: boolean;
  ingredients: StandardIngredient[];
}

type RecipeInput = FlashcardRecipe | StandardRecipe;

const isFlashcardRecipe = (recipe: RecipeInput): recipe is FlashcardRecipe => {
  return 'name' in recipe && 'image' in recipe && 'prepTime' in recipe;
};

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const ROTATION_ANGLE = 10;

const SPRING_CONFIG = {
  enter: { stiffness: 500, damping: 28, mass: 0.6 },
  snapBack: { stiffness: 600, damping: 22, mass: 0.5 },
  exit: { stiffness: 300, damping: 20, mass: 0.8 },
  press: { stiffness: 500, damping: 20, mass: 0.4 },
};

// ============================================================================
// TYPES
// ============================================================================

interface RecipeFlashcardProps {
  recipe: RecipeInput;
  nextRecipe?: RecipeInput;
  onSwipe: (direction: 'left' | 'right') => void;
  activeIndex: number;
  totalItems: number;
  pantryItems?: string[];
  onCardPress?: (recipe: RecipeInput) => void;
  onFavoritePress?: (recipe: RecipeInput) => void;
  isDark?: boolean;
}

interface NormalizedRecipe {
  id: string;
  title: string;
  image: string;
  time: string;
  difficulty: string;
  matchPercent: number;
  isChefChoice: boolean;
  isFavorite: boolean;
  inStock: { name: string }[];
  needed: { name: string }[];
}

const normalizeRecipe = (
  recipe: RecipeInput,
  pantryItems: string[] = []
): NormalizedRecipe => {
  if (isFlashcardRecipe(recipe)) {
    return {
      id: recipe.id,
      title: recipe.name,
      image: recipe.image,
      time: recipe.prepTime,
      difficulty: recipe.difficulty,
      matchPercent: recipe.matchPercentage,
      isChefChoice: recipe.isChefChoice,
      isFavorite: false,
      inStock: recipe.ingredients.filter(i => i.inStock).map(i => ({ name: i.name })),
      needed: recipe.ingredients.filter(i => !i.inStock).map(i => ({ name: i.name })),
    };
  } else {
    const pantryLower = pantryItems.map(p => p.toLowerCase().trim());
    const inStock: { name: string }[] = [];
    const needed: { name: string }[] = [];

    (recipe.ingredients || []).forEach(ing => {
      const ingName = ing.name.toLowerCase().trim();
      const hasItem = pantryLower.some(p => p.includes(ingName) || ingName.includes(p));
      if (hasItem) {
        inStock.push({ name: ing.name });
      } else {
        needed.push({ name: ing.name });
      }
    });

    const matchPercent = recipe.ingredients?.length > 0
      ? Math.round((inStock.length / recipe.ingredients.length) * 100)
      : 0;

    const formatTime = (minutes: number): string => {
      if (minutes < 60) return `${minutes} min`;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    const difficultyMap: Record<string, string> = {
      beginner: 'Easy',
      intermediate: 'Medium',
      advanced: 'Hard',
    };

    return {
      id: recipe.id,
      title: recipe.title,
      image: recipe.thumbnail_url || '',
      time: formatTime(recipe.total_time_minutes),
      difficulty: difficultyMap[recipe.difficulty] || 'Medium',
      matchPercent,
      isChefChoice: recipe.is_favorite,
      isFavorite: recipe.is_favorite,
      inStock,
      needed,
    };
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export const RecipeFlashcard: React.FC<RecipeFlashcardProps> = ({
  recipe,
  nextRecipe,
  onSwipe,
  activeIndex,
  totalItems,
  pantryItems = [],
  onCardPress,
  onFavoritePress,
}) => {
  const normalizedRecipe = normalizeRecipe(recipe, pantryItems);
  const normalizedNextRecipe = nextRecipe ? normalizeRecipe(nextRecipe, pantryItems) : null;

  const [isSaved, setIsSaved] = useState(normalizedRecipe.isFavorite);

  const { inStock, needed, matchPercent } = {
    inStock: normalizedRecipe.inStock,
    needed: normalizedRecipe.needed,
    matchPercent: normalizedRecipe.matchPercent,
  };

  // Shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);

  const stackCard2Scale = useSharedValue(0.96);
  const stackCard2TranslateY = useSharedValue(10);
  const stackCard3Scale = useSharedValue(0.92);
  const stackCard3TranslateY = useSharedValue(18);

  const favoriteScale = useSharedValue(1);

  useEffect(() => {
    cardOpacity.value = 0;
    cardScale.value = 0.92;
    translateY.value = 15;
    translateX.value = 0;

    cardOpacity.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
    cardScale.value = withSpring(1, SPRING_CONFIG.enter);
    translateY.value = withSpring(0, SPRING_CONFIG.enter);

    stackCard2Scale.value = withTiming(0.96, { duration: 150 });
    stackCard2TranslateY.value = withTiming(10, { duration: 150 });
    stackCard3Scale.value = withTiming(0.92, { duration: 150 });
    stackCard3TranslateY.value = withTiming(18, { duration: 150 });

    setIsSaved(normalizedRecipe.isFavorite);
  }, [normalizedRecipe.id]);

  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  };

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    onSwipe(direction);
  };

  const panGesture = Gesture.Pan()
    .minDistance(8)
    .activeOffsetX([-8, 8])
    .failOffsetY([-20, 20])
    .onStart(() => {
      'worklet';
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
      cardScale.value = withSpring(0.98, SPRING_CONFIG.press);
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;

      const dragProgress = Math.min(Math.abs(event.translationX) / (SCREEN_WIDTH * 0.4), 1);

      stackCard2Scale.value = interpolate(dragProgress, [0, 1], [0.96, 1]);
      stackCard2TranslateY.value = interpolate(dragProgress, [0, 1], [10, 0]);
      stackCard3Scale.value = interpolate(dragProgress, [0, 1], [0.92, 0.96]);
      stackCard3TranslateY.value = interpolate(dragProgress, [0, 1], [18, 10]);
    })
    .onEnd((event) => {
      'worklet';
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Heavy);
        const direction = event.translationX > 0 ? 'right' : 'left';
        const exitX = event.translationX > 0 ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;

        translateX.value = withSpring(exitX, {
          ...SPRING_CONFIG.exit,
          velocity: event.velocityX,
        }, (finished) => {
          if (finished) {
            runOnJS(handleSwipeComplete)(direction);
          }
        });
        cardOpacity.value = withTiming(0, { duration: 200 });
      } else {
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        cardScale.value = withSpring(1, SPRING_CONFIG.snapBack);
        translateX.value = withSpring(0, SPRING_CONFIG.snapBack);
        stackCard2Scale.value = withSpring(0.96, SPRING_CONFIG.snapBack);
        stackCard2TranslateY.value = withSpring(10, SPRING_CONFIG.snapBack);
        stackCard3Scale.value = withSpring(0.92, SPRING_CONFIG.snapBack);
        stackCard3TranslateY.value = withSpring(18, SPRING_CONFIG.snapBack);
      }
    });

  const mainCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: cardScale.value },
      { rotate: `${interpolate(translateX.value, [-200, 200], [-ROTATION_ANGLE, ROTATION_ANGLE], Extrapolate.CLAMP)}deg` },
    ],
  }));

  const stackCard2Style = useAnimatedStyle(() => ({
    transform: [
      { scale: stackCard2Scale.value },
      { translateY: stackCard2TranslateY.value },
    ],
  }));

  const stackCard3Style = useAnimatedStyle(() => ({
    transform: [
      { scale: stackCard3Scale.value },
      { translateY: stackCard3TranslateY.value },
    ],
  }));

  const favoriteButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favoriteScale.value }],
  }));

  const paginationIndicatorStyle = useAnimatedStyle(() => {
    const dotWidth = 6;
    const gap = 8;
    const swipeProgress = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 0.4, 0, SCREEN_WIDTH * 0.4],
      [1, 0, -1],
      Extrapolate.CLAMP
    );
    let basePosition = activeIndex * (dotWidth + gap);
    const swipeOffset = swipeProgress * (dotWidth + gap);

    return {
      transform: [{ translateX: basePosition + swipeOffset }],
    };
  });

  const handleFavoritePress = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    const newSavedState = !isSaved;
    setIsSaved(newSavedState);
    favoriteScale.value = withSequence(
      withSpring(0.75, { damping: 10, stiffness: 400 }),
      withSpring(1.2, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    onFavoritePress?.(recipe);
  };

  const handleCardPress = () => {
    onCardPress?.(recipe);
  };

  return (
    <View style={styles.container}>
      {/* Stack Cards */}
      <Animated.View style={[styles.card, styles.stackCard3, stackCard3Style]}>
        <LinearGradient colors={['#FAF9F7', C.ivory]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.card, styles.stackCard2, stackCard2Style]}>
        <LinearGradient colors={['#FCFBF9', C.ivory]} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Main Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, styles.mainCard, mainCardStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCardPress} />

          {/* Hero Section */}
          <View style={styles.heroSection}>
            <ExpoImage source={{ uri: normalizedRecipe.image }} style={styles.heroImage} contentFit="cover" transition={200} />
            <LinearGradient
              colors={['transparent', 'rgba(26, 21, 16, 0.2)', 'rgba(26, 21, 16, 0.9)']}
              style={styles.heroGradient}
            />

            {/* Top Badges */}
            <View style={styles.topBadgesContainer}>
              <View style={styles.matchBadge}>
                <Text style={styles.badgeText}>{normalizedRecipe.matchPercent}% Match</Text>
              </View>
              {normalizedRecipe.isChefChoice && (
                <View style={styles.chefChoiceBadge}>
                  <Ionicons name="sparkles" size={12} color={C.gold} />
                  <Text style={styles.chefChoiceBadgeText}>Chef's Pick</Text>
                </View>
              )}
            </View>

            {/* Favorite Button */}
            <Animated.View style={[styles.favoriteButtonWrapper, favoriteButtonStyle]}>
              <Pressable
                onPress={handleFavoritePress}
                style={[styles.favoriteButton, isSaved && styles.favoriteButtonActive]}
              >
                <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={22} color="#FFF" />
              </Pressable>
            </Animated.View>

            {/* Recipe Info */}
            <View style={styles.heroBottomInfo}>
              <Text style={styles.recipeName} numberOfLines={2}>
                {normalizedRecipe.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.metaText}>{normalizedRecipe.time}</Text>
                </View>
                <View style={styles.metaDot} />
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="chef-hat" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.metaText}>{normalizedRecipe.difficulty}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Ingredients Section */}
          <View style={styles.ingredientsSection}>
            <View style={styles.ingredientsGrid}>
              {/* In Stock */}
              <View style={styles.ingredientColumn}>
                <View style={styles.ingredientHeader}>
                  <View style={[styles.dot, styles.dotOlive]} />
                  <Text style={styles.ingredientLabel}>YOU HAVE</Text>
                </View>
                <Text style={styles.ingredientList} numberOfLines={4}>
                  {inStock.length > 0 ? inStock.map(i => i.name).join(', ') : 'No matching items'}
                </Text>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Needed */}
              <View style={styles.ingredientColumn}>
                <View style={styles.ingredientHeader}>
                  <View style={[styles.dot, styles.dotTerracotta]} />
                  <Text style={styles.ingredientLabel}>YOU NEED</Text>
                </View>
                <Text style={styles.ingredientList} numberOfLines={4}>
                  {needed.length > 0 ? needed.map(i => i.name).join(', ') : 'Ready to cook!'}
                </Text>
              </View>
            </View>

            {/* Pagination */}
            <View style={styles.paginationContainer}>
              <View style={styles.paginationDots}>
                {Array.from({ length: totalItems }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.paginationDot, { opacity: i === activeIndex ? 0 : 1 }]}
                  />
                ))}
                <Animated.View
                  style={[styles.paginationDot, styles.paginationDotActive, paginationIndicatorStyle]}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: C.ivory,
    overflow: 'hidden',
  },

  stackCard3: {
    zIndex: 1,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  stackCard2: {
    zIndex: 2,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },

  mainCard: {
    zIndex: 10,
    shadowColor: C.charcoal,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 20,
  },

  heroSection: {
    height: '50%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  topBadgesContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    gap: 8,
    flexDirection: 'row',
  },
  matchBadge: {
    backgroundColor: C.olive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  chefChoiceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chefChoiceBadgeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.charcoal,
    letterSpacing: 0.3,
  },

  favoriteButtonWrapper: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  favoriteButtonActive: {
    backgroundColor: C.terracotta,
    borderColor: C.terracotta,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },

  heroBottomInfo: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
  },
  recipeName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: '#FFF',
    marginBottom: 10,
    lineHeight: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },

  ingredientsSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: C.ivory,
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flex: 1,
  },
  ingredientColumn: {
    flex: 1,
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOlive: {
    backgroundColor: C.olive,
  },
  dotTerracotta: {
    backgroundColor: C.terracotta,
  },
  ingredientLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: C.muted,
    letterSpacing: 1.5,
  },
  ingredientList: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.charcoal,
    lineHeight: 20,
  },
  divider: {
    width: 1,
    backgroundColor: C.hairline,
    marginHorizontal: 16,
  },

  paginationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 16,
  },
  paginationDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(138, 133, 120, 0.25)',
  },
  paginationDotActive: {
    position: 'absolute',
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.charcoal,
    left: 0,
  },
});
