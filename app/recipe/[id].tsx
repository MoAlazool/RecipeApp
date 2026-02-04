import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Linking,
  TouchableOpacity,
  Pressable,
  StatusBar,
  Share,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRecipeStore } from '@/stores/recipeStore';
import { useShoppingStore } from '@/stores/shoppingStore';
import { useAuthStore } from '@/stores/authStore';
import { StepList } from '@/components/recipe/StepList';
import type { Recipe, RecipeSourceType, Ingredient } from '@/utils/types';
import { getIngredientEmoji, CATEGORY_BG_COLORS } from '@/utils/ingredientEmojis';
import { getIngredientImage } from '@/utils/ingredientImages';
import AskAIChefSheet from '@/components/recipe/AskAIChefSheet';
import { previewRecipe } from '@/utils/previewRecipe';
import { Image as ExpoImage } from 'expo-image';

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
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

const AnimatedExpoImage = Animated.createAnimatedComponent(ExpoImage);
const FALLBACK_IMAGE = 'https://via.placeholder.com/800x600';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 24;
const CARD_GAP = 10;
const NUM_COLUMNS = 4;
const CARD_SIZE = (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// ============================================================
// HELPERS
// ============================================================

const getDifficultyLabel = (d: string) => {
  switch (d) { case 'beginner': return 'Easy'; case 'intermediate': return 'Medium'; case 'advanced': return 'Hard'; default: return d; }
};

const getSourceLabel = (s: RecipeSourceType) => {
  switch (s) {
    case 'youtube': return 'YouTube'; case 'tiktok': return 'TikTok'; case 'instagram': return 'Instagram';
    case 'cookbook_scan': return 'Cookbook'; case 'website': return 'Website'; case 'fridge_scan': return 'Fridge Scan';
    case 'ai_chef': return 'AI Chef'; case 'manual': return 'Manual'; default: return 'Source';
  }
};

const getSourceIcon = (s: RecipeSourceType): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  switch (s) {
    case 'youtube': return { name: 'logo-youtube', color: '#FF0000' };
    case 'tiktok': return { name: 'logo-tiktok', color: '#000000' };
    case 'instagram': return { name: 'logo-instagram', color: '#E1306C' };
    case 'website': return { name: 'globe-outline', color: '#4A90D9' };
    case 'cookbook_scan': return { name: 'book-outline', color: '#8B6914' };
    case 'fridge_scan': return { name: 'scan-outline', color: '#34C759' };
    case 'ai_chef': return { name: 'sparkles', color: '#D4AF37' };
    case 'manual': return { name: 'create-outline', color: '#8A8578' };
    default: return { name: 'restaurant-outline', color: '#8A8578' };
  }
};

const extractAuthor = (url?: string): string | null => {
  if (!url) return null;
  // TikTok: tiktok.com/@username/...
  const tiktok = url.match(/tiktok\.com\/@([\w.-]+)/i);
  if (tiktok?.[1]) return `@${tiktok[1]}`;
  // Instagram: instagram.com/username/p/... or /reel/...
  const insta = url.match(/instagram\.com\/([\w.-]+)\/(?:p|reel|reels|tv)\//i);
  if (insta?.[1]) return `@${insta[1]}`;
  // YouTube: youtube.com/@handle or /channel/
  const yt = url.match(/youtube\.com\/@([\w.-]+)/i);
  if (yt?.[1]) return `@${yt[1]}`;
  return null;
};

const formatAmount = (amount?: number, scaleFactor = 1): string => {
  if (!amount) return '';
  const s = amount * scaleFactor;
  if (s === Math.floor(s)) return s.toString();
  if (Math.abs(s - 0.25) < 0.01) return '\u00BC';
  if (Math.abs(s - 0.33) < 0.01) return '\u2153';
  if (Math.abs(s - 0.5) < 0.01) return '\u00BD';
  if (Math.abs(s - 0.67) < 0.01) return '\u2154';
  if (Math.abs(s - 0.75) < 0.01) return '\u00BE';
  return s.toFixed(1).replace(/\.0$/, '');
};

// ============================================================
// ANIMATED INGREDIENT CARD
// ============================================================

interface AnimatedIngredientCardProps {
  ingredient: Ingredient;
  index: number;
  isChecked: boolean;
  scaleFactor: number;
  onToggle: (index: number) => void;
}

const AnimatedIngredientCard = React.memo(function AnimatedIngredientCard({
  ingredient,
  index,
  isChecked,
  scaleFactor,
  onToggle,
}: AnimatedIngredientCardProps) {
  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(index);
  }, [index, onToggle]);

  const ingredientImage = getIngredientImage(ingredient.name);
  const emoji = getIngredientEmoji(ingredient.name);
  const bgColor = CATEGORY_BG_COLORS[ingredient.category] || '#F5F3EE';
  const amountStr = formatAmount(ingredient.amount, scaleFactor);
  const unitStr = ingredient.unit || '';
  const amountDisplay = [amountStr, unitStr].filter(Boolean).join(' ');

  return (
    <View style={styles.ingredientCard}>
      <Pressable
        style={({ pressed }) => [
          styles.ingredientImageArea,
          ingredientImage
            ? { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, elevation: 0 }
            : { backgroundColor: bgColor },
          isChecked && !ingredientImage && styles.ingredientImageAreaSelected,
          pressed && { opacity: 0.8 },
        ]}
        onPress={handlePress}
      >
        {ingredientImage ? (
          <ExpoImage
            source={ingredientImage}
            style={styles.ingredientPhoto}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={styles.ingredientEmoji}>{emoji}</Text>
        )}
        <View style={[styles.ingredientNotch, isChecked && styles.ingredientNotchSelected]}>
          <Ionicons name={isChecked ? 'checkmark' : 'add'} size={14} color="#FFF" />
        </View>
      </Pressable>
      <Text style={[styles.ingredientName, isChecked && styles.ingredientNameSelected]}>
        {ingredient.name}
      </Text>
      {amountDisplay ? <Text style={styles.ingredientAmount}>{amountDisplay}</Text> : null}
    </View>
  );
});

