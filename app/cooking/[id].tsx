import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Vibration } from 'react-native';
import { Text, Button } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useCookingStore } from '@/stores/cookingStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { CookingTimer } from '@/components/cooking/CookingTimer';
import { CookingProgress } from '@/components/cooking/CookingProgress';
import { LiveActivity } from '@/services/liveActivity';
import {
  cancelNotification,
  scheduleTimerNotification,
} from '@/services/notifications.service';

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getRecipe, updateRecipe } = useRecipeStore();
  const {
    recipe,
    currentStep,
    timers,
    isVoiceEnabled,
    startSession,
    endSession,
    nextStep,
    previousStep,
    addTimer,
    setTimerNotification,
    removeTimer,
    toggleVoice,
  } = useCookingStore();

  const [isLoading, setIsLoading] = useState(true);
  const primaryTimer = useMemo(() => {
    const activeTimers = timers.filter((timer) => timer.is_active);
    if (activeTimers.length === 0) return null;

    return activeTimers.reduce((soonest, timer) => {
      const timerEnd = new Date(timer.started_at).getTime() + timer.duration_seconds * 1000;
      const soonestEnd = new Date(soonest.started_at).getTime() + soonest.duration_seconds * 1000;
      return timerEnd < soonestEnd ? timer : soonest;
    });
  }, [timers]);

  useEffect(() => {
    loadRecipe();
    return () => {
      Speech.stop();
    };
  }, [id]);

  useEffect(() => {
    if (recipe && isVoiceEnabled) {
      speakCurrentStep();
    }
  }, [currentStep, recipe]);

  useEffect(() => {
    if (!recipe) return;

    if (!primaryTimer) {
      LiveActivity.endTimer();
      return;
    }

    const startTimeMs = new Date(primaryTimer.started_at).getTime();
    const endTimeMs = startTimeMs + primaryTimer.duration_seconds * 1000;

    LiveActivity.startTimer({
      label: primaryTimer.label,
      recipeName: recipe.title,
      startTimeMs,
      endTimeMs,
      key: `${primaryTimer.timer_id}:${primaryTimer.started_at}`,
    });
  }, [
    primaryTimer?.timer_id,
    primaryTimer?.started_at,
    primaryTimer?.duration_seconds,
    recipe?.title,
  ]);

  const loadRecipe = async () => {
    if (!id) return;
    const loadedRecipe = await getRecipe(id);
    if (loadedRecipe) {
      startSession(loadedRecipe);
    }
    setIsLoading(false);
  };

  const speakCurrentStep = () => {
    if (!recipe || !isVoiceEnabled) return;

    const step = recipe.steps[currentStep];
    if (step) {
      Speech.speak(step.instruction, {
        language: 'en-US',
        rate: 0.9,
      });
    }
  };

  const handleNext = () => {
    if (!recipe) return;

    if (currentStep < recipe.steps.length - 1) {
      nextStep();
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    Speech.stop();
    previousStep();
  };

  const handleRepeat = () => {
    speakCurrentStep();
  };

  const handleComplete = () => {
    Alert.alert(
      'Cooking Complete!',
      'Great job! Did you enjoy this recipe?',
      [
        {
          text: 'Not Really',
          style: 'cancel',
          onPress: () => finishCooking(false),
        },
        {
          text: 'Loved It!',
          onPress: () => finishCooking(true),
        },
      ]
    );
  };

  const finishCooking = async (enjoyed: boolean) => {
    if (recipe) {
      await updateRecipe(recipe.id, {
        times_cooked: (recipe.times_cooked || 0) + 1,
        last_cooked_at: new Date().toISOString(),
      });
    }
    await cancelAllTimerNotifications();
    LiveActivity.endTimer();
    endSession();
    router.back();
  };

  const handleExit = () => {
    Alert.alert(
      'Exit Cooking Mode?',
      'Your progress will not be saved.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            cancelAllTimerNotifications();
            LiveActivity.endTimer();
            endSession();
            router.back();
          },
        },
      ]
    );
  };

  const handleAddTimer = async () => {
    const step = recipe?.steps[currentStep];
    if (step?.duration_minutes) {
      const durationSeconds = step.duration_minutes * 60;
      const timerId = addTimer(`Step ${currentStep + 1}`, durationSeconds);
      const notificationId = await scheduleTimerNotification({
        label: `Step ${currentStep + 1}`,
        recipeName: recipe?.title,
        seconds: durationSeconds,
      });
      setTimerNotification(timerId, notificationId);
      Vibration.vibrate(100);
    }
  };

  const cancelAllTimerNotifications = async () => {
    await Promise.all(timers.map((timer) => cancelNotification(timer.notification_id)));
  };

  if (isLoading || !recipe) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading recipe...</Text>
      </View>
    );
  }

  const step = recipe.steps[currentStep];
  const progress = ((currentStep + 1) / recipe.steps.length) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Cooking Mode</Text>
          <Text style={styles.recipeName} numberOfLines={1}>
            {recipe.title}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button
            icon={<Ionicons name="close" size={18} color="#1C100D" />}
            type="clear"
            onPress={handleExit}
            containerStyle={styles.headerButton}
          />
          <Button
            icon={
              <Ionicons
                name={isVoiceEnabled ? 'volume-high' : 'volume-mute'}
                size={18}
                color={isVoiceEnabled ? '#F2330D' : '#1C100D'}
              />
            }
            type="clear"
            onPress={toggleVoice}
            containerStyle={styles.headerButton}
          />
        </View>
      </View>

      {/* Progress */}
      <CookingProgress
        currentStep={currentStep + 1}
        totalSteps={recipe.steps.length}
        progress={progress}
      />

      {/* Current Step */}
      <ScrollView style={styles.content} contentContainerStyle={styles.stepContainer}>
        <View style={styles.stepCard}>
          <Text style={styles.stepNumber}>Step {currentStep + 1}</Text>
          <Text style={styles.stepInstruction}>{step.instruction}</Text>

          {step.temperature && (
            <View style={styles.tempContainer}>
              <Ionicons name="thermometer" size={18} color="#F2330D" />
              <Text style={styles.tempText}>{step.temperature}</Text>
            </View>
          )}

          {step.duration_minutes && (
            <Button
              title={`Set Timer (${step.duration_minutes} min)`}
              type="outline"
              onPress={handleAddTimer}
              buttonStyle={styles.timerButton}
              titleStyle={styles.timerButtonText}
              icon={<Ionicons name="timer-outline" size={18} color="#F2330D" style={{ marginRight: 8 }} />}
            />
          )}
        </View>
      </ScrollView>

      {/* Active Timers */}
      {timers.length > 0 && (
        <View style={styles.timersContainer}>
          {timers.map((timer) => (
            <CookingTimer
              key={timer.timer_id}
              timer={timer}
              onComplete={() => {
                Vibration.vibrate([0, 500, 200, 500]);
                Alert.alert('Timer Done!', timer.label);
                cancelNotification(timer.notification_id);
                removeTimer(timer.timer_id);
              }}
              onRemove={() => {
                cancelNotification(timer.notification_id);
                removeTimer(timer.timer_id);
              }}
            />
          ))}
        </View>
      )}

      {/* Navigation */}
      <View style={styles.navigation}>
        <Button
          icon={<Ionicons name="arrow-back" size={20} color="#1C100D" />}
          type="clear"
          onPress={handlePrevious}
          disabled={currentStep === 0}
          containerStyle={styles.navIcon}
        />
        <Button
          icon={<Ionicons name="refresh" size={20} color="#F2330D" />}
          type="clear"
          onPress={handleRepeat}
          containerStyle={styles.navIcon}
        />
        <Button
          title={currentStep === recipe.steps.length - 1 ? 'Done!' : 'Next'}
          onPress={handleNext}
          buttonStyle={styles.nextButton}
          titleStyle={styles.nextButtonText}
          icon={
            currentStep < recipe.steps.length - 1 ? (
              <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
            ) : (
              <Ionicons name="checkmark" size={20} color="#FFF" style={{ marginLeft: 8 }} />
            )
          }
          iconRight
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
  },
  kicker: {
    color: '#9C5749',
    fontFamily: 'NotoSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  recipeName: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginTop: 6,
    maxWidth: 260,
  },
  headerActions: {
    position: 'absolute',
    right: 20,
    top: 56,
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8D3CE',
  },
  stepNumber: {
    fontSize: 12,
    color: '#F2330D',
    fontFamily: 'NotoSans_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  stepInstruction: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
    lineHeight: 32,
    marginBottom: 20,
  },
  tempContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2CC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  tempText: {
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F2330D',
  },
  timerButton: {
    borderColor: '#F2330D',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  timerButtonText: {
    color: '#F2330D',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  timersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F6F5',
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#F0E6E2',
    backgroundColor: '#F8F6F5',
  },
  navIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8D3CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButton: {
    backgroundColor: '#F2330D',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  nextButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
  },
});
