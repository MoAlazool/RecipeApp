import React, { forwardRef, useCallback, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { aiService } from '@/services/ai.service';
import { useRecipeStore } from '@/stores/recipeStore';
import { previewRecipe } from '@/utils/previewRecipe';
import type { Recipe, ExtractedRecipe } from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FDFCFA',
  charcoal: '#1A1510',
  gold: '#C9B06B',
  goldSoft: 'rgba(201, 176, 107, 0.08)',
  goldBorder: 'rgba(201, 176, 107, 0.20)',
  muted: '#A8A196',
  hairline: 'rgba(26, 21, 16, 0.05)',
  glass: 'rgba(255, 255, 255, 0.92)',
  cardBg: 'rgba(26, 21, 16, 0.02)',
};

// ============================================================
// TYPES
// ============================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  recipe?: ExtractedRecipe;
  timestamp: number;
}

interface AskAIChefSheetProps {
  recipe: Recipe;
  onPreviewOpen?: () => void;
}

// ============================================================
// INSPIRATION PILLS
// ============================================================

const INSPIRATIONS = [
  { label: 'Spice it up', prompt: 'Make this recipe spicier with bolder heat and flavors' },
  { label: 'Lighten it up', prompt: 'Make a lighter, lower-calorie version of this recipe' },
  { label: 'Under 15 min', prompt: 'Simplify this recipe to be ready in under 15 minutes' },
  { label: 'Gluten-free', prompt: 'Make this recipe completely gluten-free' },
  { label: 'Protein packed', prompt: 'Add more protein-rich ingredients to this recipe' },
  { label: 'Extra greens', prompt: 'Pack this recipe with more vegetables and greens' },
  { label: 'Fully plant-based', prompt: 'Convert this recipe to a fully vegan plant-based version' },
  { label: 'Skip the dairy', prompt: 'Remove all dairy and make this dairy-free' },
  { label: 'Low-carb swap', prompt: 'Replace high-carb ingredients with low-carb alternatives' },
  { label: 'Family-style', prompt: 'Make this recipe more kid and family friendly' },
  { label: 'Keto-friendly', prompt: 'Convert this to a keto-friendly recipe' },
  { label: 'Add some crunch', prompt: 'Add crunchy textures and toppings to this recipe' },
  { label: 'Sweet spin', prompt: 'Add a sweet element or dessert twist to this recipe' },
  { label: 'Bright & citrusy', prompt: 'Add fresh citrus and bright zesty flavors' },
  { label: 'Breakfast remix', prompt: 'Transform this into a breakfast dish' },
  { label: 'One-pot version', prompt: 'Convert this to a simple one-pot meal' },
  { label: 'Budget swap', prompt: 'Use cheaper, more affordable substitute ingredients' },
  { label: 'Restaurant-level', prompt: 'Elevate this to a gourmet restaurant-quality version' },
  { label: 'Translate عربي', prompt: 'Translate all steps and ingredients to Arabic (العربية)' },
  { label: 'Simplify steps', prompt: 'Simplify all steps to be shorter and easier to follow' },
  { label: 'Add more steps', prompt: 'Break down the steps into more detailed smaller steps for beginners' },
];

// ============================================================
// TYPING INDICATOR
// ============================================================

function TypingIndicator() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  React.useEffect(() => {
    dot1.value = withRepeat(
      withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
      -1, false
    );
    setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
        -1, false
      );
    }, 150);
    setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(withTiming(1, { duration: 400 }), withTiming(0.3, { duration: 400 })),
        -1, false
      );
    }, 300);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const s2 = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const s3 = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={styles.typingRow}>
      <View style={styles.loadingBubble}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.dot, s1]} />
          <Animated.View style={[styles.dot, s2]} />
          <Animated.View style={[styles.dot, s3]} />
        </View>
      </View>
    </View>
  );
}

// ============================================================
// RECIPE CARD — shows the AI-generated recipe preview
// ============================================================

