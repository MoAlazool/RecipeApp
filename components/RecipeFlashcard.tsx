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
  withDecay,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const ROTATION_ANGLE = 30;

interface Ingredient {
  name: string;
  inStock: boolean;
}

interface Recipe {
  id: string;
  name: string;
  image: string;
  prepTime: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  matchPercentage: number;
  isChefChoice: boolean;
  ingredients: Ingredient[];
}

interface RecipeFlashcardProps {
  recipe: Recipe;
  nextRecipe?: Recipe;
  onSwipe: (direction: 'left' | 'right') => void;
  activeIndex: number;
  totalItems: number;
  isDark?: boolean;
  onCardPress?: (recipe: Recipe) => void;
  onFavoritePress?: (recipe: Recipe) => void;
}

export const RecipeFlashcard: React.FC<RecipeFlashcardProps> = ({
  recipe,
  nextRecipe,
  onSwipe,
  activeIndex,
  totalItems,
  isDark = false,
  onCardPress,
  onFavoritePress,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Reset position when recipe changes (smoother entrance)
  useEffect(() => {
    // Start from further back with rotation
    scale.value = 0.90;
    opacity.value = 0;
    translateX.value = 0;
    translateY.value = 20;

    // Bouncy spring entrance
    scale.value = withSpring(1, {
      damping: 18,          // Lower damping = more bounce
      stiffness: 400,       // Higher stiffness = snappier
      mass: 0.6,
      overshootClamping: false  // Allow overshoot
    });

    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 400,
      mass: 0.6
    });

    opacity.value = withTiming(1, { duration: 250 });

    setIsSaved(false);
  }, [recipe.id]);

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    onSwipe(direction);
  };

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .failOffsetY([-30, 30])
    .activeOffsetX([-5, 5])
    .onStart(() => {
      scale.value = withSpring(0.98, { damping: 25, stiffness: 400 });
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.05;
    })
    .onEnd((event) => {
      const shouldSwipe =
        Math.abs(event.translationX) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > 800;

      if (shouldSwipe) {
        // Swipe direction: positive translationX = swipe RIGHT, negative = swipe LEFT
        const direction = event.translationX > 0 ? 'right' : 'left';

        // Smooth exit with spring physics and rotation
        const exitX = event.translationX > 0 ? SCREEN_WIDTH + 200 : -(SCREEN_WIDTH + 200);
        const exitY = event.velocityY / 8;

        // Use spring for smooth, natural exit
        translateX.value = withSpring(exitX, {
          damping: 20,
          stiffness: 200,
          mass: 0.8,
          velocity: event.velocityX,
        }, (finished) => {
          if (finished) {
            runOnJS(handleSwipeComplete)(direction);
            // Reset immediately after callback
            translateX.value = 0;
            translateY.value = 0;
            scale.value = 1;
          }
        });

        translateY.value = withSpring(exitY, {
          damping: 20,
          stiffness: 200,
          mass: 0.8,
        });

        scale.value = withSpring(0.85, {
          damping: 20,
          stiffness: 200,
          mass: 0.8,
        });
      } else {
        // Smooth snap-back animation with spring physics
        translateX.value = withSpring(0, {
          damping: 22,
          stiffness: 350,
          mass: 0.6,
        });
        translateY.value = withSpring(0, {
          damping: 22,
          stiffness: 350,
          mass: 0.6,
        });
        scale.value = withSpring(1, {
          damping: 22,
          stiffness: 350,
          mass: 0.6,
        });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      [-ROTATION_ANGLE, 0, ROTATION_ANGLE],
      Extrapolate.EXTEND
    );

    const swipeOpacity = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [0, 1, 0],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity: opacity.value * swipeOpacity,
    };
  });

  // Next card animations (Scaling and moving up)
  const nextCardStyle = useAnimatedStyle(() => {
    // Enhanced scale with overshoot for bounce effect
    const nextScale = interpolate(
      Math.abs(translateX.value || 0),
      [0, SCREEN_WIDTH / 3, SCREEN_WIDTH / 2],
      [0.97, 1.02, 1],  // Start at 0.97, overshoot to 1.02, settle at 1
      Extrapolate.CLAMP
    );

    // Larger translateY range for more dramatic reveal
    const nextTranslateY = interpolate(
      Math.abs(translateX.value || 0),
      [0, SCREEN_WIDTH / 2],
      [8, 0],  // Move up 8px for smooth reveal
      Extrapolate.CLAMP
    );

    // Add subtle rotation during reveal
    const nextRotate = interpolate(
      translateX.value || 0,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [2, 0, -2],  // Slight counter-rotation
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateY: nextTranslateY },
        { scale: nextScale },
        { rotateZ: `${nextRotate}deg` }
      ],
    };
  });

  // Dark overlay that appears when swiping (low opacity)
  const nextCardOverlayOpacity = useAnimatedStyle(() => {
    const darkOpacity = interpolate(
      Math.abs(translateX.value),
      [0, SCREEN_WIDTH / 2],
      [0, 0.2],
      Extrapolate.CLAMP
    );

    return {
      opacity: darkOpacity,
    };
  });

  // Animated pagination indicator position
  const paginationIndicatorStyle = useAnimatedStyle(() => {
    'worklet';
    const dotWidth = 6;
    const activeDotWidth = 40;
    const gap = 8;

    // Calculate swipe progress (-1 for left swipe, 0 for center, 1 for right swipe)
    const swipeProgress = interpolate(
      translateX.value || 0,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [1, 0, -1],
      Extrapolate.CLAMP
    );

    // Calculate base position for current active index
    // Position = sum of all previous dots + gaps
    let basePosition = 0;
    for (let i = 0; i < activeIndex; i++) {
      basePosition += dotWidth + gap;
    }

    // Add swipe offset
    const swipeOffset = swipeProgress * (dotWidth + gap);
    const translationX = basePosition + swipeOffset;

    return {
      transform: [{ translateX: translationX }],
    };
  });

  const inStock = recipe.ingredients.filter((i) => i.inStock);
  const needed = recipe.ingredients.filter((i) => !i.inStock);

  return (
    <View style={styles.container}>
      {/* Card Stack - Tinder Style (Back to Front) */}

      {/* Third card in stack - furthest back */}
      <View style={[styles.card, styles.shadowCard3]} />

      {/* Second card in stack - middle */}
      <View style={[styles.card, styles.shadowCard2]} />

      {/* First card in stack - shows next recipe preview */}
      {nextRecipe && (
        <Animated.View style={[styles.card, styles.backgroundCard, nextCardStyle]}>
          {/* Next recipe preview image - more visible */}
          <Image source={{ uri: nextRecipe.image }} style={styles.nextImage} />

          {/* Low dark overlay (always visible) */}
          <View style={styles.baseDarkOverlay} />

          {/* Additional dark overlay on swipe */}
          <Animated.View style={[styles.darkOverlay, nextCardOverlayOpacity]} />

          {/* Next Up Label */}
          <View style={styles.nextUpLabel}>
            <Text style={styles.nextUpText}>NEXT UP</Text>
            <Ionicons name="play-forward" size={12} color="#FFFFFF" />
          </View>
        </Animated.View>
      )}

      {/* Main active card - on top */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, styles.mainCard, animatedCardStyle]}>
          {/* Tap to View Details */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (onCardPress) {
                onCardPress(recipe);
              }
            }}
          >
            {/* Empty pressable for card tap - children will be positioned absolutely */}
          </Pressable>

          {/* Hero Section with Image */}
          <View style={styles.heroSection} pointerEvents="box-none">
            <Image source={{ uri: recipe.image }} style={styles.heroImage} />

            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']}
              style={styles.gradient}
            />

            {/* Top Badges */}
            <View style={styles.topBadgesContainer}>
              {recipe.isChefChoice && (
                <View style={styles.chefChoiceBadge}>
                  <Ionicons name="shield-checkmark" size={16} color="#606C38" />
                  <Text style={styles.chefChoiceText}>CHEF'S CHOICE</Text>
                </View>
              )}
              <View style={styles.matchBadge}>
                <Text style={styles.matchText}>{recipe.matchPercentage}% MATCH</Text>
              </View>
            </View>

            {/* Favorite Button */}
            <Pressable
              style={[
                styles.favoriteButton,
                isSaved && styles.favoriteButtonActive,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                setIsSaved(!isSaved);
                if (onFavoritePress) {
                  onFavoritePress(recipe);
                }
              }}
              pointerEvents="box-only"
            >
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={24}
                color={isSaved ? '#FFFFFF' : '#FFFFFF'}
              />
            </Pressable>

            {/* Recipe Info at Bottom */}
            <View style={styles.heroBottomInfo} pointerEvents="none">
              <Text style={styles.recipeName} numberOfLines={2} ellipsizeMode="tail">
                {recipe.name}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.metaText}>{recipe.prepTime}</Text>
                </View>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="stairs" size={18} color="#FFFFFF" />
                  <Text style={styles.metaText}>{recipe.difficulty}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Ingredients Section */}
          <View style={styles.ingredientsSection} pointerEvents="none">
            <View style={styles.ingredientsGrid}>
              {/* Single Full-Width SHOPPING LIST Column */}
              <View style={styles.ingredientColumnFull}>
                <View style={styles.ingredientHeader}>
                  <View style={[styles.dot, { backgroundColor: '#FF4B2B' }]} />
                  <Text style={styles.ingredientLabel}>SHOPPING LIST</Text>
                </View>
                <Text style={styles.ingredientListFull} numberOfLines={4}>
                  {needed.length > 0
                    ? needed.map((i) => i.name).join(', ')
                    : 'You have everything! Ready to cook.'}
                </Text>
              </View>
            </View>

            {/* Pagination Dots */}
            <View style={styles.paginationContainer}>
              <View style={styles.paginationDots}>
                {/* Background dots - all inactive */}
                {Array.from({ length: totalItems }).map((_, i) => (
                  <View key={i} style={styles.paginationDot} />
                ))}

                {/* Animated active indicator */}
                <Animated.View
                  style={[
                    styles.paginationDotActive,
                    styles.paginationDotAnimated,
                    paginationIndicatorStyle,
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
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    // Soft ambient shadow for floating effect
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 8,
  },
  shadowCard3: {
    transform: [{ translateY: 12 }, { scale: 0.94 }],
    opacity: 0.9,
    zIndex: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    // Visible shadow for stacked effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
  },
  shadowCard2: {
    transform: [{ translateY: 6 }, { scale: 0.97 }],
    opacity: 0.95,
    zIndex: 1,
    borderWidth: 0,
    borderColor: 'transparent',
    // Visible shadow for stacked effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  backgroundCard: {
    zIndex: 3,
    borderWidth: 0,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    // Visible shadow for stacked effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.20,
    shadowRadius: 26,
    elevation: 8,
  },
  nextImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
    position: 'absolute',
    resizeMode: 'cover',
  },
  baseDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 1,
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 2,
  },
  nextUpLabel: {
    position: 'absolute',
    top: 20,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    zIndex: 3,
  },
  nextUpText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginRight: 4,
    letterSpacing: 1,
  },
  mainCard: {
    zIndex: 4,
    cursor: 'grab',
    borderWidth: 0,
    borderColor: 'transparent',
    // Strong visible drop shadow for floating effect
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 25,
  },
  heroSection: {
    height: '54%',  // Increased from 46% for bigger card
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  topBadgesContainer: {
    position: 'absolute',
    top: 24,
    left: 24,
    gap: 8,
  },
  chefChoiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  chefChoiceText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#121417',
    letterSpacing: 1.5,
  },
  matchBadge: {
    backgroundColor: '#FF4B2B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#FF4B2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  matchText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  favoriteButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  favoriteButtonActive: {
    backgroundColor: '#FF4B2B',
    borderColor: '#FF4B2B',
    transform: [{ scale: 1.1 }],
  },
  heroBottomInfo: {
    position: 'absolute',
    bottom: 24,
    left: 28,
    right: 28,
  },
  recipeName: {
    fontSize: 26,  // Slightly larger from 24px
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',  // Stronger shadow
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    lineHeight: 30,  // Add line height for multi-line
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ingredientsSection: {
    flex: 1,
    paddingHorizontal: 32,  // More horizontal space
    paddingVertical: 36,     // More vertical breathing room
    backgroundColor: '#FFFFFF',
  },
  ingredientsGrid: {
    flexDirection: 'row',
    flex: 1,
  },
  ingredientColumn: {
    flex: 1,
  },
  ingredientColumnFull: {
    width: '100%',
  },
  ingredientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ingredientLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#9CA3AF',
    letterSpacing: 1.8,
  },
  ingredientList: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
    lineHeight: 22,
  },
  ingredientListFull: {
    fontSize: 16,  // Slightly larger since we have more space
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#334155',
    lineHeight: 24,  // More spacious
  },
  divider: {
    width: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 24,
  },
  paginationContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
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
    backgroundColor: 'rgba(156, 163, 175, 0.8)',
  },
  paginationDotActive: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#121417',
  },
  paginationDotAnimated: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
