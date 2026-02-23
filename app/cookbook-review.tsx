import { useState, useEffect, useRef } from 'react';
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
import { useUsageStore } from '@/stores/usageStore';
import { useAuthStore } from '@/stores/authStore';
import { FREE_PLAN_LIMITS } from '@/utils/types';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import type { ExtractedRecipe } from '@/utils/types';

export default function CookbookReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pages: string }>();
  const insets = useSafeAreaInsets();
  const { addRecipe } = useRecipeStore();
  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();

  const [extractedRecipe, setExtractedRecipe] = useState<ExtractedRecipe | null>(null);
  const [recipeImageUrl, setRecipeImageUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const extractionRunIdRef = useRef(0);

  const pageUris: string[] = params.pages ? JSON.parse(params.pages) : [];
  const pagePreviewImage = pageUris[0] || null;

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
    gatedExtract();
    return () => {
      extractionRunIdRef.current += 1;
    };
  }, []);

  const gatedExtract = async () => {
    const allowed = await checkGate('recipe');
    if (!allowed) {
      setIsExtracting(false);
      return;
    }
    extractRecipe();
  };

  const extractRecipe = async () => {
    const runId = ++extractionRunIdRef.current;
    setIsExtracting(true);
    setIsGeneratingImage(false);
    setError(null);
    setRecipeImageUrl(null);
    try {
      const recipe = await aiService.extractRecipeFromCookbookPages(pageUris);
      if (extractionRunIdRef.current !== runId) return;
      setExtractedRecipe(recipe);
      setIsExtracting(false);

      // Run AI image generation in background (non-blocking for UI).
      setIsGeneratingImage(true);
      aiService.generateRecipeImage(recipe.title)
        .then((base64) => {
          if (extractionRunIdRef.current !== runId) return;
          setRecipeImageUrl(`data:image/png;base64,${base64}`);
        })
        .catch((imageErr) => {
          console.warn('[CookbookReview] Background image generation failed', imageErr);
        })
        .finally(() => {
          if (extractionRunIdRef.current !== runId) return;
          setIsGeneratingImage(false);
        });
    } catch (err: any) {
      if (extractionRunIdRef.current !== runId) return;
      setError(err.message || 'Failed to extract recipe');
    } finally {
      if (extractionRunIdRef.current !== runId) return;
      setIsExtracting(false);
    }
  };

  const isPremium = useAuthStore((s) => s.user?.is_premium);
  const recipesRemaining = useUsageStore((s) => s.getRecipesRemaining());

  const handleSave = async () => {
    if (!extractedRecipe) return;
    setIsSaving(true);
    try {
      const imageForSave = recipeImageUrl?.startsWith('data:image') ? recipeImageUrl : undefined;
      await addRecipe(extractedRecipe, undefined, imageForSave, 'cookbook_scan');
      await useUsageStore.getState().incrementUsage('recipe');
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
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1A1510" />
        </Pressable>
        <Text style={styles.headerTitle}>Cookbook Recipe</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* Page Thumbnails */}
      <View style={styles.thumbStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbScroll}
        >
          {pageUris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumbImg} />
              <View style={styles.thumbBadge}>
                <Text style={styles.thumbBadgeText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Loading */}
      {isExtracting && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#C66E4E" />
          <Text style={styles.loadingText}>
            Extracting recipe from {pageUris.length} {pageUris.length === 1 ? 'page' : 'pages'}...
          </Text>
        </View>
      )}

      {/* Error */}
      {error && !isExtracting && (
        <View style={styles.centerWrap}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={gatedExtract}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {/* Result */}
      {extractedRecipe && !isExtracting && !error && (
        <>
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Image */}
            {(recipeImageUrl || pagePreviewImage) && (
              <View style={styles.heroWrap}>
                <Image source={{ uri: recipeImageUrl || pagePreviewImage || '' }} style={styles.heroImg} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.5)']}
                  style={styles.heroGradient}
                />
              </View>
            )}
            {isGeneratingImage && (
              <View style={styles.imageGeneratingHint}>
                <ActivityIndicator size="small" color="#D4AF37" />
                <Text style={styles.imageGeneratingHintText}>Generating recipe image...</Text>
              </View>
            )}

            {/* Title */}
            <Text style={styles.recipeTitle}>{extractedRecipe.title}</Text>
            {extractedRecipe.description && (
              <Text style={styles.recipeDesc}>{extractedRecipe.description}</Text>
            )}

            {/* Meta */}
            <View style={styles.metaRow}>
              {extractedRecipe.total_time_minutes > 0 && (
                <View style={styles.metaPill}>
                  <Ionicons name="time-outline" size={14} color="#8A8578" />
                  <Text style={styles.metaText}>{extractedRecipe.total_time_minutes} min</Text>
                </View>
              )}
              {extractedRecipe.servings > 0 && (
                <View style={styles.metaPill}>
                  <Ionicons name="people-outline" size={14} color="#8A8578" />
                  <Text style={styles.metaText}>{extractedRecipe.servings} servings</Text>
                </View>
              )}
              {extractedRecipe.difficulty && (
                <View style={styles.metaPill}>
                  <Ionicons name="speedometer-outline" size={14} color="#8A8578" />
                  <Text style={styles.metaText}>{extractedRecipe.difficulty}</Text>
                </View>
              )}
            </View>

            {/* Ingredients */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>Ingredients</Text>
                <Text style={styles.sectionCount}>{extractedRecipe.ingredients.length}</Text>
              </View>
              {hasGroups ? (
                Array.from(groupBy(extractedRecipe.ingredients)).map(([group, items], gi) => (
                  <View key={group || gi} style={group ? styles.compGroup : undefined}>
                    {group && (
                      <View style={styles.compLabel}>
                        <Text style={styles.compLabelText}>{group}</Text>
                      </View>
                    )}
                    {items.map((ingredient, index) => (
                      <View key={index} style={styles.ingredientRow}>
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
                  <View key={index} style={styles.ingredientRow}>
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
              <View style={styles.sectionHead}>
                <Text style={styles.sectionLabel}>Steps</Text>
                <Text style={styles.sectionCount}>{extractedRecipe.steps.filter(s => s.instruction).length}</Text>
              </View>
              {hasGroups ? (
                Array.from(groupBy(extractedRecipe.steps.filter(s => s.instruction))).map(([group, steps], gi) => (
                  <View key={group || gi} style={group ? styles.compGroup : undefined}>
                    {group && (
                      <View style={styles.compLabel}>
                        <Text style={styles.compLabelText}>{group}</Text>
                      </View>
                    )}
                    {steps.map((step, index) => (
                      <View key={index} style={styles.stepRow}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{step.step_number}</Text>
                        </View>
                        <View style={styles.stepBody}>
                          <Text style={styles.stepText}>{step.instruction}</Text>
                          {step.duration_minutes != null && (
                            <View style={styles.stepMeta}>
                              <Ionicons name="timer-outline" size={13} color="#C66E4E" />
                              <Text style={styles.stepMetaText}>{step.duration_minutes} min</Text>
                            </View>
                          )}
                          {step.temperature && (
                            <View style={styles.stepMeta}>
                              <Ionicons name="thermometer-outline" size={13} color="#C66E4E" />
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
                    <View key={index} style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{step.step_number}</Text>
                      </View>
                      <View style={styles.stepBody}>
                        <Text style={styles.stepText}>{step.instruction}</Text>
                        {step.duration_minutes != null && (
                          <View style={styles.stepMeta}>
                            <Ionicons name="timer-outline" size={13} color="#C66E4E" />
                            <Text style={styles.stepMetaText}>{step.duration_minutes} min</Text>
                          </View>
                        )}
                        {step.temperature && (
                          <View style={styles.stepMeta}>
                            <Ionicons name="thermometer-outline" size={13} color="#C66E4E" />
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
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionLabel}>Nutrition</Text>
                  <Text style={styles.sectionCount}>per serving</Text>
                </View>
                <View style={styles.nutritionGrid}>
                  {extractedRecipe.nutrition_estimate.calories != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionVal}>{extractedRecipe.nutrition_estimate.calories}</Text>
                      <Text style={styles.nutritionLabel}>Calories</Text>
                    </View>
                  )}
                  {extractedRecipe.nutrition_estimate.protein_g != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionVal}>{extractedRecipe.nutrition_estimate.protein_g}g</Text>
                      <Text style={styles.nutritionLabel}>Protein</Text>
                    </View>
                  )}
                  {extractedRecipe.nutrition_estimate.carbs_g != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionVal}>{extractedRecipe.nutrition_estimate.carbs_g}g</Text>
                      <Text style={styles.nutritionLabel}>Carbs</Text>
                    </View>
                  )}
                  {extractedRecipe.nutrition_estimate.fat_g != null && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionVal}>{extractedRecipe.nutrition_estimate.fat_g}g</Text>
                      <Text style={styles.nutritionLabel}>Fat</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Tips */}
            {extractedRecipe.tips && extractedRecipe.tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionLabel}>Tips</Text>
                </View>
                {extractedRecipe.tips.map((tip, index) => (
                  <View key={index} style={styles.tipRow}>
                    <Ionicons name="bulb-outline" size={14} color="#D4AF37" />
                    <Text style={styles.tipText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom Save */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
            {!isPremium && recipesRemaining > 0 && (
              <View style={styles.usageBanner}>
                <Ionicons name="information-circle-outline" size={16} color="#C66E4E" />
                <Text style={styles.usageBannerText}>
                  Saving will use 1 of your {recipesRemaining} remaining extractions
                </Text>
              </View>
            )}
            <Pressable
              style={[styles.saveBtn, (isSaving || isSaved) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving || isSaved}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={isSaved ? 'checkmark-circle' : 'bookmark-outline'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveBtnText}>
                    {isSaved ? 'Saved' : 'Save to Collection'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      )}
      {/* Usage Limit Sheet */}
      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1A1510',
  },

  // ── Page Thumbnails ──
  thumbStrip: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 21, 16, 0.06)',
  },
  thumbScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumbImg: {
    width: 48,
    height: 64,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26, 21, 16, 0.08)',
  },
  thumbBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  thumbBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // ── Loading ──
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    padding: 32,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#B5B0A7',
    textAlign: 'center',
  },

  // ── Error ──
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#1A1510',
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C66E4E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 4,
    gap: 8,
  },
  retryBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ── Content ──
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  // ── Hero Image ──
  heroWrap: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 4,
  },
  heroImg: {
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
  imageGeneratingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
    marginBottom: 14,
  },
  imageGeneratingHintText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8A8578',
  },

  // ── Recipe Header ──
  recipeTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: '#1A1510',
    marginBottom: 6,
  },
  recipeDesc: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#8A8578',
    lineHeight: 21,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8A8578',
  },

  // ── Section ──
  section: {
    marginBottom: 28,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#1A1510',
  },
  sectionCount: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#B5B0A7',
  },

  // ── Component Groups ──
  compGroup: {
    marginBottom: 16,
  },
  compLabel: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
  },
  compLabelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#D4AF37',
  },

  // ── Ingredients ──
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(26, 21, 16, 0.05)',
  },
  ingredientDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D5D1CB',
    marginTop: 7,
  },
  ingredientText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#1A1510',
    lineHeight: 20,
  },

  // ── Steps ──
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1510',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  stepBody: {
    flex: 1,
  },
  stepText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#1A1510',
    lineHeight: 21,
  },
  stepMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  stepMetaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#C66E4E',
  },

  // ── Nutrition ──
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutritionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(26, 21, 16, 0.03)',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  nutritionVal: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#1A1510',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#B5B0A7',
  },

  // ── Tips ──
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8A8578',
    lineHeight: 20,
  },

  // ── Bottom Bar ──
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 21, 16, 0.06)',
    backgroundColor: '#FAFAF8',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C66E4E',
    height: 54,
    borderRadius: 20,
    gap: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  usageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  usageBannerText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#C66E4E',
    lineHeight: 17,
  },
});
