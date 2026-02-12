import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { aiService } from '@/services/ai.service';
import { useRecipeStore } from '@/stores/recipeStore';
import { useUsageStore } from '@/stores/usageStore';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import { getRecipeImage } from '@/utils/recipePlaceholders';
import { getIngredientEmoji } from '@/utils/ingredientEmojis';
import { storeData, storeImage } from '@/utils/imageCache';

// ============================================================
// DESIGN TOKENS — Matching Recipe Detail Screen
// ============================================================

const C = {
  bg: '#FAFAF8',
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  goldHairline: 'rgba(212, 175, 55, 0.25)',
  glass: 'rgba(255, 255, 255, 0.85)',
  cardBg: '#F5F3EE',
  olive: '#6B8E23',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

// ============================================================
// TYPES
// ============================================================

interface IngredientItem {
  name: string;
  quantity?: string;
  emoji?: string;
  category?: string;
  selected: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  recipes?: any[];
}

// ============================================================
// COOKING VIBES — Time-Aware Mood Selector
// ============================================================

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

interface VibeOption {
  icon: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
  prompt: string;
}

const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();
  if (hour < 11) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

const VIBES: Record<TimeOfDay, VibeOption[]> = {
  morning: [
    { icon: '☀️', title: 'Quick Breakfast', subtitle: 'Fast & energizing', gradient: ['#F6D365', '#FDA085'], prompt: 'Suggest a quick breakfast I can make in under 15 minutes. Something energizing to start my day.' },
    { icon: '🥑', title: 'Healthy Start', subtitle: 'Nutritious & light', gradient: ['#84FAB0', '#8FD3F4'], prompt: 'I want a healthy, nutritious breakfast. Focus on whole foods, good protein, and something that will keep me full.' },
    { icon: '🥞', title: 'Weekend Brunch', subtitle: 'Indulgent & lazy', gradient: ['#E0C3FC', '#8EC5FC'], prompt: 'Suggest an indulgent weekend brunch recipe. Something special and a little fancy, worth spending time on.' },
    { icon: '🎲', title: 'Surprise Me', subtitle: "Chef's pick", gradient: ['#D4AF37', '#C66E4E'], prompt: 'Surprise me! Pick any breakfast dish from any cuisine in the world. Make it something I probably haven\'t tried before.' },
  ],
  afternoon: [
    { icon: '⚡', title: 'Quick & Easy', subtitle: 'Ready in 20 min', gradient: ['#FA709A', '#FEE140'], prompt: 'I need something quick for lunch, ready in about 20 minutes. Something satisfying but not too heavy.' },
    { icon: '🥗', title: 'Light & Fresh', subtitle: 'Crisp & vibrant', gradient: ['#84FAB0', '#8FD3F4'], prompt: 'Suggest a light, fresh lunch. Think salads, bowls, or wraps with bright flavors and lots of veggies.' },
    { icon: '🌮', title: 'Street Food', subtitle: 'Bold flavors', gradient: ['#F093FB', '#F5576C'], prompt: 'I\'m craving street food vibes! Suggest something with bold, punchy flavors — tacos, banh mi, kebabs, anything exciting.' },
    { icon: '🎲', title: 'Surprise Me', subtitle: "Chef's pick", gradient: ['#D4AF37', '#C66E4E'], prompt: 'Surprise me with a random lunch from any cuisine in the world! Make it something unexpected and delicious.' },
  ],
  evening: [
    { icon: '🍷', title: 'Date Night', subtitle: 'Impressive & elegant', gradient: ['#667EEA', '#764BA2'], prompt: 'Suggest an impressive date night dinner. Something elegant and restaurant-quality that I can make at home.' },
    { icon: '🍝', title: 'Comfort Food', subtitle: 'Warm & cozy', gradient: ['#F6D365', '#FDA085'], prompt: 'I want the ultimate comfort food for tonight. Something warm, hearty, and deeply satisfying.' },
    { icon: '🌍', title: 'World Tour', subtitle: 'New cuisine', gradient: ['#4FACFE', '#00F2FE'], prompt: 'Take me on a world tour! Suggest a dinner recipe from a cuisine I might not have tried — something authentic and exciting.' },
    { icon: '🎲', title: 'Surprise Me', subtitle: "Chef's pick", gradient: ['#D4AF37', '#C66E4E'], prompt: 'Surprise me! Pick a dinner dish from anywhere in the world. Make it special and something totally unexpected.' },
  ],
};

const TIME_GREETINGS: Record<TimeOfDay, string> = {
  morning: "Good morning! What sounds good for breakfast today?",
  afternoon: "Good afternoon! Ready to cook something delicious?",
  evening: "Good evening! Let's make tonight's dinner special.",
};

// ============================================================
// VIBE CARD COMPONENT
// ============================================================

interface VibeCardProps {
  vibe: VibeOption;
  index: number;
  onPress: (vibe: VibeOption) => void;
}

function VibeCard({ vibe, index, onPress }: VibeCardProps) {
  const isSurprise = vibe.title === 'Surprise Me';
  const diceRotation = useSharedValue(0);

  useEffect(() => {
    if (isSurprise) {
      diceRotation.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(-12, { duration: 100, easing: Easing.ease }),
            withTiming(12, { duration: 100, easing: Easing.ease }),
            withTiming(-8, { duration: 80, easing: Easing.ease }),
            withTiming(8, { duration: 80, easing: Easing.ease }),
            withTiming(0, { duration: 80, easing: Easing.ease }),
            withTiming(0, { duration: 2500 }),
          ),
          -1,
          false
        )
      );
    }
  }, [isSurprise]);

  const diceAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${diceRotation.value}deg` }],
  }));

  // Use the first gradient color at low opacity for the icon tint
  const iconTint = `${vibe.gradient[0]}18`;

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 80).duration(500).springify()}
      style={styles.vibeCardOuter}
    >
      <Pressable
        style={({ pressed }) => [
          styles.vibeCard,
          pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress(vibe);
        }}
      >
        <View style={[styles.vibeIconWrap, { backgroundColor: iconTint }]}>
          <Animated.View style={isSurprise ? diceAnimStyle : undefined}>
            <Text style={styles.vibeIcon}>{vibe.icon}</Text>
          </Animated.View>
        </View>
        <Text style={styles.vibeTitle}>{vibe.title}</Text>
        <Text style={styles.vibeSubtitle}>{vibe.subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================
// COOKING VIBES SECTION
// ============================================================

interface CookingVibesSectionProps {
  onSelectVibe: (vibe: VibeOption) => void;
}

function CookingVibesSection({ onSelectVibe }: CookingVibesSectionProps) {
  const timeOfDay = getTimeOfDay();
  const vibes = VIBES[timeOfDay];
  const timeLabel = timeOfDay === 'morning' ? 'Morning' : timeOfDay === 'afternoon' ? 'Afternoon' : 'Evening';

  return (
    <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.vibesSection}>
      <View style={styles.vibesSectionHeader}>
        <Text style={styles.vibesLabel}>What's the vibe?</Text>
        <Text style={styles.vibesTimeTag}>{timeLabel}</Text>
      </View>
      <View style={styles.vibesGrid}>
        {vibes.map((vibe, index) => (
          <VibeCard key={vibe.title} vibe={vibe} index={index} onPress={onSelectVibe} />
        ))}
      </View>
    </Animated.View>
  );
}

// ============================================================
// RICH RECIPE CARD COMPONENT
// ============================================================

interface RichRecipeCardProps {
  recipe: any;
  index: number;
  onViewRecipe: (recipe: any) => void;
  onSaveRecipe: (recipe: any) => void;
  isSaving: boolean;
  isSaved: boolean;
}

// Module-level cache so AI images persist across re-renders / message updates
const aiImageCache = new Map<string, string>();

function RichRecipeCard({ recipe, index, onViewRecipe, onSaveRecipe, isSaving, isSaved }: RichRecipeCardProps) {
  const cacheKey = recipe.title?.toLowerCase().trim() || '';
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(aiImageCache.get(cacheKey) || null);

  useEffect(() => {
    if (aiImageUrl || !recipe.title) return;
    if (aiImageCache.has(cacheKey)) {
      setAiImageUrl(aiImageCache.get(cacheKey)!);
      return;
    }
    aiService.generateRecipeImage(recipe.title).then((base64) => {
      const uri = `data:image/png;base64,${base64}`;
      aiImageCache.set(cacheKey, uri);
      setAiImageUrl(uri);
    }).catch(() => {
      const fallback = getRecipeImage(
        recipe.image_url, recipe.title, recipe.cuisine_type,
        recipe.ingredients_you_have, recipe.food_keywords
      );
      setAiImageUrl(fallback);
    });
  }, [cacheKey]);

  // Show placeholder while AI image generates
  if (!aiImageUrl) {
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
        <View style={styles.cardPlaceholder}>
          <ActivityIndicator size="small" color={C.gold} />
          <Text style={styles.cardPlaceholderText}>Preparing {recipe.title}...</Text>
        </View>
      </Animated.View>
    );
  }

  const difficultyLabel = recipe.difficulty === 'beginner' ? 'Easy'
    : recipe.difficulty === 'intermediate' ? 'Medium'
    : recipe.difficulty === 'advanced' ? 'Hard'
    : recipe.difficulty || 'Easy';

  return (
    <Animated.View entering={FadeInDown.delay(index * 120).duration(450).springify()}>
      <Pressable
        style={({ pressed }) => [
          styles.overlayCard,
          pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] },
        ]}
        onPress={() => onViewRecipe(recipe)}
      >
        {/* Full-bleed image */}
        <ExpoImage
          source={{ uri: aiImageUrl }}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={400}
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.3, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Match badge — top left */}
        {recipe.match_score > 0 && (
          <View style={styles.overlayBadge}>
            <Text style={styles.overlayBadgeText}>{recipe.match_score}% match</Text>
          </View>
        )}

        {/* Save button — top right */}
        <Pressable
          style={({ pressed }) => [
            styles.overlaySaveBtn,
            isSaved && styles.overlaySaveBtnSaved,
            pressed && { transform: [{ scale: 0.9 }] },
          ]}
          onPress={() => onSaveRecipe(recipe)}
          disabled={isSaving || isSaved}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons
              name={isSaved ? 'checkmark' : 'bookmark-outline'}
              size={17}
              color={isSaved ? '#FFF' : 'rgba(255,255,255,0.9)'}
            />
          )}
        </Pressable>

        {/* Bottom content overlay */}
        <View style={styles.overlayContent}>
          {recipe.cuisine_type && (
            <Text style={styles.overlayCuisine}>{recipe.cuisine_type}</Text>
          )}
          <Text style={styles.overlayTitle} numberOfLines={2}>{recipe.title}</Text>
          <View style={styles.overlayMeta}>
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.overlayMetaText}>{recipe.total_time_minutes} min</Text>
            <View style={styles.overlayDot} />
            <Text style={styles.overlayMetaText}>{difficultyLabel}</Text>
            {recipe.calories_per_serving > 0 && (
              <>
                <View style={styles.overlayDot} />
                <Ionicons name="flame-outline" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={styles.overlayMetaText}>{recipe.calories_per_serving} cal</Text>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================

interface MessageBubbleProps {
  message: Message;
  onViewRecipe: (recipe: any) => void;
  onSaveRecipe: (recipe: any) => void;
  savingKey: string | null;
  savedKeys: Set<string>;
}

function MessageBubble({ message, onViewRecipe, onSaveRecipe, savingKey, savedKeys }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasRecipes = message.recipes && message.recipes.length > 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      style={[
        styles.messageRow,
        isUser ? styles.messageRowUser : styles.messageRowAssistant,
      ]}
    >
      {!isUser && (
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={['rgba(212, 175, 55, 0.18)', 'rgba(198, 110, 78, 0.12)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name="sparkles" size={14} color={C.gold} />
        </View>
      )}

      <View
        style={[
          styles.messageBubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          hasRecipes && styles.bubbleWithRecipes,
        ]}
      >
        <Text style={[styles.messageText, { color: isUser ? '#FFF' : C.charcoal }]}>
          {message.content}
        </Text>

        {hasRecipes && (
          <View style={styles.recipesWrap}>
            {message.recipes!.map((recipe, index) => {
              const key = `${message.id}_${index}`;
              return (
                <RichRecipeCard
                  key={key}
                  recipe={recipe}
                  index={index}
                  onViewRecipe={onViewRecipe}
                  onSaveRecipe={onSaveRecipe}
                  isSaving={savingKey === key}
                  isSaved={savedKeys.has(key)}
                />
              );
            })}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function AiChefChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ ingredients?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const { addRecipe } = useRecipeStore();
  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();

  // Parse ingredients
  const parsedIngredients: IngredientItem[] = params.ingredients
    ? JSON.parse(params.ingredients).map((i: any) => ({
        name: i.name || i,
        quantity: i.quantity || 'some',
        emoji: i.emoji || getIngredientEmoji(i.name || i),
        category: i.category,
        selected: true,
      }))
    : [];

  const [ingredients] = useState<IngredientItem[]>(parsedIngredients);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  const timeOfDay = getTimeOfDay();

  const getInitialMessage = () => {
    if (ingredients.length > 0) {
      const names = ingredients.map((i) => i.name);
      const preview = names.slice(0, 3).join(', ');
      const rest = names.length > 3 ? ` & ${names.length - 3} more` : '';
      return `${TIME_GREETINGS[timeOfDay]} You've got ${preview}${rest} — let's see what we can make!`;
    }
    return `${TIME_GREETINGS[timeOfDay]} Pick a vibe below, or tell me what you're in the mood for!`;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: getInitialMessage(),
      timestamp: new Date(),
    },
  ]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleVibe = useCallback(async (vibe: VibeOption) => {
    if (isLoading) return;

    // Gate check for AI chat usage
    const allowed = await checkGate('ai_chat');
    if (!allowed) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `${vibe.icon} ${vibe.title}`,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      await useUsageStore.getState().incrementUsage('ai_chat');
      const ingredientsForAI = getSelectedIngredientsForAI();
      const response = await aiService.chatWithChef(vibe.prompt, ingredientsForAI);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        recipes: response.recipes,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an issue. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [isLoading]);

  const getSelectedIngredientsForAI = () => {
    return ingredients.filter((i) => i.selected).map((i) => `${i.quantity} ${i.name}`);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    // Gate check for AI chat usage
    const allowed = await checkGate('ai_chat');
    if (!allowed) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const messageText = inputText.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      await useUsageStore.getState().incrementUsage('ai_chat');
      const ingredientsForAI = getSelectedIngredientsForAI();
      const response = await aiService.chatWithChef(messageText, ingredientsForAI);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        recipes: response.recipes,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an issue. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const getRecipeImageUrl = useCallback((recipe: any) => {
    const cacheKey = recipe.title?.toLowerCase().trim() || '';
    return aiImageCache.get(cacheKey) || getRecipeImage(
      recipe.image_url,
      recipe.title,
      recipe.cuisine_type,
      recipe.ingredients_you_have,
      recipe.food_keywords
    );
  }, []);

  const handleViewRecipe = useCallback((recipe: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const imageUrl = getRecipeImageUrl(recipe);
    const recipeKey = storeData(recipe);
    const imageKey = storeImage(imageUrl);
    router.push({
      pathname: '/suggested-recipe-detail',
      params: { recipeKey, imageUrl: imageKey, sourceType: 'ai_chef' },
    });
  }, [router, getRecipeImageUrl]);

  const handleSaveRecipe = useCallback(async (recipe: any, messageId: string, index: number) => {
    const key = `${messageId}_${index}`;
    if (savedKeys.has(key) || savingKey) return;

    setSavingKey(key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const imageUrl = getRecipeImageUrl(recipe);

      // Map chat recipe → ExtractedRecipe shape
      const extracted = {
        title: recipe.title,
        description: recipe.description || '',
        cuisine_type: recipe.cuisine_type,
        difficulty: recipe.difficulty || 'beginner',
        total_time_minutes: recipe.total_time_minutes || 30,
        active_time_minutes: recipe.total_time_minutes || 30,
        servings: recipe.servings || 4,
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || recipe.preview_steps?.map((s: string, i: number) => ({
          step_number: i + 1,
          instruction: s,
        })) || [],
        nutrition_estimate: recipe.calories_per_serving ? {
          calories: recipe.calories_per_serving,
        } : undefined,
      };

      await addRecipe(extracted as any, undefined, imageUrl, 'ai_chef');

      setSavedKeys((prev) => new Set(prev).add(key));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save recipe');
    } finally {
      setSavingKey(null);
    }
  }, [addRecipe, savedKeys, savingKey]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <BlurView intensity={90} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBackBtn}>
            <Ionicons name="chevron-back" size={22} color={C.charcoal} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerIcon}>
              <Ionicons name="sparkles" size={18} color={C.gold} />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Chef</Text>
              <Text style={styles.headerSubtitle}>Your personal chef</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setMessages([{ id: '0', role: 'assistant', content: getInitialMessage(), timestamp: new Date() }]);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={8}
            style={styles.headerActionBtn}
          >
            <Ionicons name="refresh-outline" size={20} color={C.muted} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerGoldLine} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onViewRecipe={handleViewRecipe}
            onSaveRecipe={(recipe) => {
              const idx = message.recipes?.indexOf(recipe) ?? 0;
              handleSaveRecipe(recipe, message.id, idx);
            }}
            savingKey={savingKey}
            savedKeys={savedKeys}
          />
        ))}

        {isLoading && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.loadingRow}>
            <View style={styles.loadingDots}>
              <ActivityIndicator size="small" color={C.gold} />
            </View>
            <Text style={styles.loadingText}>Cooking up ideas...</Text>
          </Animated.View>
        )}

        {messages.length === 1 && !isLoading && (
          <CookingVibesSection onSelectVibe={handleVibe} />
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Usage Limit Sheet */}
      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputContainer, { paddingBottom: isKeyboardVisible ? 12 : insets.bottom + 12 }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={styles.inputHairline} />
          <View style={styles.inputInner}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything about recipes..."
              placeholderTextColor={C.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              <Ionicons name="send" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ──
  header: {
    overflow: 'hidden',
  },
  headerInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 17,
    color: C.charcoal,
  },
  headerSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 10,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  headerGoldLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.goldHairline,
  },

  // ── Messages ──
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
  } as any,
  bubbleWithRecipes: {
    maxWidth: '92%',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  bubbleUser: {
    backgroundColor: C.charcoal,
    borderBottomRightRadius: 6,
  },
  bubbleAssistant: {
    backgroundColor: C.ivory,
    borderWidth: 0.5,
    borderColor: C.hairline,
    borderBottomLeftRadius: 6,
    ...SHADOW_SOFT,
    shadowOpacity: 0.03,
    shadowRadius: 12,
  },
  messageText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
  },

  // ── Recipes in Messages ──
  recipesWrap: {
    marginTop: 12,
    gap: 14,
  },

  // ── Overlay Recipe Card (matching home screen) ──
  overlayCard: {
    height: 220,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E8E6E3',
    ...SHADOW_SOFT,
  },
  overlayBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(107, 142, 35, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  overlayBadgeText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#FFF',
  },
  overlaySaveBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlaySaveBtnSaved: {
    backgroundColor: C.olive,
  },
  overlayContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  overlayCuisine: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  overlayTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  overlayMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  overlayMetaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  overlayDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },

  // ── Card Placeholder ──
  cardPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  cardPlaceholderText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
    flex: 1,
  },

  // ── Loading ──
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingDots: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
    fontStyle: 'italic',
  },

  // ── Cooking Vibes ──
  vibesSection: {
    marginTop: 8,
  },
  vibesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  vibesLabel: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },
  vibesTimeTag: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.terracotta,
  },
  vibesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeCardOuter: {
    width: '47%',
  },
  vibeCard: {
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 0.5,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
    shadowOpacity: 0.04,
  },
  vibeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  vibeIcon: {
    fontSize: 22,
  },
  vibeTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.charcoal,
  },
  vibeSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: C.muted,
  },

  // ── Input ──
  inputContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 10,
  },
  inputHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.goldHairline,
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.charcoal,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.terracotta,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
