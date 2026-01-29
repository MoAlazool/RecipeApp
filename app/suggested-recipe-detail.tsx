import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecipeStore } from '@/stores/recipeStore';
import { aiService } from '@/services/ai.service';
import type { SuggestedRecipe, ExtractedRecipe, Ingredient, RecipeStep } from '@/utils/types';

const COLORS = {
  primary: '#FF4B2B',
  olive: '#606C38',
  charcoal: '#121417',
  backgroundLight: '#FDFDFD',
  backgroundDark: '#1A1210',
};

export default function SuggestedRecipeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    recipe: string;
    sourceUrl?: string;
    imageUrl?: string;
    sourceType?: string;
  }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { addRecipe } = useRecipeStore();

  const [suggestedRecipe, setSuggestedRecipe] = useState<SuggestedRecipe | null>(null);
  const [fullRecipe, setFullRecipe] = useState<ExtractedRecipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecipeDetails();
  }, []);

  const loadRecipeDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!params.recipe) {
        throw new Error('No recipe data provided');
      }

      // Parse the suggested recipe from params
      const parsed: SuggestedRecipe = JSON.parse(params.recipe);
      setSuggestedRecipe(parsed);

      // Generate full recipe details using AI
      // Convert preview_steps and basic info to full recipe
      const fullRecipeData = await aiService.expandRecipeFromSuggestion(parsed);
      setFullRecipe(fullRecipeData);
    } catch (err: any) {
      console.error('Failed to load recipe details:', err);
      setError(err.message || 'Failed to load recipe details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToFavorites = async () => {
    if (!fullRecipe || !suggestedRecipe) return;

    try {
      setIsSaving(true);

      // Convert to Recipe format and save (with image URL and source type)
      const savedRecipe = await addRecipe(
        fullRecipe,
        params.sourceUrl,
        params.imageUrl,
        params.sourceType as any
      );

      setIsSaved(true);
      Alert.alert(
        'Saved!',
        'Recipe added to your collection',
        [
          {
            text: 'View Collection',
            onPress: () => router.push('/(tabs)'),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCookNow = () => {
    // Could navigate to cooking mode if recipe is saved
    Alert.alert(
      'Cook This Recipe?',
      'Save this recipe to your collection to start cooking mode',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Save & Cook',
          onPress: async () => {
            await handleSaveToFavorites();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.loadingText, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
          Loading recipe details...
        </Text>
      </View>
    );
  }

  if (error || !fullRecipe || !suggestedRecipe) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight }]}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
        <Text style={[styles.errorText, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
          {error || 'Failed to load recipe'}
        </Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const inStockIngredients = suggestedRecipe.ingredients_you_have || [];
  const neededIngredients = suggestedRecipe.ingredients_you_need || [];

  return (
    <View style={[styles.container, { backgroundColor: isDark ? COLORS.backgroundDark : COLORS.backgroundLight }]}>
      {/* Header with Image */}
      <View style={styles.header}>
        <Image
          source={{ uri: params.imageUrl || 'https://via.placeholder.com/400' }}
          style={styles.headerImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
          style={styles.headerGradient}
        />

        {/* Back Button */}
        <Pressable
          style={[styles.headerBackButton, { top: insets.top + 12 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>

        {/* Save Button (Heart) */}
        <Pressable
          style={[
            styles.headerSaveButton,
            { top: insets.top + 12 },
            isSaved && styles.headerSaveButtonActive,
          ]}
          onPress={handleSaveToFavorites}
          disabled={isSaving || isSaved}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={24}
              color="#FFFFFF"
            />
          )}
        </Pressable>

        {/* Recipe Title */}
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{fullRecipe.title}</Text>
          <View style={styles.headerMeta}>
            <View style={styles.metaBadge}>
              <Ionicons name="time-outline" size={16} color="#FFFFFF" />
              <Text style={styles.metaText}>{fullRecipe.total_time_minutes} min</Text>
            </View>
            <View style={styles.metaBadge}>
              <Ionicons name="bar-chart-outline" size={16} color="#FFFFFF" />
              <Text style={styles.metaText}>{fullRecipe.difficulty}</Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: COLORS.olive }]}>
              <Text style={styles.metaText}>{suggestedRecipe.match_score}% match</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        {fullRecipe.description && (
          <View style={styles.section}>
            <Text style={[styles.description, { color: isDark ? '#D1D5DB' : '#64748B' }]}>
              {fullRecipe.description}
            </Text>
          </View>
        )}

        {/* Ingredients Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list" size={24} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
              Ingredients
            </Text>
            <View style={styles.servingsBadge}>
              <Text style={styles.servingsText}>{fullRecipe.servings} servings</Text>
            </View>
          </View>

          {/* What You Have */}
          {inStockIngredients.length > 0 && (
            <View style={styles.ingredientGroup}>
              <View style={styles.ingredientGroupHeader}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.olive }]} />
                <Text style={[styles.ingredientGroupTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
                  {`You Have (${inStockIngredients.length})`}
                </Text>
              </View>
              {fullRecipe.ingredients
                .filter((ing) => {
                  const name = typeof ing === 'string' ? ing : ing.name;
                  return name && inStockIngredients.includes(name);
                })
                .map((ingredient, index) => {
                  const isString = typeof ingredient === 'string';
                  const name = isString ? ingredient : (ingredient.name || '');
                  const amount = isString ? '' : (ingredient.amount ? String(ingredient.amount) : '');
                  const unit = isString ? '' : (ingredient.unit || '');
                  return (
                    <View key={`have-${index}`} style={styles.ingredientItem}>
                      <View style={[styles.ingredientDot, { backgroundColor: COLORS.olive }]} />
                      <Text style={[styles.ingredientText, { color: isDark ? '#D1D5DB' : '#1F2937' }]}>
                        {amount ? `${amount} ` : ''}{unit ? `${unit} ` : ''}{name}
                      </Text>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.olive} />
                    </View>
                  );
                })}
            </View>
          )}

          {/* What You Need */}
          {neededIngredients.length > 0 && (
            <View style={styles.ingredientGroup}>
              <View style={styles.ingredientGroupHeader}>
                <View style={[styles.statusDot, { backgroundColor: COLORS.primary }]} />
                <Text style={[styles.ingredientGroupTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
                  {`Shopping List (${neededIngredients.length})`}
                </Text>
              </View>
              {fullRecipe.ingredients
                .filter((ing) => {
                  const name = typeof ing === 'string' ? ing : ing.name;
                  return name && neededIngredients.includes(name);
                })
                .map((ingredient, index) => {
                  const isString = typeof ingredient === 'string';
                  const name = isString ? ingredient : (ingredient.name || '');
                  const amount = isString ? '' : (ingredient.amount ? String(ingredient.amount) : '');
                  const unit = isString ? '' : (ingredient.unit || '');
                  return (
                    <View key={`need-${index}`} style={styles.ingredientItem}>
                      <View style={[styles.ingredientDot, { backgroundColor: COLORS.primary }]} />
                      <Text style={[styles.ingredientText, { color: isDark ? '#D1D5DB' : '#1F2937' }]}>
                        {amount ? `${amount} ` : ''}{unit ? `${unit} ` : ''}{name}
                      </Text>
                      <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
                    </View>
                  );
                })}
            </View>
          )}
        </View>

        {/* Cooking Steps */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-circle" size={24} color={COLORS.primary} />
            <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
              Cooking Steps
            </Text>
          </View>

          {fullRecipe.steps
            .filter(step => step.instruction)
            .map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.step_number}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepInstruction, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>
                    {step.instruction}
                  </Text>
                  {step.duration_minutes && (
                    <View style={styles.stepMeta}>
                      <Ionicons name="timer-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.stepMetaText}>{step.duration_minutes} minutes</Text>
                    </View>
                  )}
                  {step.temperature && (
                    <View style={styles.stepMeta}>
                      <Ionicons name="thermometer-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.stepMetaText}>{step.temperature}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
        </View>

        {/* Nutrition Info */}
        {fullRecipe.nutrition_estimate && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="nutrition" size={24} color={COLORS.primary} />
              <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : COLORS.charcoal }]}>
                Nutrition (per serving)
              </Text>
            </View>
            <View style={styles.nutritionGrid}>
              {fullRecipe.nutrition_estimate.calories && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{fullRecipe.nutrition_estimate.calories}</Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
              )}
              {fullRecipe.nutrition_estimate.protein_g && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{fullRecipe.nutrition_estimate.protein_g}g</Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
              )}
              {fullRecipe.nutrition_estimate.carbs_g && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{fullRecipe.nutrition_estimate.carbs_g}g</Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
              )}
              {fullRecipe.nutrition_estimate.fat_g && (
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>{fullRecipe.nutrition_estimate.fat_g}g</Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
        <Pressable
          style={[styles.actionButton, styles.saveButton, isSaved && styles.saveButtonActive]}
          onPress={handleSaveToFavorites}
          disabled={isSaving || isSaved}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{isSaved ? 'Saved' : 'Save'}</Text>
            </>
          )}
        </Pressable>

        <Pressable style={[styles.actionButton, styles.cookButton]} onPress={handleCookNow}>
          <Ionicons name="restaurant" size={20} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>Cook This</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  header: {
    height: 300,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
  },
  headerBackButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSaveButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSaveButtonActive: {
    backgroundColor: COLORS.primary,
  },
  headerInfo: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    flex: 1,
  },
  description: {
    fontSize: 16,
    fontFamily: 'NotoSans_400Regular',
    lineHeight: 24,
  },
  servingsBadge: {
    backgroundColor: 'rgba(255, 75, 43, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  servingsText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.primary,
  },
  ingredientGroup: {
    marginBottom: 20,
  },
  ingredientGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ingredientGroupTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    lineHeight: 20,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 16,
    fontFamily: 'NotoSans_500Medium',
    lineHeight: 24,
    marginBottom: 8,
  },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  stepMetaText: {
    fontSize: 13,
    fontFamily: 'NotoSans_500Medium',
    color: COLORS.primary,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 75, 43, 0.05)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#64748B',
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: COLORS.backgroundLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: '#64748B',
  },
  saveButtonActive: {
    backgroundColor: COLORS.primary,
  },
  cookButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
