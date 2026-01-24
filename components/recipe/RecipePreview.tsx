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
}

export function RecipePreview({ recipe, onSave, onEdit, onDiscard, isSaving = false }: RecipePreviewProps) {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
          <Text h4 style={styles.title}>Recipe Extracted!</Text>
          <Text style={styles.subtitle}>Review before saving</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          {recipe.description && (
            <Text style={styles.description}>{recipe.description}</Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#FF6B35" />
              <Text style={styles.metaText}>{recipe.total_time_minutes} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={16} color="#FF6B35" />
              <Text style={styles.metaText}>{recipe.servings} servings</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="speedometer-outline" size={16} color="#FF6B35" />
              <Text style={styles.metaText}>{recipe.difficulty}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="list" size={16} color="#1A1A2E" /> Ingredients ({recipe.ingredients.length})
          </Text>
          {recipe.ingredients.slice(0, 5).map((ing, index) => (
            <Text key={index} style={styles.ingredient}>
              • {ing.amount} {ing.unit} {ing.name}
              {ing.notes ? ` (${ing.notes})` : ''}
            </Text>
          ))}
          {recipe.ingredients.length > 5 && (
            <Text style={styles.moreText}>
              +{recipe.ingredients.length - 5} more ingredients
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="footsteps" size={16} color="#1A1A2E" /> Steps ({recipe.steps.length})
          </Text>
          {recipe.steps.slice(0, 3).map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.step_number}</Text>
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

        {recipe.tips && recipe.tips.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="bulb-outline" size={16} color="#1A1A2E" /> Tips
            </Text>
            {recipe.tips.map((tip, index) => (
              <Text key={index} style={styles.tip}>• {tip}</Text>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.discardButton}
          onPress={onDiscard}
          disabled={isSaving}
        >
          <Text style={styles.discardButtonText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={onSave}
          disabled={isSaving}
          activeOpacity={0.9}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="checkmark" size={20} color="#FFF" />
          )}
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Recipe'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    marginTop: 12,
    color: '#1C100D',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
  },
  subtitle: {
    color: '#9C5749',
    marginTop: 4,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  recipeTitle: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 8,
  },
  description: {
    color: '#9C5749',
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: 'NotoSans_500Medium',
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#9C5749',
    fontFamily: 'NotoSans_500Medium',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 12,
  },
  ingredient: {
    fontSize: 14,
    color: '#1C100D',
    lineHeight: 26,
    fontFamily: 'NotoSans_500Medium',
  },
  moreText: {
    color: '#F2330D',
    fontSize: 14,
    marginTop: 8,
    fontFamily: 'NotoSans_600SemiBold',
  },
  step: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2330D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#1C100D',
    lineHeight: 22,
    fontFamily: 'NotoSans_500Medium',
  },
  tip: {
    fontSize: 14,
    color: '#9C5749',
    lineHeight: 24,
    fontFamily: 'NotoSans_500Medium',
  },
  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  discardButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E8D3CE',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  discardButtonText: {
    color: '#9C5749',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(242, 51, 13, 0.7)',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
  },
});
