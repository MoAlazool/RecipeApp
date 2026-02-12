import React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import type { ExtractedRecipe } from '@/utils/types';

interface RecipePreviewProps {
  recipe: ExtractedRecipe;
  onSave: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
  usageBanner?: { remaining: number; total: number };
}

export function RecipePreview({ recipe, onSave, onEdit, onDiscard, isSaving = false, usageBanner }: RecipePreviewProps) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.checkWrap}>
            <Ionicons name="checkmark" size={18} color="#D4AF37" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Recipe Extracted</Text>
            <Text style={styles.headerSub}>Review before saving</Text>
          </View>
        </View>

        {/* Recipe Card */}
        <View style={styles.card}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color="#8A8578" />
              <Text style={styles.metaText}>{recipe.total_time_minutes} min</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="people-outline" size={14} color="#8A8578" />
              <Text style={styles.metaText}>{recipe.servings} servings</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="speedometer-outline" size={14} color="#8A8578" />
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Ingredients</Text>
            <Text style={styles.sectionCount}>{recipe.ingredients.length}</Text>
          </View>
          {recipe.ingredients.slice(0, 5).map((ing, index) => (
            <View key={index} style={styles.ingredientRow}>
              <View style={styles.ingredientDot} />
              <Text style={styles.ingredientText}>
                {ing.amount} {ing.unit} {ing.name}
                {ing.notes ? ` (${ing.notes})` : ''}
              </Text>
            </View>
          ))}
          {recipe.ingredients.length > 5 && (
            <Text style={styles.moreText}>
              +{recipe.ingredients.length - 5} more
            </Text>
          )}
        </View>

        {/* Steps */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Steps</Text>
            <Text style={styles.sectionCount}>{recipe.steps.length}</Text>
          </View>
          {recipe.steps.slice(0, 3).map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.step_number}</Text>
              </View>
              <Text style={styles.stepText} numberOfLines={2}>
                {step.instruction}
              </Text>
            </View>
          ))}
          {recipe.steps.length > 3 && (
            <Text style={styles.moreText}>
              +{recipe.steps.length - 3} more steps
            </Text>
          )}
        </View>

        {/* Tips */}
        {recipe.tips && recipe.tips.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Tips</Text>
            </View>
            {recipe.tips.map((tip, index) => (
              <View key={index} style={styles.ingredientRow}>
                <Ionicons name="bulb-outline" size={14} color="#D4AF37" />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.actions}>
        {usageBanner && usageBanner.remaining > 0 && (
          <View style={styles.usageBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#C66E4E" />
            <Text style={styles.usageBannerText}>
              Saving will use 1 of your {usageBanner.remaining} remaining extractions
            </Text>
          </View>
        )}
        <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.discardBtn}
          onPress={onDiscard}
          disabled={isSaving}
        >
          <Text style={styles.discardBtnText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="checkmark" size={18} color="#FFF" />
          )}
          <Text style={styles.saveBtnText}>
            {isSaving ? 'Saving...' : 'Save Recipe'}
          </Text>
        </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 19,
    color: '#1A1510',
  },
  headerSub: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#B5B0A7',
  },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  recipeTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: '#1A1510',
    marginBottom: 6,
  },
  description: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8A8578',
    lineHeight: 20,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(26, 21, 16, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8A8578',
  },

  // ── Section ──
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1A1510',
  },
  sectionCount: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#B5B0A7',
  },

  // ── Ingredients ──
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5,
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
    fontSize: 14,
    color: '#1A1510',
    lineHeight: 20,
  },
  moreText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#C66E4E',
    marginTop: 10,
  },

  // ── Steps ──
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1A1510',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: '#1A1510',
    lineHeight: 21,
  },

  // ── Tips ──
  tipText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8A8578',
    lineHeight: 20,
  },

  // ── Actions ──
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#FAFAF8',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(26, 21, 16, 0.06)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
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
  discardBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(26, 21, 16, 0.10)',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#8A8578',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#C66E4E',
    borderRadius: 20,
    paddingVertical: 14,
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(198, 110, 78, 0.6)',
  },
  saveBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
