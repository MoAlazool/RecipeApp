import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
// TYPES - Support both Recipe and FlashcardRecipe formats
// ============================================================================

// FlashcardRecipe format (from recipe-results screen)
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

// Standard Recipe format (from @/utils/types)
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

// Union type to accept either format
type RecipeInput = FlashcardRecipe | StandardRecipe;

// Type guard to check if recipe is FlashcardRecipe format
const isFlashcardRecipe = (recipe: RecipeInput): recipe is FlashcardRecipe => {
  return 'name' in recipe && 'image' in recipe && 'prepTime' in recipe;
};

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;
const ROTATION_ANGLE = 12;

// Faster, snappier spring animations
const SPRING_CONFIG = {
  // Fast entrance - card pops in quickly
  enter: {
    stiffness: 500,
    damping: 28,
    mass: 0.6,
  },
  // Bouncy snap-back
  snapBack: {
    stiffness: 600,
    damping: 22,
    mass: 0.5,
  },
  // Quick exit with velocity
  exit: {
    stiffness: 300,
    damping: 20,
    mass: 0.8,
  },
  // Card press feedback
  press: {
    stiffness: 500,
    damping: 20,
    mass: 0.4,
  },
};

const COLORS = {
  primary: '#FF4B2B',
  olive: '#606C38',
  charcoal: '#121417',
  blue: '#3B82F6',
  blueLight: '#DBEAFE',
  blueTint: 'rgba(59, 130, 246, 0.1)',
  white: '#FFFFFF',
  gray400: '#9CA3AF',
  slate700: '#334155',
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
  pantryItems?: string[]; // Items user has in pantry (only used for StandardRecipe)
  onCardPress?: (recipe: RecipeInput) => void;
  onFavoritePress?: (recipe: RecipeInput) => void;
}