function RecipeCard({
  recipe,
  onPress,
  onSave,
  onRetry,
  isSaving,
  isSaved,
}: {
  recipe: ExtractedRecipe;
  onPress: () => void;
  onSave: () => void;
  onRetry: () => void;
  isSaving: boolean;
  isSaved: boolean;
}) {
  const time = recipe.total_time_minutes;
  const timeLabel = time < 60 ? `${time}m` : `${Math.round(time / 60 * 2) / 2}hr`;

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.recipeCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        onPress={onPress}
      >
        {/* Header */}
        <View style={styles.recipeCardHeader}>
          <Ionicons name="sparkles" size={14} color={C.gold} />
          <Text style={styles.recipeCardLabel}>New Recipe</Text>
        </View>

        {/* Title */}
        <Text style={styles.recipeCardTitle}>{recipe.title}</Text>
        {recipe.description ? (
          <Text style={styles.recipeCardDesc} numberOfLines={2}>{recipe.description}</Text>
        ) : null}

        {/* Badges */}
        <View style={styles.recipeCardBadges}>
          {time > 0 && (
            <View style={styles.badge}>
              <Ionicons name="time-outline" size={13} color={C.muted} />
              <Text style={styles.badgeText}>{timeLabel}</Text>
            </View>
          )}
          {recipe.servings > 0 && (
            <View style={styles.badge}>
              <Ionicons name="people-outline" size={13} color={C.muted} />
              <Text style={styles.badgeText}>{recipe.servings}</Text>
            </View>
          )}
          {recipe.difficulty && (
            <View style={styles.badge}>
              <Ionicons name="speedometer-outline" size={13} color={C.muted} />
              <Text style={styles.badgeText}>
                {recipe.difficulty === 'beginner' ? 'Easy' : recipe.difficulty === 'intermediate' ? 'Medium' : 'Hard'}
              </Text>
            </View>
          )}
          {recipe.nutrition_estimate?.calories ? (
            <View style={styles.badge}>
              <Ionicons name="flame-outline" size={13} color={C.muted} />
              <Text style={styles.badgeText}>{recipe.nutrition_estimate.calories} cal</Text>
            </View>
          ) : null}
        </View>

        {/* Ingredients preview */}
        <Text style={styles.recipeCardIngCount}>
          {recipe.ingredients.length} ingredients · {recipe.steps.length} steps
        </Text>

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap to view full recipe</Text>
          <Ionicons name="chevron-forward" size={14} color={C.muted} />
        </View>
      </Pressable>

      {/* Action buttons */}
      <View style={styles.cardActions}>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, isSaved && styles.saveBtnSaved, pressed && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={isSaving || isSaved}
        >
          <Ionicons name={isSaved ? 'checkmark-circle' : 'bookmark-outline'} size={16} color="#FFF" />
          <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save Recipe'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.7 }]}
          onPress={onRetry}
        >
          <Ionicons name="refresh-outline" size={16} color={C.charcoal} />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================
// FOOTER INPUT — isolated so renderFooter stays stable
// ============================================================

interface FooterInputProps {
  sendRef: React.RefObject<((text: string) => void) | null>;
  loadingRef: React.RefObject<boolean>;
}

const MIN_INPUT_LENGTH = 5; // Minimum characters required

function FooterInput({ sendRef, loadingRef }: FooterInputProps) {
  const [text, setText] = useState('');
  const [, forceRender] = useState(0);

  React.useEffect(() => {
    forceRender(n => n + 1);
  }, [loadingRef.current]);

  const isLoading = loadingRef.current ?? false;
  const trimmedText = text.trim();
  const isValidInput = trimmedText.length >= MIN_INPUT_LENGTH;

  const handleSubmit = useCallback(() => {
    const val = text.trim();
    if (val.length < MIN_INPUT_LENGTH || loadingRef.current) return;
    sendRef.current?.(val);
    setText('');
  }, [text, sendRef, loadingRef]);

  return (
    <View style={styles.inputRow}>
      <BottomSheetTextInput
        style={styles.textInput}
        placeholder="Describe what you want to change..."
        placeholderTextColor={C.muted}
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="send"
        editable={!isLoading}
      />
      <Pressable
        style={({ pressed }) => [
          styles.sendBtn,
          (!isValidInput || isLoading) && styles.sendBtnDisabled,
          pressed && { opacity: 0.7 },
        ]}
        onPress={handleSubmit}
        disabled={!isValidInput || isLoading}
      >
        <Ionicons name="arrow-up" size={20} color="#FFF" />
      </Pressable>
    </View>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const SNAP_POINTS = ['50%', '90%'];

const AskAIChefSheet = forwardRef<BottomSheetModal, AskAIChefSheetProps>(
  ({ recipe, onPreviewOpen }, ref) => {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { addRecipe } = useRecipeStore();
    const scrollRef = useRef<ScrollView>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [activeInspiration, setActiveInspiration] = useState<string | null>(null);
    const lastRequestRef = useRef('');

    // Stable refs for footer
    const sendRef = useRef<((text: string) => void) | null>(null);
    const loadingRef = useRef(false);

    const scrollToEnd = useCallback(() => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }, []);

    const recipeContext = useCallback(() => ({
      title: recipe.title,
      ingredients: recipe.ingredients.map(i => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        category: i.category,
      })),
      steps: recipe.steps.map(s => ({
        step_number: s.step_number,
        instruction: s.instruction,
        duration_minutes: s.duration_minutes,
        temperature: s.temperature,
      })),
      description: recipe.description,
      cuisine_type: recipe.cuisine_type,
      servings: recipe.current_servings,
    }), [recipe]);

    const doModify = useCallback(
      async (prompt: string) => {
        lastRequestRef.current = prompt;
        setIsLoading(true);
        loadingRef.current = true;
        scrollToEnd();

        try {
          const modified = await aiService.modifyRecipe(prompt, recipeContext());

          const aiMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: modified.title,
            recipe: modified,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
          const errMsg: ChatMessage = {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: err?.message || "Couldn't generate that variation. Try a different request.",
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, errMsg]);
        } finally {
          setIsLoading(false);
          loadingRef.current = false;
          setActiveInspiration(null);
          scrollToEnd();
        }
      },
      [recipeContext, scrollToEnd]
    );

    // Called from typed input — shows user bubble
    const sendTypedMessage = useCallback(
      async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: ChatMessage = {
          id: `u-${Date.now()}`,
          role: 'user',
          content: text.trim(),
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        doModify(text.trim());
      },
      [isLoading, doModify]
    );

    sendRef.current = sendTypedMessage;

    const handleSaveRecipe = useCallback(
      async (msgId: string, extracted: ExtractedRecipe) => {
        if (isSaving || savedIds.has(msgId)) return;
        setIsSaving(true);
        try {
          await addRecipe(extracted, undefined, recipe.thumbnail_url, 'ai_chef');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSavedIds(prev => new Set(prev).add(msgId));
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Failed to save recipe');
        } finally {
          setIsSaving(false);
        }
      },
      [addRecipe, recipe.thumbnail_url, isSaving, savedIds]
    );

    const handleCardPress = useCallback(
      (extracted: ExtractedRecipe) => {
        previewRecipe.set(extracted, recipe.thumbnail_url);
        onPreviewOpen?.();
        (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
        setTimeout(() => {
          router.push('/recipe/__preview__' as any);
        }, 250);
      },
      [recipe.thumbnail_url, router, ref, onPreviewOpen]
    );

    const handleRetry = useCallback(() => {
      if (lastRequestRef.current) {
        doModify(lastRequestRef.current);
      }
    }, [doModify]);

    // Pill tap — no user bubble, just highlight pill + loading
    const handleInspirationTap = useCallback(
      (label: string, prompt: string) => {
        if (isLoading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveInspiration(label);
        doModify(prompt);
      },
      [isLoading, doModify]
    );

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    const renderFooter = useCallback(
      (props: any) => (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <FooterInput sendRef={sendRef} loadingRef={loadingRef} />
          </View>
        </BottomSheetFooter>
      ),
      [insets.bottom]
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={SNAP_POINTS}
        index={0}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.sheetBg}
      >
        {/* Handle */}
        <View style={styles.handle}>
          <Ionicons name="sparkles" size={18} color={C.gold} />
          <Text style={styles.handleTitle}>AI Chef</Text>
        </View>

        {/* Scrollable Content */}
        <BottomSheetScrollView
          ref={scrollRef as any}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Inspiration Section */}
          <Text style={styles.inspireLabel}>Need some inspiration? Try these</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.inspireRow}
          >
            {INSPIRATIONS.map((item, i) => {
              const isActive = activeInspiration === item.label;
              return (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.inspirePill,
                    isActive && styles.inspirePillActive,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleInspirationTap(item.label, item.prompt)}
                  disabled={isLoading}
                >
                  <Text style={[styles.inspirePillText, isActive && styles.inspirePillTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Active inspiration indicator */}
          {activeInspiration && isLoading && (
            <View style={styles.activeInspirationRow}>
              <Ionicons name="sparkles" size={14} color={C.gold} />
              <Text style={styles.activeInspirationText}>
                Working on: {activeInspiration}...
              </Text>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Messages / Results */}
          <View style={styles.chatArea}>
            {messages.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="restaurant-outline" size={28} color="rgba(26,21,16,0.12)" />
                <Text style={styles.emptyText}>
                  Ask me anything! Edit steps, change ingredients, translate to another language, add tips, simplify, or completely transform this recipe.
                </Text>
              </View>
            )}

            {messages.map(msg => {
              if (msg.role === 'user') {
                return (
                  <View key={msg.id} style={styles.userRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userText}>{msg.content}</Text>
                    </View>
                  </View>
                );
              }

              // Assistant message — with or without recipe
              if (msg.recipe) {
                return (
                  <RecipeCard
                    key={msg.id}
                    recipe={msg.recipe}
                    onPress={() => handleCardPress(msg.recipe!)}
                    onSave={() => handleSaveRecipe(msg.id, msg.recipe!)}
                    onRetry={handleRetry}
                    isSaving={isSaving}
                    isSaved={savedIds.has(msg.id)}
                  />
                );
              }

              // Text-only assistant message (errors)
              return (
                <View key={msg.id} style={styles.aiRow}>
                  <View style={styles.loadingBubble}>
                    <Text style={styles.aiText}>{msg.content}</Text>
                  </View>
                </View>
              );
            })}

            {isLoading && <TypingIndicator />}
          </View>

          {/* Bottom spacer for footer */}
          <View style={{ height: 80 + insets.bottom }} />
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

AskAIChefSheet.displayName = 'AskAIChefSheet';
export default AskAIChefSheet;

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: C.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: C.goldBorder,
    width: 36,
  },
  handle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  handleTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 17,
    color: C.charcoal,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Inspiration
  inspireLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.muted,
    marginBottom: 10,
    marginTop: 4,
  },
  inspireRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  inspirePill: {
    backgroundColor: C.goldSoft,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  inspirePillText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.gold,
  },
  inspirePillActive: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },
  inspirePillTextActive: {
    color: '#FFF',
  },

  // Active inspiration indicator
  activeInspirationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  activeInspirationText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: C.gold,
    fontStyle: 'italic',
  },

  // Divider
  divider: {
    height: 0.5,
    backgroundColor: C.goldBorder,
    marginVertical: 16,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 260,
  },

  // Chat
  chatArea: {
    gap: 14,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingLeft: 48,
  },
  userBubble: {
    backgroundColor: 'rgba(26, 21, 16, 0.06)',
    borderRadius: 18,
    borderTopRightRadius: 4,
    padding: 14,
  },
  userText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: C.charcoal,
  },
  aiRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingRight: 48,
  },
  aiText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: C.charcoal,
  },

  // Recipe Card
  recipeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  recipeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  recipeCardLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 11,
    color: C.gold,
    letterSpacing: 0.5,
  },
  recipeCardTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: C.charcoal,
    marginBottom: 4,
  },
  recipeCardDesc: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    color: C.muted,
    lineHeight: 19,
    marginBottom: 12,
  },
  recipeCardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.goldSoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },
  recipeCardIngCount: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginBottom: 12,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: C.hairline,
  },
  tapHintText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: C.muted,
  },

  // Card action buttons
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: C.gold,
    borderRadius: 28,
    paddingVertical: 13,
  },
  saveBtnSaved: {
    backgroundColor: '#8CB88C',
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#FFF',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  retryBtnText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
  },

  // Loading / typing
  typingRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingRight: 48,
  },
  loadingBubble: {
    backgroundColor: C.goldSoft,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.goldBorder,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.gold,
  },

  // Footer - solid grounded style
  footer: {
    backgroundColor: C.ivory,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 21, 16, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.cardBg,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.charcoal,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(201, 176, 107, 0.25)',
  },
});