// ============================================================
// COMPONENT
// ============================================================

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const moreSheetRef = useRef<BottomSheetModal>(null);
  const aiChefSheetRef = useRef<BottomSheetModal>(null);
  const { recipes, getRecipe, updateRecipe, deleteRecipe, toggleFavorite, saveRecipeToMyList, generateRecipeImage, isGeneratingImage } = useRecipeStore();
  const { addItemsFromRecipe } = useShoppingStore();
  const { user } = useAuthStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const isOwner = recipe?.user_id === user?.id;
  const isGenerating = recipe ? isGeneratingImage(recipe.id) : false;

  // Check if this recipe is already saved in user's list
  const isAlreadySaved = recipe ? recipes.some(r => r.original_recipe_id === recipe.id) : false;

  // --- Ingredients collapse/expand ---
  const COLLAPSED_HEIGHT = 220;
  const ingredientExpandProgress = useSharedValue(0);
  const fullGridHeight = useSharedValue(600);

  const onGridLayout = useCallback((e: any) => {
    const h = e.nativeEvent.layout.height;
    if (h > COLLAPSED_HEIGHT) fullGridHeight.value = h;
  }, []);

  const ingredientGridAnimStyle = useAnimatedStyle(() => {
    const total = Math.max(fullGridHeight.value, COLLAPSED_HEIGHT + 1);
    const h = COLLAPSED_HEIGHT + ingredientExpandProgress.value * (total - COLLAPSED_HEIGHT);
    return {
      height: h,
      overflow: 'hidden' as const,
    };
  });

  // Fade overlay — visible when collapsed, fades in/out with animation
  const fadeAnimStyle = useAnimatedStyle(() => ({
    opacity: 1 - ingredientExpandProgress.value,
  }));

  // "Show less" button — visible when expanded, fades in/out with animation
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

  // --- Parallax scroll ---
  const HERO_HEIGHT = 380;
  const NAV_HEIGHT = 48;
  const STICKY_THRESHOLD = HERO_HEIGHT - NAV_HEIGHT - insets.top;

  const scrollY = useSharedValue(0);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // Only bridge to JS when the boolean actually changes
  useAnimatedReaction(
    () => scrollY.value > STICKY_THRESHOLD,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setShowStickyHeader)(current);
      }
    },
  );
  const headerOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [220, 320], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [220, 320], [-16, 0], Extrapolation.CLAMP) }],
  }));
  const heroImageAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollY.value, [-300, 0], [1.4, 1.1], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [-300, 0, 600], [-120, 0, 240], Extrapolation.CLAMP) },
    ],
  }));

  // --- Smart Dock animations ---
  const selectedCountSV = useSharedValue(0);

  useEffect(() => {
    selectedCountSV.value = checkedIngredients.size;
  }, [checkedIngredients.size]);

  const DOCK_SPRING = { damping: 18, stiffness: 160, mass: 0.6 };

  const groceryBtnAnimStyle = useAnimatedStyle(() => {
    const hasItems = selectedCountSV.value > 0;
    return {
      flexGrow: withSpring(hasItems ? 1 : 0.001, DOCK_SPRING),
      flexShrink: 1,
      flexBasis: withSpring(hasItems ? 10 : 0, DOCK_SPRING),
      marginRight: withSpring(hasItems ? 8 : 0, DOCK_SPRING),
      opacity: withTiming(hasItems ? 1 : 0, { duration: 180 }),
      overflow: 'hidden' as const,
    };
  });

  const cookBtnAnimStyle = useAnimatedStyle(() => {
    const hasItems = selectedCountSV.value > 0;
    return {
      flexGrow: withSpring(hasItems ? 0.55 : 1, DOCK_SPRING),
      flexShrink: 1,
      flexBasis: 10,
    };
  });

  const isPreview = id === '__preview__';

  // Subscribe to store updates (e.g., when AI image generation completes)
  const storeRecipe = useRecipeStore((state) => state.recipes.find((r) => r.id === id));
  useEffect(() => {
    if (storeRecipe && recipe && storeRecipe.thumbnail_url !== recipe.thumbnail_url) {
      setRecipe((prev) => prev ? { ...prev, thumbnail_url: storeRecipe.thumbnail_url } : prev);
    }
  }, [storeRecipe?.thumbnail_url]);

  useEffect(() => { loadRecipe(); }, [id]);
  const loadRecipe = async () => {
    if (!id) return;
    if (isPreview) {
      setRecipe(previewRecipe.get());
      setIsLoading(false);
      return;
    }
    setRecipe(await getRecipe(id));
    setIsLoading(false);
  };

  // --- Handlers ---

  const handleServingChange = useCallback((delta: number) => {
    if (!recipe) return;
    const next = recipe.current_servings + delta;
    if (next < 1 || next > 20) return;
    setRecipe({ ...recipe, current_servings: next });
    updateRecipe(recipe.id, { current_servings: next });
  }, [recipe]);

  const handleFavorite = async () => {
    if (!recipe) return;
    await toggleFavorite(recipe.id);
    setRecipe({ ...recipe, is_favorite: !recipe.is_favorite });
  };

  const handleDelete = () => {
    if (!recipe) return;
    Alert.alert('Delete Recipe', `Are you sure you want to delete "${recipe.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteRecipe(recipe.id); router.replace('/(tabs)'); }
        catch (e: any) { Alert.alert('Error', e?.message || 'Failed to delete.'); }
      }},
    ]);
  };

  const handleSendToFriend = () => {
    if (!recipe) return;
    router.push({ pathname: '/share-recipe' as any, params: { recipeId: recipe.id, recipeTitle: recipe.title, recipeThumbnail: recipe.thumbnail_url ? encodeURIComponent(recipe.thumbnail_url) : '', recipeTime: recipe.total_time_minutes?.toString() || '', recipeDifficulty: recipe.difficulty || '' } });
  };

  const handleShareLink = async () => {
    if (!recipe) return;
    try { await Share.share({ message: recipe.source_url ? `${recipe.title}\n${recipe.source_url}` : recipe.title, title: recipe.title }); } catch {}
  };

  const handleSaveToMyList = async () => {
    if (!recipe || isSaving) return;
    setIsSaving(true);
    try {
      const saved = await saveRecipeToMyList(recipe);
      Alert.alert('Saved!', `"${recipe.title}" added to your recipes.`, [
        { text: 'View', onPress: () => router.replace(`/recipe/${saved.id}` as any) },
        { text: 'Stay', style: 'cancel' },
      ]);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to save'); }
    finally { setIsSaving(false); }
  };

  const handleGenerateImage = () => {
    if (!recipe || isGenerating) return;
    moreSheetRef.current?.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Generate image in the background via store - continues even if user leaves page
    generateRecipeImage(recipe.id, recipe.title);
  };

  const handleOpenSource = async () => {
    if (recipe?.source_url) try { await Linking.openURL(recipe.source_url); } catch {}
  };

  const reopenSheetRef = useRef(false);

  const handleAsk = useCallback(() => {
    aiChefSheetRef.current?.present();
  }, []);

  // Re-present AI Chef sheet when returning from preview
  useFocusEffect(
    useCallback(() => {
      if (reopenSheetRef.current) {
        reopenSheetRef.current = false;
        setTimeout(() => aiChefSheetRef.current?.present(), 300);
      }
    }, [])
  );

  const handleMore = useCallback(() => {
    moreSheetRef.current?.present();
  }, []);

  const handleSheetAction = useCallback((action: () => void) => {
    moreSheetRef.current?.dismiss();
    // Small delay so the sheet dismisses before navigation/alerts
    setTimeout(action, 150);
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />,
    [],
  );

  const handleAddSelectedToGrocery = () => {
    if (!recipe || checkedIngredients.size === 0) return;
    const selected = recipe.ingredients.filter((_, i) => checkedIngredients.has(i));
    addItemsFromRecipe(recipe.id, recipe.title, selected);
    Alert.alert('Added!', `${selected.length} ingredients added to your grocery list.`);
    setCheckedIngredients(new Set());
  };

  const toggleIngredient = useCallback((i: number) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (!recipe) return;
    checkedIngredients.size === recipe.ingredients.length
      ? setCheckedIngredients(new Set())
      : setCheckedIngredients(new Set(recipe.ingredients.map((_, i) => i)));
  };

  // --- Loading ---
  if (isLoading || !recipe) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="restaurant" size={48} color={C.gold} />
        <Text style={styles.loadingText}>Preparing your recipe...</Text>
      </View>
    );
  }

  const scaleFactor = recipe.current_servings / recipe.original_servings;
  const hasNutrition = recipe.calories || recipe.protein_g || recipe.carbs_g || recipe.fat_g;
  const allSelected = checkedIngredients.size === recipe.ingredients.length && recipe.ingredients.length > 0;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {showStickyHeader ? (
        /* Sticky Header — solid bar */
        <Animated.View style={[styles.stickyHeader, headerOpacity, { paddingTop: insets.top }]}>
          <View style={styles.stickyHeaderInner}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={C.charcoal} />
            </TouchableOpacity>
            <Text style={styles.stickyTitle} numberOfLines={1}>{recipe.title}</Text>
            <TouchableOpacity onPress={handleMore} hitSlop={8}>
              <Ionicons name="ellipsis-horizontal" size={22} color={C.charcoal} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        /* Floating hero buttons — glass style */
        <>
          <TouchableOpacity style={[styles.heroBtn, styles.heroBtnBack, { top: insets.top + 10 }]} onPress={() => router.back()} activeOpacity={0.85}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={20} color="#FFF" />
            <Text style={styles.heroBtnBackText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.heroBtn, styles.heroBtnRight, { top: insets.top + 10 }]} onPress={handleMore} activeOpacity={0.85}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
          </TouchableOpacity>
        </>
      )}

      {/* Scroll content */}
      <Animated.ScrollView onScroll={scrollHandler} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero Image */}
        <View style={styles.heroWrap}>
          <AnimatedExpoImage source={{ uri: recipe.thumbnail_url || FALLBACK_IMAGE }} style={[styles.heroImage, heroImageAnim]} contentFit="contain" transition={300} />
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent']} style={styles.heroGradTop} pointerEvents="none" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.heroGradBottom} pointerEvents="none" />
          {isGenerating && (
            <View style={styles.heroGeneratingOverlay}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
              <ActivityIndicator size="large" color={C.gold} />
              <Text style={styles.heroGeneratingText}>Generating image...</Text>
            </View>
          )}
        </View>

        {/* Content Card */}
        <View style={styles.card}>
          <View style={styles.sheetHandle} />

          {/* Title */}
          <Text style={styles.title}>{recipe.title}</Text>

          {/* Description */}
          {recipe.description && <Text style={styles.description}>{recipe.description}</Text>}

          {/* Source */}
          <View style={styles.sourceLine}>
            <Ionicons name={getSourceIcon(recipe.source_type).name} size={14} color={getSourceIcon(recipe.source_type).color} style={{ marginRight: 5 }} />
            {extractAuthor(recipe.source_url) ? (
              <Text style={styles.sourceLabel}>by {extractAuthor(recipe.source_url)}</Text>
            ) : (
              <Text style={styles.sourceLabel}>{getSourceLabel(recipe.source_type)}</Text>
            )}
            {recipe.source_url && (
              <TouchableOpacity onPress={handleOpenSource}>
                <Text style={styles.sourceLink}> &middot; See Original</Text>
              </TouchableOpacity>
            )}
          </View>


          {/* Action pills */}
          <View style={styles.actionRow}>
            {!isPreview && (
              <Pressable style={({ pressed }) => [styles.actionPill, pressed && { transform: [{ scale: 0.95 }], opacity: 0.6 }]} onPress={() => handleSheetAction(handleSendToFriend)}>
                <Ionicons name="paper-plane-outline" size={16} color={C.charcoal} />
                <Text style={styles.actionPillText}>SEND</Text>
              </Pressable>
            )}
            {!isPreview && (
              <Pressable style={({ pressed }) => [styles.actionPill, pressed && { transform: [{ scale: 0.95 }], opacity: 0.6 }]} onPress={() => handleSheetAction(handleAsk)}>
                <Ionicons name="sparkles-outline" size={16} color={C.gold} />
                <Text style={styles.actionPillText}>ASK</Text>
              </Pressable>
            )}
            {!isPreview && isOwner && (
              <>
                <Pressable style={({ pressed }) => [styles.actionPill, pressed && { transform: [{ scale: 0.95 }], opacity: 0.6 }]} onPress={() => router.push({ pathname: '/edit-recipe' as any, params: { recipeId: recipe.id } })}>
                  <Ionicons name="create-outline" size={16} color={C.charcoal} />
                  <Text style={styles.actionPillText}>EDIT</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.actionPill, pressed && { transform: [{ scale: 0.95 }], opacity: 0.6 }]} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={16} color={C.charcoal} />
                  <Text style={styles.actionPillText}>DELETE</Text>
                </Pressable>
              </>
            )}
            {(!isOwner || isPreview) && (
              <Pressable style={({ pressed }) => [styles.actionPill, isAlreadySaved && styles.actionPillSaved, pressed && !isAlreadySaved && { transform: [{ scale: 0.95 }], opacity: 0.6 }]} onPress={isAlreadySaved ? undefined : handleSaveToMyList} disabled={isSaving || isAlreadySaved}>
                <Ionicons name={isAlreadySaved ? "bookmark" : "bookmark-outline"} size={16} color={isAlreadySaved ? C.gold : C.charcoal} />
                <Text style={[styles.actionPillText, isAlreadySaved && { color: C.gold }]}>{isSaving ? 'SAVING...' : isAlreadySaved ? 'SAVED' : 'SAVE'}</Text>
              </Pressable>
            )}
          </View>

          {/* Gold hairline */}
          <View style={styles.goldHairline} />

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>SKILL LEVEL</Text>
              <Text style={styles.statValue}>{getDifficultyLabel(recipe.difficulty)}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>COOK TIME</Text>
              <Text style={styles.statValue}>{(() => { const t = recipe.total_time_minutes || 0; if (t < 60) return `${t}m`; const h = Math.round(t / 60 * 2) / 2; return h % 1 ? `${Math.floor(h)}½hr` : `${h}hr`; })()}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>INGREDIENTS</Text>
              <Text style={styles.statValue}>{recipe.ingredients.length}</Text>
            </View>
            {recipe.calories ? (
              <View style={styles.stat}>
                <Text style={styles.statLabel}>EST. CALORIES</Text>
                <Text style={styles.statValue}>{recipe.calories}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.goldHairline} />

          {/* ── INGREDIENTS ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHeading}>Ingredients</Text>
            <Pressable style={({ pressed }) => [styles.selectAllPill, allSelected && styles.selectAllPillActive, pressed && { transform: [{ scale: 0.95 }], opacity: 0.6 }]} onPress={handleSelectAll}>
              <MaterialCommunityIcons name={allSelected ? 'select-off' : 'check-all'} size={16} color={allSelected ? C.terracotta : C.muted} />
              <Text style={[styles.selectAllText, allSelected && styles.selectAllTextActive]}>
                {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
              </Text>
            </Pressable>
          </View>

          {recipe.ingredients.length > NUM_COLUMNS * 2 ? (
            <View>
              <Animated.View style={ingredientGridAnimStyle}>
                <View style={styles.ingredientGrid} onLayout={onGridLayout}>
                  {recipe.ingredients.map((ing, i) => (
                    <AnimatedIngredientCard
                      key={i}
                      ingredient={ing}
                      index={i}
                      isChecked={checkedIngredients.has(i)}
                      scaleFactor={scaleFactor}
                      onToggle={toggleIngredient}
                    />
                  ))}
                </View>
              </Animated.View>

              {/* Gradient fade + View All — always rendered, animated opacity */}
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
                    <Text style={styles.viewAllText}>View all {recipe.ingredients.length}</Text>
                    <Ionicons name="chevron-down" size={16} color={C.muted} />
                  </View>
                </Pressable>
              </Animated.View>

              {/* Show less — always rendered, animated opacity */}
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
              {recipe.ingredients.map((ing, i) => (
                <AnimatedIngredientCard
                  key={i}
                  ingredient={ing}
                  index={i}
                  isChecked={checkedIngredients.has(i)}
                  scaleFactor={scaleFactor}
                  onToggle={toggleIngredient}
                />
              ))}
            </View>
          )}

          {/* ── COOKING STEPS ── */}
          <Text style={[styles.sectionHeading, { marginTop: 40, marginBottom: 18 }]}>Cooking Steps</Text>
          <StepList steps={recipe.steps} ingredients={recipe.ingredients} />

          {/* ── NUTRITION ── */}
          {hasNutrition && (
            <>
              <Text style={[styles.sectionHeading, { marginTop: 40, marginBottom: 18 }]}>Nutrition Profile</Text>
              <View style={styles.nutritionGrid}>
                {recipe.calories != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(198, 110, 78, 0.06)' }]}>
                    <Ionicons name="flame" size={20} color={C.terracotta} />
                    <Text style={[styles.nutritionVal, { color: C.terracotta }]}>{recipe.calories}</Text>
                    <Text style={styles.nutritionLbl}>Calories</Text>
                  </View>
                )}
                {recipe.protein_g != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(212, 175, 55, 0.06)' }]}>
                    <Ionicons name="barbell" size={20} color={C.gold} />
                    <Text style={[styles.nutritionVal, { color: C.gold }]}>{recipe.protein_g}g</Text>
                    <Text style={styles.nutritionLbl}>Protein</Text>
                  </View>
                )}
                {recipe.carbs_g != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(138, 133, 120, 0.06)' }]}>
                    <Ionicons name="nutrition" size={20} color={C.muted} />
                    <Text style={[styles.nutritionVal, { color: C.muted }]}>{recipe.carbs_g}g</Text>
                    <Text style={styles.nutritionLbl}>Carbs</Text>
                  </View>
                )}
                {recipe.fat_g != null && (
                  <View style={[styles.nutritionCard, { backgroundColor: 'rgba(26, 21, 16, 0.04)' }]}>
                    <Ionicons name="water" size={20} color={C.charcoal} />
                    <Text style={[styles.nutritionVal, { color: C.charcoal }]}>{recipe.fat_g}g</Text>
                    <Text style={styles.nutritionLbl}>Fat</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── NOTES ── */}
          {recipe.user_notes && (
            <>
              <Text style={[styles.sectionHeading, { marginTop: 40, marginBottom: 14 }]}>Chef&apos;s Notes</Text>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{recipe.user_notes}</Text>
              </View>
            </>
          )}

          {recipe.user_modifications && recipe.user_modifications.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <Text style={styles.modLabel}>MODIFICATIONS</Text>
              {recipe.user_modifications.map((mod, i) => (
                <View key={i} style={styles.modItem}>
                  <View style={[styles.modDot, { backgroundColor: mod.impact === 'positive' ? '#6B8E23' : mod.impact === 'negative' ? C.terracotta : C.gold }]} />
                  <Text style={styles.modOriginal}>{mod.original}</Text>
                  <Ionicons name="arrow-forward" size={14} color={C.muted} style={{ marginHorizontal: 6 }} />
                  <Text style={styles.modModified}>{mod.modified}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── FLOATING DOCK ── */}
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={styles.dockHairline} />

        <View style={styles.dockInner}>
          {/* Servings */}
          <View style={styles.dockServingsWrap}>
            <Text style={styles.dockServingsLabel}>SERVINGS</Text>
            <View style={styles.dockServings}>
              <Pressable onPress={() => handleServingChange(-1)} style={({ pressed }) => [styles.dockServBtn, pressed && styles.pressed]} disabled={recipe.current_servings <= 1}>
                <Ionicons name="remove" size={16} color={recipe.current_servings <= 1 ? '#D1D5DB' : C.charcoal} />
              </Pressable>
              <Text style={styles.dockServValue}>{recipe.current_servings}</Text>
              <Pressable onPress={() => handleServingChange(1)} style={({ pressed }) => [styles.dockServBtn, pressed && styles.pressed]} disabled={recipe.current_servings >= 20}>
                <Ionicons name="add" size={16} color={recipe.current_servings >= 20 ? '#D1D5DB' : C.charcoal} />
              </Pressable>
            </View>
          </View>

          {/* CTA buttons */}
          <View style={styles.dockButtons}>
            <Animated.View style={groceryBtnAnimStyle}>
              <Pressable
                style={({ pressed }) => [styles.dockGroceryBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  handleAddSelectedToGrocery();
                }}
              >
                <Ionicons name="cart" size={17} color="#FFF" />
                <Text style={styles.dockGroceryText} numberOfLines={1}>ADD {checkedIngredients.size}</Text>
              </Pressable>
            </Animated.View>
            <Animated.View style={cookBtnAnimStyle}>
              {isOwner ? (
                <Pressable style={({ pressed }) => [styles.dockCookBtn, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]} onPress={() => router.push(`/cooking/${recipe.id}`)}>
                  <Text style={styles.dockCookText} numberOfLines={1}>{checkedIngredients.size > 0 ? 'COOK' : 'COOK NOW!'}</Text>
                </Pressable>
              ) : (
                <Pressable style={({ pressed }) => [styles.dockSaveBtn, isAlreadySaved && styles.dockSavedBtn, pressed && !isAlreadySaved && { transform: [{ scale: 0.97 }], opacity: 0.9 }]} onPress={isAlreadySaved ? undefined : handleSaveToMyList} disabled={isSaving || isAlreadySaved}>
                  <Ionicons name={isAlreadySaved ? "checkmark-circle" : "bookmark-outline"} size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.dockSaveText} numberOfLines={1}>{isSaving ? 'Saving...' : isAlreadySaved ? 'Saved to My Recipes' : 'Save Recipe'}</Text>
                </Pressable>
              )}
            </Animated.View>
          </View>
        </View>
      </View>

      {/* ── More Actions Bottom Sheet ── */}
      <BottomSheetModal
        ref={moreSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: 'rgba(0,0,0,0.15)', width: 36 }}
        backgroundStyle={{ backgroundColor: C.ivory, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
      >
        <BottomSheetView style={styles.sheetContent}>
          {/* Actions */}
          <Pressable style={styles.sheetRow} onPress={() => handleSheetAction(handleFavorite)}>
            <Ionicons name={recipe.is_favorite ? 'heart' : 'heart-outline'} size={22} color={recipe.is_favorite ? '#EF4444' : C.charcoal} />
            <Text style={styles.sheetRowText}>{recipe.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}</Text>
          </Pressable>

          <Pressable style={styles.sheetRow} onPress={() => handleSheetAction(handleSendToFriend)}>
            <Ionicons name="paper-plane-outline" size={22} color={C.charcoal} />
            <Text style={styles.sheetRowText}>Send to Friend</Text>
          </Pressable>

          <Pressable style={styles.sheetRow} onPress={() => handleSheetAction(handleShareLink)}>
            <Ionicons name="share-outline" size={22} color={C.charcoal} />
            <Text style={styles.sheetRowText}>Share Link</Text>
          </Pressable>

          <Pressable style={styles.sheetRow} onPress={() => handleSheetAction(handleAsk)}>
            <Ionicons name="sparkles-outline" size={22} color={C.gold} />
            <Text style={styles.sheetRowText}>Ask AI Chef</Text>
          </Pressable>

          {isOwner && (
            <>
              <Pressable style={styles.sheetRow} onPress={handleGenerateImage} disabled={isGenerating}>
                <Ionicons name="image-outline" size={22} color={C.gold} />
                <Text style={styles.sheetRowText}>{isGenerating ? 'Generating...' : 'Generate Image with AI'}</Text>
                {isGenerating && <ActivityIndicator size="small" color={C.gold} style={{ marginLeft: 'auto' }} />}
              </Pressable>

              <Pressable style={styles.sheetRow} onPress={() => handleSheetAction(() => router.push({ pathname: '/edit-recipe' as any, params: { recipeId: recipe.id } }))}>
                <Ionicons name="create-outline" size={22} color={C.charcoal} />
                <Text style={styles.sheetRowText}>Edit Recipe</Text>
              </Pressable>

              <View style={styles.sheetDivider} />

              <Pressable style={styles.sheetRow} onPress={() => handleSheetAction(handleDelete)}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text style={[styles.sheetRowText, { color: '#EF4444' }]}>Delete Recipe</Text>
              </Pressable>
            </>
          )}

          {!isOwner && (
            <Pressable style={[styles.sheetRow, isAlreadySaved && { opacity: 0.5 }]} onPress={isAlreadySaved ? undefined : () => handleSheetAction(handleSaveToMyList)} disabled={isAlreadySaved}>
              <Ionicons name={isAlreadySaved ? "bookmark" : "bookmark-outline"} size={22} color={isAlreadySaved ? C.gold : C.charcoal} />
              <Text style={[styles.sheetRowText, isAlreadySaved && { color: C.gold }]}>{isAlreadySaved ? 'Already Saved' : 'Save to My Recipes'}</Text>
            </Pressable>
          )}

          {/* Cancel */}
          <View style={styles.sheetDivider} />
          <Pressable style={styles.sheetRow} onPress={() => moreSheetRef.current?.dismiss()}>
            <Text style={[styles.sheetRowText, { color: C.muted, textAlign: 'center', flex: 1 }]}>Cancel</Text>
          </Pressable>

          <View style={{ height: insets.bottom + 8 }} />
        </BottomSheetView>
      </BottomSheetModal>

      {/* ── Ask AI Chef Bottom Sheet ── */}
      {!isPreview && <AskAIChefSheet ref={aiChefSheetRef} recipe={recipe} onPreviewOpen={() => { reopenSheetRef.current = true; }} />}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.ivory },
  scrollContent: { paddingBottom: 140 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.ivory, gap: 16 },
  loadingText: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: C.muted },

  // Sticky header
  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: C.ivory, borderBottomWidth: 0.5, borderBottomColor: C.hairline },
  stickyHeaderInner: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  stickyTitle: { flex: 1, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 17, color: C.charcoal, textAlign: 'center', marginHorizontal: 12 },

  // Hero
  heroWrap: { height: 380, backgroundColor: C.ivory, overflow: 'hidden' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', top: -150 },
  heroGradTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  heroGradBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 250 },
  heroGeneratingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
    gap: 12,
  },
  heroGeneratingText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#FFF',
  },
  heroBtn: { position: 'absolute', zIndex: 50, width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
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

  // Source
  sourceLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' },
  sourceLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.charcoal },
  sourceLink: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 12, color: C.muted },

  // Gold hairline
  // Action pills
  actionRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  actionPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 28,
    borderWidth: 0.5, borderColor: 'rgba(26, 21, 16, 0.1)',
    backgroundColor: C.glass,
  },
  actionPillSaved: {
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  actionPillText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: C.charcoal, letterSpacing: 0.6 },

  goldHairline: { height: 0.5, backgroundColor: 'rgba(212, 175, 55, 0.25)', marginBottom: 22 },

  // Stats
  statsRow: { flexDirection: 'row', marginBottom: 24 },
  stat: { flex: 1 },
  statLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, color: C.muted, letterSpacing: 1.2, marginBottom: 5 },
  statValue: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15, color: C.charcoal },

  // Sections
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sectionHeading: { fontFamily: 'PlayfairDisplay_800ExtraBold', fontSize: 24, color: C.charcoal },

  // Select All
  selectAllPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 4,
  },
  selectAllPillActive: {},
  selectAllText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, color: C.muted, letterSpacing: 0.5 },
  selectAllTextActive: { color: C.terracotta },

  // Ingredient grid
  ingredientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  ingredientCard: { width: CARD_SIZE, marginBottom: 6 },
  ingredientImageArea: {
    width: CARD_SIZE, height: CARD_SIZE, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
    ...SHADOW_SOFT,
  },
  ingredientImageAreaSelected: { borderColor: C.gold },
  ingredientEmoji: { fontSize: 32 },
  ingredientPhoto: { width: '100%', height: '100%', borderRadius: 18 },
  ingredientNotch: {
    position: 'absolute', bottom: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(26, 21, 16, 0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  ingredientNotchSelected: {
    backgroundColor: C.gold,
  },
  ingredientName: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: C.charcoal, textAlign: 'left', marginTop: 7 },
  ingredientNameSelected: { color: C.gold },
  ingredientAmount: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 11, color: C.muted, textAlign: 'left', marginTop: 2 },

  // Nutrition
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nutritionCard: { flex: 1, minWidth: '45%' as any, alignItems: 'center', padding: 16, borderRadius: 18, gap: 5 },
  nutritionVal: { fontSize: 22, fontFamily: 'PlusJakartaSans_800ExtraBold' },
  nutritionLbl: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', color: C.muted, letterSpacing: 0.5 },

  // Notes
  notesCard: { backgroundColor: C.cardBg, borderRadius: 18, padding: 18, borderWidth: 0.5, borderColor: C.hairline },
  notesText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 23, color: C.charcoal },
  modLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: C.muted, letterSpacing: 1.8, marginBottom: 12 },
  modItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.cardBg, borderRadius: 14, padding: 12, marginBottom: 8, flexWrap: 'wrap', borderWidth: 0.5, borderColor: C.hairline },
  modDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  modOriginal: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: C.muted, textDecorationLine: 'line-through' },
  modModified: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14, color: C.charcoal },

  // Floating Dock
  dock: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 40, borderTopRightRadius: 40,
    shadowColor: '#1A1510', shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06, shadowRadius: 30, elevation: 14,
  },
  dockHairline: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(212, 175, 55, 0.18)' },
  dockInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, minHeight: 64 },

  // Dock — Servings
  dockServingsWrap: { alignItems: 'center' },
  dockServingsLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9, color: C.muted, letterSpacing: 1.2, marginBottom: 3 },
  dockServings: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(26, 21, 16, 0.04)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 5 },
  dockServBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', ...SHADOW_SOFT },
  dockServValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: C.charcoal, minWidth: 22, textAlign: 'center' },

  // Dock — Button row
  dockButtons: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },

  // Dock — Cook button
  dockCookBtn: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.terracotta, borderRadius: 40, paddingVertical: 15,
    shadowColor: C.terracotta, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  dockCookText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFF', letterSpacing: 0.8 },

  // Dock — Save button
  dockSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#6B8E23', borderRadius: 40, paddingVertical: 15,
    shadowColor: '#6B8E23', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  dockSavedBtn: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
  },
  dockSaveText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFF', letterSpacing: 0.8 },

  // Dock — Grocery button (animated)
  dockGroceryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: C.charcoal, borderRadius: 40, paddingVertical: 15,
  },
  dockGroceryText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#FFF', letterSpacing: 0.5 },

  // Ingredient collapse / expand
  ingredientFadeWrap: {
    marginTop: -180,
    height: 180,
  },
  ingredientFade: {
    ...StyleSheet.absoluteFillObject,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  viewAllText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
    letterSpacing: 0.3,
  },

  // More actions bottom sheet
  sheetContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 8,
  },
  sheetRowText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 17,
    color: C.charcoal,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.hairline,
    marginVertical: 4,
  },
});