// Normalize recipe data to a common format
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
    // FlashcardRecipe format - already has inStock/needed split
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
    // StandardRecipe format - need to calculate match from pantry
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
  // Normalize recipe data to common format
  const normalizedRecipe = normalizeRecipe(recipe, pantryItems);
  const normalizedNextRecipe = nextRecipe ? normalizeRecipe(nextRecipe, pantryItems) : null;

  const [isSaved, setIsSaved] = useState(normalizedRecipe.isFavorite);

  // Use normalized data
  const { inStock, needed, matchPercent } = {
    inStock: normalizedRecipe.inStock,
    needed: normalizedRecipe.needed,
    matchPercent: normalizedRecipe.matchPercent,
  };

  // ---- SHARED VALUES ----
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);

  // Stack card animations
  const stackCard2Scale = useSharedValue(0.96);
  const stackCard2TranslateY = useSharedValue(12);
  const stackCard3Scale = useSharedValue(0.92);
  const stackCard3TranslateY = useSharedValue(20);

  const blueGlowIntensity = useSharedValue(0);
  const favoriteScale = useSharedValue(1);

  // ---- EFFECTS ----
  useEffect(() => {
    // Quick reset - no delay
    cardOpacity.value = 0;
    cardScale.value = 0.92;
    translateY.value = 15;
    translateX.value = 0;

    // Fast entrance animation
    cardOpacity.value = withTiming(1, {
      duration: 150,
      easing: Easing.out(Easing.cubic)
    });
    cardScale.value = withSpring(1, SPRING_CONFIG.enter);
    translateY.value = withSpring(0, SPRING_CONFIG.enter);

    // Reset stack cards
    stackCard2Scale.value = withTiming(0.96, { duration: 150 });
    stackCard2TranslateY.value = withTiming(12, { duration: 150 });
    stackCard3Scale.value = withTiming(0.92, { duration: 150 });
    stackCard3TranslateY.value = withTiming(20, { duration: 150 });
    blueGlowIntensity.value = withTiming(0, { duration: 100 });

    setIsSaved(normalizedRecipe.isFavorite);
  }, [normalizedRecipe.id]);

  // ---- HAPTIC & SWIPE HANDLERS ----
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    Haptics.impactAsync(style);
  };

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    onSwipe(direction);
  };

  // ---- GESTURE HANDLER ----
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

      // Animate stack cards
      stackCard2Scale.value = interpolate(dragProgress, [0, 1], [0.96, 1]);
      stackCard2TranslateY.value = interpolate(dragProgress, [0, 1], [12, 0]);
      stackCard3Scale.value = interpolate(dragProgress, [0, 1], [0.92, 0.96]);
      stackCard3TranslateY.value = interpolate(dragProgress, [0, 1], [20, 12]);
      blueGlowIntensity.value = interpolate(dragProgress, [0, 0.5, 1], [0, 0.3, 0.6]);
    })
    .onEnd((event) => {
      'worklet';
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Heavy);
        const direction = event.translationX > 0 ? 'right' : 'left';
        const exitX = event.translationX > 0 ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;

        // Fast exit with velocity
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
        // Snap back
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        cardScale.value = withSpring(1, SPRING_CONFIG.snapBack);
        translateX.value = withSpring(0, SPRING_CONFIG.snapBack);
        stackCard2Scale.value = withSpring(0.96, SPRING_CONFIG.snapBack);
        stackCard2TranslateY.value = withSpring(12, SPRING_CONFIG.snapBack);
        stackCard3Scale.value = withSpring(0.92, SPRING_CONFIG.snapBack);
        stackCard3TranslateY.value = withSpring(20, SPRING_CONFIG.snapBack);
        blueGlowIntensity.value = withTiming(0, { duration: 150 });
      }
    });

  // ---- ANIMATED STYLES ----
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

  const nextCardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: stackCard2Scale.value },
      { translateY: stackCard2TranslateY.value },
    ],
  }));

  const blueGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: blueGlowIntensity.value,
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

  // ---- EVENT HANDLERS ----
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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      {/* ========== CARD STACK (3-LAYER DEPTH) ========== */}
      <Animated.View style={[styles.card, styles.stackCard3, stackCard3Style]}>
        <LinearGradient
          colors={['#F8FAFC', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.card, styles.stackCard2, stackCard2Style]}>
        <LinearGradient
          colors={['#FAFBFC', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ========== NEXT CARD PREVIEW (BLUE GLOW) ========== */}
      {normalizedNextRecipe && (
        <Animated.View
          style={[
            styles.card,
            styles.nextCard,
            nextCardStyle,
            blueGlowStyle
          ]}
        >
          <Image
            source={{ uri: normalizedNextRecipe.image }}
            style={styles.nextCardImage}
          />
          <View style={styles.nextCardOverlay} />
          <View style={styles.nextUpLabel}>
            <Text style={styles.nextUpText}>NEXT UP</Text>
            <Ionicons name="play-forward" size={12} color={COLORS.blue} />
          </View>
        </Animated.View>
      )}

      {/* ========== MAIN ACTIVE CARD ========== */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, styles.mainCard, mainCardStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleCardPress}
          />

          {/* ---------- HERO SECTION ---------- */}
          <View style={styles.heroSection}>
            <Image source={{ uri: normalizedRecipe.image }} style={styles.heroImage} />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']}
              style={styles.heroGradient}
            />

            {/* Top badges */}
            <View style={styles.topBadgesContainer}>
              <View style={styles.matchBadge}>
                <Text style={styles.badgeText}>{normalizedRecipe.matchPercent}% Match</Text>
              </View>
              {normalizedRecipe.isChefChoice && (
                <View style={styles.chefChoiceBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={COLORS.olive} />
                  <Text style={styles.chefChoiceBadgeText}>Chef's Choice</Text>
                </View>
              )}
            </View>

            {/* Favorite button */}
            <Animated.View style={[styles.favoriteButtonWrapper, favoriteButtonStyle]}>
              <Pressable
                onPress={handleFavoritePress}
                style={[styles.favoriteButton, isSaved && styles.favoriteButtonActive]}
              >
                <Ionicons
                  name={isSaved ? 'heart' : 'heart-outline'}
                  size={24}
                  color={COLORS.white}
                />
              </Pressable>
            </Animated.View>

            {/* Recipe info */}
            <View style={styles.heroBottomInfo}>
              <Text style={styles.recipeName} numberOfLines={2}>
                {normalizedRecipe.title}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color={COLORS.white} />
                  <Text style={styles.metaText}>{normalizedRecipe.time}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="stairs" size={16} color={COLORS.white} />
                  <Text style={styles.metaText}>{normalizedRecipe.difficulty}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ---------- INGREDIENTS SECTION ---------- */}
          <View style={styles.ingredientsSection}>
            <View style={styles.ingredientsGrid}>
              {/* In Stock column */}
              <View style={styles.ingredientColumn}>
                <View style={styles.ingredientHeader}>
                  <View style={[styles.dot, styles.dotOlive]} />
                  <Text style={styles.ingredientLabel}>YOU HAVE</Text>
                </View>
                <Text style={styles.ingredientList} numberOfLines={4}>
                  {inStock.length > 0
                    ? inStock.map(i => i.name).join(', ')
                    : 'No matching items'}
                </Text>
              </View>

              {/* Divider */}
              <LinearGradient
                colors={['#F1F5F9', '#E2E8F0', '#F1F5F9']}
                style={styles.divider}
              />

              {/* Needed column */}
              <View style={styles.ingredientColumn}>
                <View style={styles.ingredientHeader}>
                  <View style={[styles.dot, styles.dotPrimary]} />
                  <Text style={styles.ingredientLabel}>YOU NEED</Text>
                </View>
                <Text style={styles.ingredientList} numberOfLines={4}>
                  {needed.length > 0
                    ? needed.map(i => i.name).join(', ')
                    : 'Ready to cook!'}
                </Text>
              </View>
            </View>

            {/* Pagination dots */}
            <View style={styles.paginationContainer}>
              <View style={styles.paginationDots}>
                {Array.from({ length: totalItems }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.paginationDot, { opacity: i === activeIndex ? 0 : 1 }]}
                  />
                ))}
                <Animated.View
                  style={[
                    styles.paginationDot,
                    styles.paginationDotActive,
                    paginationIndicatorStyle
                  ]}
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
    borderRadius: 40,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },

  // Stack cards
  stackCard3: {
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  stackCard2: {
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },

  // Next card preview
  nextCard: {
    zIndex: 3,
    borderWidth: 2,
    borderColor: COLORS.blueLight,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 25,
    elevation: 8,
  },
  nextCardImage: {
    width: '100%',
    height: '50%',
    resizeMode: 'cover',
    opacity: 0.2,
  },
  nextCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.blueTint,
  },
  nextUpLabel: {
    position: 'absolute',
    top: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.6,
  },
  nextUpText: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 10,
    color: COLORS.blue,
    letterSpacing: 1.5,
  },

  // Main card
  mainCard: {
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 20,
  },

  // Hero section
  heroSection: {
    height: '48%',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // Badges
  topBadgesContainer: {
    position: 'absolute',
    top: 24,
    left: 24,
    gap: 8,
    flexDirection: 'row',
  },
  matchBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.white,
    letterSpacing: 1.2,
  },
  chefChoiceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chefChoiceBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.charcoal,
    letterSpacing: 1,
  },

  // Favorite button
  favoriteButtonWrapper: {
    position: 'absolute',
    top: 24,
    right: 24,
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  favoriteButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },

  // Hero bottom info
  heroBottomInfo: {
    position: 'absolute',
    bottom: 24,
    left: 28,
    right: 28,
  },
  recipeName: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 26,
    color: COLORS.white,
    marginBottom: 12,
    lineHeight: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },

  // Ingredients section
  ingredientsSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 28,
    backgroundColor: COLORS.white,
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
    gap: 10,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOlive: {
    backgroundColor: COLORS.olive,
    shadowColor: COLORS.olive,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  dotPrimary: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  ingredientLabel: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontSize: 11,
    color: COLORS.gray400,
    letterSpacing: 1.8,
  },
  ingredientList: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: COLORS.slate700,
    lineHeight: 22,
  },
  divider: {
    width: 1,
    marginHorizontal: 16,
  },

  // Pagination
  paginationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
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
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
  },
  paginationDotActive: {
    position: 'absolute',
    width: 24,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.charcoal,
    left: 0,
  },
});
