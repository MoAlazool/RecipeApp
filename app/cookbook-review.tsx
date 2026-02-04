import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { aiService } from '@/services/ai.service';
import { useRecipeStore } from '@/stores/recipeStore';
import { getRecipeImage } from '@/utils/recipePlaceholders';
import type { ExtractedRecipe, Ingredient, RecipeStep } from '@/utils/types';

export default function CookbookReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pages: string }>();
  const insets = useSafeAreaInsets();
  const { addRecipe } = useRecipeStore();

  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const pageUris: string[] = params.pages ? JSON.parse(params.pages) : [];

  // Group items by their "group" field; ungrouped items go under a single null key
  const groupBy = <T extends { group?: string }>(items: T[]): Map<string | null, T[]> => {
    const map = new Map<string | null, T[]>();
    for (const item of items) {
      const key = item.group || null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  };

  const hasGroups = extractedRecipe
    ? extractedRecipe.ingredients.some(i => i.group) || extractedRecipe.steps.some(s => s.group)
    : false;

  useEffect(() => {
    extractRecipe();
  }, []);

  const extractRecipe = async () => {
    setIsExtracting(true);
    setError(null);
    try {
      const recipe = await aiService.extractRecipeFromCookbookPages(pageUris);
      // Generate AI image for extracted recipe
      try {
        const base64 = await aiService.generateRecipeImage(recipe.title);
        setRecipeImageUrl(`data:image/png;base64,${base64}`);
      } catch {
        const ingredientNames = recipe.ingredients?.map(i => i.name) || [];
        const foodKeywords = (recipe as any).food_keywords as string[] | undefined;
        setRecipeImageUrl(getRecipeImage(null, recipe.title, recipe.cuisine_type, ingredientNames, foodKeywords));
      }
      setExtractedRecipe(recipe);
    } catch (err: any) {
      setError(err.message || 'Failed to extract recipe');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!extractedRecipe) return;
    setIsSaving(true);
    try {
      await addRecipe(extractedRecipe, undefined, undefined, 'cookbook_scan');
      setIsSaved(true);
      Alert.alert('Saved!', 'Recipe added to your collection', [
        {
          text: 'View Collection',
          onPress: () => {
            router.dismissAll();
            router.replace('/(tabs)');
          },
        },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save recipe');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C100D" />
        </Pressable>
        <Text style={styles.headerTitle}>Cookbook Recipe</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Page Thumbnails */}
      <View style={styles.thumbnailContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailScroll}
        >
          {pageUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.thumbnailWrapper}>
              <Image source={{ uri }} style={styles.thumbnail} />
              <View style={styles.thumbnailBadge}>
                <Text style={styles.thumbnailBadgeText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Loading State */}
      {isExtracting && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F2330D" />
          <Text style={styles.loadingText}>
            Extracting recipe from {pageUris.length} {pageUris.length === 1 ? 'page' : 'pages'}...
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && !isExtracting && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={extractRecipe}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {/* Result State */}
      {extractedRecipe && !isExtracting && !error && (
        <>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Image */}
            {recipeImageUrl && (
              <View style={styles.heroImageContainer}>
                <Image source={{ uri: recipeImageUrl }} style={styles.heroImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.5)']}
                  style={styles.heroGradient}
                />
              </View>
            )}

            {/* Title & Description */}
            <Text style={styles.recipeTitle}>{extractedRecipe.title}</Text>
            {extractedRecipe.description && (
              <Text style={styles.recipeDescription}>{extractedRecipe.description}</Text>
            )}

            {/* Meta Row */}
            <View style={styles.metaRow}>
              {extractedRecipe.total_time_minutes > 0 && (
                <View style={styles.metaBadge}>
                  <Ionicons name="time-outline" size={16} color="#F2330D" />
                  <Text style={styles.metaText}>{extractedRecipe.total_time_minutes} min</Text>
                </View>
              )}
              {extractedRecipe.servings > 0 && (
                <View style={styles.metaBadge}>
                  <Ionicons name="people-outline" size={16} color="#F2330D" />
                  <Text style={styles.metaText}>{extractedRecipe.servings} servings</Text>
                </View>
              )}
              {extractedRecipe.difficulty && (
                <View style={styles.metaBadge}>
                  <Ionicons name="bar-chart-outline" size={16} color="#F2330D" />
                  <Text style={styles.metaText}>{extractedRecipe.difficulty}</Text>
                </View>
              )}
            </View>

            {/* Ingredients */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list" size={22} color="#F2330D" />
                <Text style={styles.sectionTitle}>Ingredients</Text>
              </View>
              {hasGroups ? (
                Array.from(groupBy(extractedRecipe.ingredients)).map(([group, items], gi) => (
                  <View key={group || gi} style={group ? styles.componentGroup : undefined}>
                    {group && (
                      <View style={styles.componentLabel}>
                        <Ionicons name="restaurant-outline" size={14} color="#556B2F" />
                        <Text style={styles.componentLabelText}>{group}</Text>
                      </View>
                    )}
                    {items.map((ingredient, index) => (
                      <View key={index} style={styles.ingredientItem}>
                        <View style={styles.ingredientDot} />
                        <Text style={styles.ingredientText}>
                          {ingredient.amount ? `${ingredient.amount} ` : ''}
                          {ingredient.unit ? `${ingredient.unit} ` : ''}
                          {ingredient.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                extractedRecipe.ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientItem}>
                    <View style={styles.ingredientDot} />
                    <Text style={styles.ingredientText}>
                      {ingredient.amount ? `${ingredient.amount} ` : ''}
                      {ingredient.unit ? `${ingredient.unit} ` : ''}
                      {ingredient.name}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {/* Steps */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-circle" size={22} color="#F2330D" />
                <Text style={styles.sectionTitle}>Steps</Text>
              </View>
              {hasGroups ? (
                Array.from(groupBy(extractedRecipe.steps.filter(s => s.instruction))).map(([group, steps], gi) => (
                  <View key={group || gi} style={group ? styles.componentGroup : undefined}>
                    {group && (
                      <View style={styles.componentLabel}>
                        <Ionicons name="restaurant-outline" size={14} color="#556B2F" />
                        <Text style={styles.componentLabelText}>{group}</Text>
                      </View>
                    )}
                    {steps.map((step, index) => (
                      <View key={index} style={styles.stepItem}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{step.step_number}</Text>
                        </View>
                        <View style={styles.stepContent}>
                          <Text style={styles.stepInstruction}>{step.instruction}</Text>
                          {step.duration_minutes != null && (
                            <View style={styles.stepMeta}>
                              <Ionicons name="timer-outline" size={14} color="#F2330D" />
                              <Text style={styles.stepMetaText}>{step.duration_minutes} min</Text>
                            </View>
                          )}
                          {step.temperature && (
                            <View style={styles.stepMeta}>
                              <Ionicons name="thermometer-outline" size={14} color="#F2330D" />
                              <Text style={styles.stepMetaText}>{step.temperature}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ))
              ) : (
                extractedRecipe.steps
                  .filter(step => step.instruction)
                  .map((step, index) => (
                    <View key={index} style={styles.stepItem}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>{step.step_number}</Text>
                      </View>
                      <View style={styles.stepContent}>
                        <Text style={styles.stepInstruction}>{step.instruction}</Text>
                        {step.duration_minutes != null && (
                          <View style={styles.stepMeta}>
                            <Ionicons name="timer-outline" size={14} color="#F2330D" />
                            <Text style={styles.stepMetaText}>{step.duration_minutes} min</Text>
                          </View>
                        )}
                        {step.temperature && (
                          <View style={styles.stepMeta}>
                            <Ionicons name="thermometer-outline" size={14} color="#F2330D" />
                            <Text style={styles.stepMetaText}>{step.temperature}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
              )}
            </View>

            {/* Nutrition */}
            {extractedRecipe.nutrition_estimate && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="nutrition" size={22} color="#F2330D" />
                  <Text style={styles.sectionTitle}>Nutrition (per serving)</Text>
                </View>
                <View style={styles.nutritionGrid}>
                  {extractedRecipe.nutrition_estimate.calories != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{extractedRecipe.nutrition_estimate.calories}</Text>
                      <Text style={styles.nutritionLabel}>Calories</Text>
                    </View>
                  )}
                  {extractedRecipe.nutrition_estimate.protein_g != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{extractedRecipe.nutrition_estimate.protein_g}g</Text>
                      <Text style={styles.nutritionLabel}>Protein</Text>
                    </View>
                  )}
                  {extractedRecipe.nutrition_estimate.carbs_g != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{extractedRecipe.nutrition_estimate.carbs_g}g</Text>
                      <Text style={styles.nutritionLabel}>Carbs</Text>
                    </View>
                  )}
                  {extractedRecipe.nutrition_estimate.fat_g != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{extractedRecipe.nutrition_estimate.fat_g}g</Text>
                      <Text style={styles.nutritionLabel}>Fat</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Tips */}
            {extractedRecipe.tips && extractedRecipe.tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bulb-outline" size={22} color="#F2330D" />
                  <Text style={styles.sectionTitle}>Tips</Text>
                </View>
                {extractedRecipe.tips.map((tip, index) => (
                  <View key={index} style={styles.tipItem}>
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
            <Pressable
              style={[
                styles.saveButton,
                (isSaving || isSaved) && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSaving || isSaved}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={isSaved ? 'checkmark-circle' : 'bookmark-outline'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>
                    {isSaved ? 'Saved' : 'Save to Collection'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  thumbnailContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  thumbnailScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 52,
    height: 68,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  thumbnailBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  thumbnailBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9C5749',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2330D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroImageContainer: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  recipeTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
    marginBottom: 8,
  },
  recipeDescription: {
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 51, 13, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F2330D',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
  },
  componentGroup: {
    marginBottom: 16,
  },
  componentLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(85, 107, 47, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 10,
  },
  componentLabelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#556B2F',
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F2330D',
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
    lineHeight: 20,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2330D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
    lineHeight: 22,
  },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  stepMetaText: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#F2330D',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(242, 51, 13, 0.05)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F2330D',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  tipItem: {
    backgroundColor: 'rgba(85, 107, 47, 0.08)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#556B2F',
    lineHeight: 20,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#F8F6F5',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2330D',
    height: 56,
    borderRadius: 16,
    gap: 10,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
  },
});
