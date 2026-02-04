import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Pressable,
  TextInput,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useRecipeStore } from '@/stores/recipeStore';
import type { Recipe, Ingredient, RecipeStep, IngredientCategory, RecipeDifficulty } from '@/utils/types';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  bg: '#FAFAF8',
  white: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#9A958C',
  border: '#EEEBE6',
  inputBg: '#FFFFFF',
  danger: '#EF4444',
  success: '#22C55E',
};

const DIFFICULTIES: { value: RecipeDifficulty; label: string; icon: string }[] = [
  { value: 'beginner', label: 'Easy', icon: '1' },
  { value: 'intermediate', label: 'Medium', icon: '2' },
  { value: 'advanced', label: 'Hard', icon: '3' },
];

// ============================================================
// COMPONENT
// ============================================================

export default function EditRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { recipes, updateRecipe } = useRecipeStore();
  const scrollRef = useRef<ScrollView>(null);

  const recipe = recipes.find(r => r.id === recipeId);

  // Form state
  const [title, setTitle] = useState(recipe?.title || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [difficulty, setDifficulty] = useState<RecipeDifficulty>(recipe?.difficulty || 'beginner');
  const [prepTime, setPrepTime] = useState(recipe?.prep_time_minutes?.toString() || '');
  const [cookTime, setCookTime] = useState(recipe?.cook_time_minutes?.toString() || '');
  const [servings, setServings] = useState(recipe?.original_servings?.toString() || '4');
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe?.ingredients || []);
  const [steps, setSteps] = useState<RecipeStep[]>(recipe?.steps || []);

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const markChanged = useCallback(() => { if (!hasChanges) setHasChanges(true); }, [hasChanges]);

  // ── Ingredient helpers ──
  const updateIngredient = useCallback((index: number, text: string) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, name: text } : ing));
    markChanged();
  }, [markChanged]);

  const addIngredient = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIngredients(prev => [...prev, { name: '', amount: undefined, unit: undefined, category: 'other' as IngredientCategory }]);
    markChanged();
  }, [markChanged]);

  const removeIngredient = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIngredients(prev => prev.filter((_, i) => i !== index));
    markChanged();
  }, [markChanged]);

  // ── Step helpers ──
  const updateStep = useCallback((index: number, text: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, instruction: text } : s));
    markChanged();
  }, [markChanged]);

  const addStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSteps(prev => [...prev, { step_number: prev.length + 1, instruction: '' }]);
    markChanged();
  }, [markChanged]);

  const removeStep = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })));
    markChanged();
  }, [markChanged]);

  // ── Save ──
  const handleSave = async () => {
    if (!recipe) return;
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a recipe title.');
      return;
    }
    if (ingredients.filter(i => i.name.trim()).length === 0) {
      Alert.alert('Missing Ingredients', 'Add at least one ingredient.');
      return;
    }
    if (steps.filter(s => s.instruction.trim()).length === 0) {
      Alert.alert('Missing Steps', 'Add at least one instruction step.');
      return;
    }

    setIsSaving(true);
    try {
      const prep = parseInt(prepTime) || 0;
      const cook = parseInt(cookTime) || 0;

      const updates: Partial<Recipe> = {
        title: title.trim(),
        description: description.trim() || undefined,
        difficulty,
        prep_time_minutes: prep || undefined,
        cook_time_minutes: cook || undefined,
        total_time_minutes: prep + cook || recipe.total_time_minutes,
        original_servings: parseInt(servings) || recipe.original_servings,
        current_servings: parseInt(servings) || recipe.current_servings,
        ingredients: ingredients.filter(i => i.name.trim()),
        steps: steps.filter(s => s.instruction.trim()).map((s, i) => ({ ...s, step_number: i + 1 })),
      };

      await updateRecipe(recipe.id, updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Back ──
  const handleBack = () => {
    if (hasChanges) {
      Alert.alert('Discard Changes?', 'You have unsaved changes.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  if (!recipe) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={C.muted} />
        <Text style={styles.errorText}>Recipe not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={C.charcoal} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Recipe</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.card}>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={v => { setTitle(v); markChanged(); }}
              placeholder="Recipe name"
              placeholderTextColor={C.muted}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.descInput}
              value={description}
              onChangeText={v => { setDescription(v); markChanged(); }}
              placeholder="Add a short description (optional)"
              placeholderTextColor={C.muted}
              multiline
            />
          </View>

          {/* Quick Settings */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>QUICK SETTINGS</Text>

            {/* Difficulty */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Difficulty</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTIES.map(d => (
                  <Pressable
                    key={d.value}
                    style={[styles.difficultyBtn, difficulty === d.value && styles.difficultyBtnActive]}
                    onPress={() => { setDifficulty(d.value); markChanged(); }}
                  >
                    <Text style={[styles.difficultyText, difficulty === d.value && styles.difficultyTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Time & Servings */}
            <View style={styles.quickRow}>
              <View style={styles.quickItem}>
                <Ionicons name="time-outline" size={18} color={C.muted} />
                <TextInput
                  style={styles.quickInput}
                  value={prepTime}
                  onChangeText={v => { setPrepTime(v); markChanged(); }}
                  placeholder="Prep"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                />
                <Text style={styles.quickUnit}>min</Text>
              </View>
              <View style={styles.quickItem}>
                <Ionicons name="flame-outline" size={18} color={C.muted} />
                <TextInput
                  style={styles.quickInput}
                  value={cookTime}
                  onChangeText={v => { setCookTime(v); markChanged(); }}
                  placeholder="Cook"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                />
                <Text style={styles.quickUnit}>min</Text>
              </View>
              <View style={styles.quickItem}>
                <Ionicons name="people-outline" size={18} color={C.muted} />
                <TextInput
                  style={styles.quickInput}
                  value={servings}
                  onChangeText={v => { setServings(v); markChanged(); }}
                  placeholder="4"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                />
                <Text style={styles.quickUnit}>serv</Text>
              </View>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>INGREDIENTS</Text>
              <Text style={styles.cardCount}>{ingredients.filter(i => i.name.trim()).length}</Text>
            </View>

            {ingredients.map((ing, i) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.listBullet} />
                <TextInput
                  style={styles.listInput}
                  value={ing.name}
                  onChangeText={v => updateIngredient(i, v)}
                  placeholder="e.g. 2 cups flour"
                  placeholderTextColor={C.muted}
                />
                <TouchableOpacity onPress={() => removeIngredient(i)} hitSlop={8}>
                  <Ionicons name="close" size={20} color={C.muted} />
                </TouchableOpacity>
              </View>
            ))}

            <Pressable style={styles.addItemBtn} onPress={addIngredient}>
              <Ionicons name="add" size={20} color={C.terracotta} />
              <Text style={styles.addItemText}>Add ingredient</Text>
            </Pressable>
          </View>

          {/* Steps */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>INSTRUCTIONS</Text>
              <Text style={styles.cardCount}>{steps.filter(s => s.instruction.trim()).length}</Text>
            </View>

            {steps.map((step, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <TextInput
                  style={styles.stepInput}
                  value={step.instruction}
                  onChangeText={v => updateStep(i, v)}
                  placeholder={`Step ${i + 1}...`}
                  placeholderTextColor={C.muted}
                  multiline
                />
                <TouchableOpacity onPress={() => removeStep(i)} hitSlop={8} style={styles.stepRemove}>
                  <Ionicons name="close" size={20} color={C.muted} />
                </TouchableOpacity>
              </View>
            ))}

            <Pressable style={styles.addItemBtn} onPress={addStep}>
              <Ionicons name="add" size={20} color={C.terracotta} />
              <Text style={styles.addItemText}>Add step</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Save Button */}
      <View style={[styles.floatingFooter, { paddingBottom: insets.bottom + 16 }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            isSaving && styles.saveBtnDisabled,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Text style={styles.saveBtnText}>Saving...</Text>
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </Pressable>
      </View>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  // Error state
  errorText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
    color: C.muted,
  },
  errorBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.charcoal,
    borderRadius: 24,
  },
  errorBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#FFF',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },

  // Scroll
  scroll: {
    padding: 16,
    gap: 16,
  },

  // Card
  card: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: C.muted,
    letterSpacing: 1,
    marginBottom: 16,
  },
  cardCount: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: C.terracotta,
    backgroundColor: 'rgba(198, 110, 78, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },

  // Title input
  titleInput: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: C.charcoal,
    marginBottom: 8,
    padding: 0,
  },
  descInput: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: C.charcoal,
    lineHeight: 22,
    padding: 0,
    minHeight: 44,
  },

  // Settings
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
    marginBottom: 10,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  difficultyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: 'center',
  },
  difficultyBtnActive: {
    backgroundColor: C.charcoal,
  },
  difficultyText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.charcoal,
  },
  difficultyTextActive: {
    color: '#FFF',
  },

  // Quick row
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  quickInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.charcoal,
    padding: 0,
    textAlign: 'center',
  },
  quickUnit: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
  },

  // List items (ingredients)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  listBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.terracotta,
    opacity: 0.4,
  },
  listInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.charcoal,
    padding: 0,
  },

  // Step items
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: C.charcoal,
  },
  stepInput: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.charcoal,
    lineHeight: 22,
    padding: 0,
    minHeight: 28,
  },
  stepRemove: {
    paddingTop: 4,
  },

  // Add item button
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
  },
  addItemText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: C.terracotta,
  },

  // Floating footer
  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    overflow: 'hidden',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFF',
  },
});
