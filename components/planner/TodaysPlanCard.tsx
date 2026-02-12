import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@rneui/themed';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { DayNutritionSummary } from '@/utils/types';

const C = {
  charcoal: '#1A1510',
  gold: '#D4AF37',
  muted: '#8A8578',
};

interface TodaysPlanCardProps {
  nutrition: DayNutritionSummary;
}

export default function TodaysPlanCard({ nutrition }: TodaysPlanCardProps) {
  const router = useRouter();
  const { filledSlots, totalCalories, totalTimeMinutes, firstRecipeId } = nutrition;
  const hasPlans = filledSlots > 0;

  const timeLabel = totalTimeMinutes < 60
    ? `${totalTimeMinutes} min`
    : `${Math.round(totalTimeMinutes / 60 * 2) / 2} hr`;

  const handleStartCooking = () => {
    if (!firstRecipeId) return;
    router.push(`/cooking/${firstRecipeId}`);
  };

  return (
    <LinearGradient
      colors={['rgba(212,175,55,0.10)', 'rgba(250,250,248,1)']}
      style={styles.card}
    >
      <View style={styles.header}>
        <Ionicons name="today-outline" size={18} color={C.gold} />
        <Text style={styles.title}>Today's Plan</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{filledSlots}</Text>
          <Text style={styles.statLabel}>{filledSlots === 1 ? 'meal' : 'meals'} planned</Text>
        </View>
        {totalTimeMinutes > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{timeLabel}</Text>
            <Text style={styles.statLabel}>cook time</Text>
          </View>
        )}
        {totalCalories > 0 && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalCalories}</Text>
            <Text style={styles.statLabel}>calories</Text>
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.startBtn,
          !hasPlans && styles.startBtnDisabled,
          pressed && hasPlans && { opacity: 0.85 },
        ]}
        onPress={handleStartCooking}
        disabled={!hasPlans}
      >
        <Ionicons name="flame-outline" size={18} color="#FFFFFF" />
        <Text style={styles.startBtnText}>Start Cooking</Text>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: C.charcoal,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  stat: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: C.charcoal,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.charcoal,
    borderRadius: 24,
    paddingVertical: 14,
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
