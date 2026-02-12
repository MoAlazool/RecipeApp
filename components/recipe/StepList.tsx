import React, { useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeStep, Ingredient } from '@/utils/types';

// --- Design Tokens ---
const GOLD = '#D4AF37';
const CHARCOAL = '#1A1510';
const MUTED = '#8A8578';
const HAIRLINE = 'rgba(26, 21, 16, 0.08)';

interface StepListProps {
  steps: RecipeStep[];
  ingredients?: Ingredient[];
  /** @deprecated Use `ingredients` instead */
  ingredientNames?: string[];
}

const formatAmount = (raw?: number | string): string => {
  if (raw == null || raw === '') return '';
  const amount = typeof raw === 'string' ? parseFloat(raw) : raw;
  if (isNaN(amount) || amount === 0) return '';
  if (amount === Math.floor(amount)) return amount.toString();
  if (Math.abs(amount - 0.25) < 0.01) return '\u00BC';
  if (Math.abs(amount - 0.33) < 0.01) return '\u2153';
  if (Math.abs(amount - 0.5) < 0.01) return '\u00BD';
  if (Math.abs(amount - 0.67) < 0.01) return '\u2154';
  if (Math.abs(amount - 0.75) < 0.01) return '\u00BE';
  return amount.toFixed(1).replace(/\.0$/, '');
};

interface MatchedIngredient {
  name: string;
  label: string; // e.g. "1/2 cup Flour"
}

export function StepList({ steps, ingredients = [], ingredientNames = [] }: StepListProps) {
  const filteredSteps = steps.filter(step => step.instruction);

  const grouped = useMemo(() => {
    const hasGroups = filteredSteps.some(s => s.group);
    if (!hasGroups) return null;
    const map = new Map<string, RecipeStep[]>();
    for (const step of filteredSteps) {
      const key = step.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(step);
    }
    return map;
  }, [filteredSteps]);

  // Pre-compute: show ALL ingredients mentioned in each step
  const stepIngredientMap = useMemo(() => {
    const map = new Map<number, MatchedIngredient[]>();

    for (const step of filteredSteps) {
      const lower = step.instruction.toLowerCase();
      const matched: MatchedIngredient[] = [];

      if (ingredients.length > 0) {
        for (const ing of ingredients) {
          const key = ing.name.toLowerCase();
          if (lower.includes(key)) {
            const amt = formatAmount(ing.amount);
            const unit = ing.unit || '';
            const parts = [amt, unit].filter(Boolean).join(' ');
            const label = parts ? `${parts} ${ing.name}` : ing.name;
            matched.push({ name: ing.name, label });
          }
        }
      } else {
        for (const name of ingredientNames) {
          const key = name.toLowerCase();
          if (lower.includes(key)) {
            matched.push({ name, label: name });
          }
        }
      }

      map.set(step.step_number, matched);
    }
    return map;
  }, [filteredSteps, ingredients, ingredientNames]);

  const renderStep = (step: RecipeStep, index: number, isFirst: boolean) => {
    const matched = stepIngredientMap.get(step.step_number) || [];
    const hasMeta = step.duration_minutes || step.temperature;

    return (
      <View key={index}>
        {!isFirst && <View style={styles.separator} />}
        <View style={styles.stepRow}>
          {/* Editorial step number */}
          <Text style={styles.stepNumber}>
            {String(step.step_number).padStart(2, '0')}
          </Text>

          <View style={styles.stepContent}>
            {/* Instruction */}
            <Text style={styles.instruction}>{step.instruction}</Text>

            {/* Time & Temperature */}
            {hasMeta && (
              <View style={styles.metaRow}>
                {step.duration_minutes != null && (
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={15} color={GOLD} />
                    <Text style={styles.metaText}>
                      {step.duration_minutes} MINS
                    </Text>
                  </View>
                )}
                {step.temperature && (
                  <View style={styles.metaItem}>
                    <Ionicons name="thermometer-outline" size={15} color={GOLD} />
                    <Text style={styles.metaText}>
                      {String(step.temperature).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Ingredient Pills — horizontal scroll */}
            {matched.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagScroll}
                style={styles.tagScrollWrap}
              >
                {matched.map((m, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{m.label}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Chef's Tip */}
            {step.tip && (
              <View style={styles.tipContainer}>
                <View style={styles.tipBorder} />
                <Text style={styles.tipText}>
                  <Text style={styles.tipLabel}>Tip: </Text>
                  {step.tip}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {grouped ? (
        Array.from(grouped).map(([group, groupSteps]) => (
          <View key={group || '_ungrouped'} style={group ? styles.group : undefined}>
            {group !== '' && (
              <View style={styles.groupDivider}>
                <View style={styles.groupDividerLine} />
                <Text style={styles.groupDividerLabel}>{group.toUpperCase()}</Text>
              </View>
            )}
            {groupSteps.map((step, i) => renderStep(step, i, i === 0))}
          </View>
        ))
      ) : (
        filteredSteps.map((step, index) => renderStep(step, index, index === 0))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginVertical: 32,
  },

  // Step layout
  stepRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stepNumber: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: '#D1CBC2',
    width: 40,
    paddingTop: 2,
    opacity: 0.7,
  },
  stepContent: {
    flex: 1,
  },

  // Instruction — Sans-serif body
  instruction: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: CHARCOAL,
    lineHeight: 26,
  },

  // Time & Temperature
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 22,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: MUTED,
    letterSpacing: 1,
  },

  // Ingredient Pills — horizontal slider
  tagScrollWrap: {
    marginTop: 14,
    marginRight: -24,
  },
  tagScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
  },
  tagText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: CHARCOAL,
  },

  // Chef's Tip
  tipContainer: {
    flexDirection: 'row',
    marginTop: 16,
  },
  tipBorder: {
    width: 2.5,
    borderRadius: 1.5,
    backgroundColor: GOLD,
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12.5,
    fontStyle: 'italic',
    color: MUTED,
    lineHeight: 19,
  },
  tipLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontStyle: 'italic',
    color: MUTED,
  },

  // Groups
  group: {
    marginBottom: 20,
  },
  groupDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  groupDividerLine: {
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
    marginRight: 10,
  },
  groupDividerLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: GOLD,
    letterSpacing: 2,
  },
});
