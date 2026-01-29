import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Vibration,
  Image,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  Linking,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCookingStore } from '@/stores/cookingStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { LiveActivity } from '@/services/liveActivity';
import { useScreenLayout } from '@/hooks/useScreenLayout';
import {
  cancelNotification,
  scheduleTimerNotification,
} from '@/services/notifications.service';

// Safe native module loading — returns null in Expo Go (no crash)
const SpeechRecognition: any = requireOptionalNativeModule('ExpoSpeechRecognition');
const VOICE_AVAILABLE = !!SpeechRecognition;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

export default function CookingModeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const layout = useScreenLayout({ hasTabBar: false, headerPadding: 12 });
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
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const introAnim = useRef(new Animated.Value(0)).current;
  const swipeHintAnim = useRef(new Animated.Value(0)).current;
  const listeningRef = useRef(false);

  // Find the timer for the current step
  const currentStepTimer = useMemo(() => {
    return timers.find((timer) => timer.label === `Step ${currentStep + 1}` && timer.is_active);
  }, [timers, currentStep]);

  const primaryTimer = useMemo(() => {
    const activeTimers = timers.filter((timer) => timer.is_active);
    if (activeTimers.length === 0) return null;

    return activeTimers.reduce((soonest, timer) => {
      const timerEnd = new Date(timer.started_at).getTime() + timer.duration_seconds * 1000;
      const soonestEnd = new Date(soonest.started_at).getTime() + soonest.duration_seconds * 1000;
      return timerEnd < soonestEnd ? timer : soonest;
    });
  }, [timers]);

  // Update countdown for current step timer
  useEffect(() => {
    if (!currentStepTimer) {
      setRemainingSeconds(null);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    const startTime = new Date(currentStepTimer.started_at).getTime();
    const endTime = startTime + currentStepTimer.duration_seconds * 1000;

    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        Vibration.vibrate([0, 500, 200, 500]);
        Alert.alert('Timer Done!', currentStepTimer.label);
        cancelNotification(currentStepTimer.notification_id);
        removeTimer(currentStepTimer.timer_id);
      }
    };

    updateRemaining();
    timerIntervalRef.current = setInterval(updateRemaining, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [currentStepTimer?.timer_id, currentStepTimer?.started_at]);

  useEffect(() => {
    loadRecipe();
    return () => {
      Speech.stop();
      stopListening();
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

    const labelMatch = primaryTimer.label.match(/\d+/);
    const parsedStepIndex = labelMatch ? Number(labelMatch[0]) : null;
    const stepIndex = parsedStepIndex && parsedStepIndex > 0 ? parsedStepIndex : currentStep + 1;
    const totalSteps = recipe.steps.length;
    const stepLabel = `STEP ${stepIndex} OF ${totalSteps}`;
    const stepTitle =
      recipe.steps[stepIndex - 1]?.instruction ?? primaryTimer.label;

    LiveActivity.startTimer({
      label: stepTitle,
      recipeName: recipe.title,
      stepLabel,
      startTimeMs,
      endTimeMs,
      key: `${primaryTimer.timer_id}:${primaryTimer.started_at}`,
    });
  }, [
    primaryTimer?.timer_id,
    primaryTimer?.started_at,
    primaryTimer?.duration_seconds,
    currentStep,
    recipe?.steps.length,
    recipe?.title,
  ]);

  // Intro animation
  useEffect(() => {
    if (showIntro && !isLoading && recipe) {
      Animated.spring(introAnim, {
        toValue: 1,
        damping: 20,
        stiffness: 150,
        useNativeDriver: true,
      }).start();

      const loopAnimation = () => {
        Animated.sequence([
          Animated.timing(swipeHintAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(swipeHintAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (showIntro) loopAnimation();
        });
      };
      loopAnimation();
    }
  }, [showIntro, isLoading, recipe]);

  // ============================================
  // VOICE COMMANDS via native module (safe)
  // ============================================
  useEffect(() => {
    if (!SpeechRecognition || !isListening) return;

    const resultSub = SpeechRecognition.addListener('result', (event: any) => {
      const transcript = event?.results?.[0]?.transcript?.toLowerCase() || '';

      if (transcript.includes('next') || transcript.includes('التالي')) {
        handleNext();
        Vibration.vibrate(50);
      } else if (transcript.includes('back') || transcript.includes('previous') || transcript.includes('السابق')) {
        handlePrevious();
        Vibration.vibrate(50);
      } else if (transcript.includes('repeat') || transcript.includes('اعد')) {
        speakCurrentStep();
      } else if (transcript.includes('timer') || transcript.includes('start')) {
        handleAddTimer();
        Vibration.vibrate(50);
      }
    });

    const endSub = SpeechRecognition.addListener('end', () => {
      if (listeningRef.current) {
        setTimeout(() => {
          try {
            SpeechRecognition.start({
              lang: 'en-US',
              interimResults: false,
              continuous: true,
            });
          } catch {}
        }, 300);
      }
    });

    const errorSub = SpeechRecognition.addListener('error', () => {
      if (listeningRef.current) {
        setTimeout(() => {
          try {
            SpeechRecognition.start({
              lang: 'en-US',
              interimResults: false,
              continuous: true,
            });
          } catch {}
        }, 1000);
      }
    });

    return () => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, [isListening, currentStep]);

  const startListening = useCallback(async () => {
    if (!SpeechRecognition) return;

    try {
      const result = await SpeechRecognition.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert('Permission Needed', 'Microphone access is required for voice commands.');
        return;
      }

      SpeechRecognition.start({
        lang: 'en-US',
        interimResults: false,
        continuous: true,
      });
      listeningRef.current = true;
      setIsListening(true);
    } catch {
      // Failed to start
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!SpeechRecognition) return;
    try {
      SpeechRecognition.stop();
    } catch {}
    listeningRef.current = false;
    setIsListening(false);
  }, []);

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

  const handleOpenSourceVideo = () => {
    if (recipe?.source_url) {
      Linking.openURL(recipe.source_url);
    }
  };

  // ============================================
  // SWIPE GESTURES (hands-free navigation)
  // ============================================
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 40;
      },
      onPanResponderMove: (_, gestureState) => {
        swipeAnim.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.timing(swipeAnim, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            handleNext();
            swipeAnim.setValue(0);
            Vibration.vibrate(30);
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          Animated.timing(swipeAnim, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            handlePrevious();
            swipeAnim.setValue(0);
            Vibration.vibrate(30);
          });
        } else {
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const swipeLeftOpacity = swipeAnim.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const swipeRightOpacity = swipeAnim.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ============================================
  // MENU ANIMATION
  // ============================================
  const openMenu = useCallback(() => {
    setShowMenu(true);
    Animated.spring(menuAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 200,
      useNativeDriver: true,
    }).start();
  }, [menuAnim]);

  const closeMenu = useCallback(() => {
    Animated.timing(menuAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => setShowMenu(false));
  }, [menuAnim]);

  const menuScale = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const menuOpacity = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // ============================================
  // INTRO DISMISS
  // ============================================
  const dismissIntro = useCallback((enableVoiceCommands: boolean) => {
    if (enableVoiceCommands && VOICE_AVAILABLE) {
      startListening();
    }
    Animated.timing(introAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowIntro(false));
  }, [startListening]);

  const handleToggleVoiceCommands = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

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
            stopListening();
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

  const handleStopTimer = () => {
    if (currentStepTimer) {
      cancelNotification(currentStepTimer.notification_id);
      removeTimer(currentStepTimer.timer_id);
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
  const stepNumber = String(currentStep + 1).padStart(2, '0');
  const totalSteps = recipe.steps.length;

  const formatTimerDuration = (minutes: number) => {
    const mins = String(minutes).padStart(2, '0');
    return `${mins}:00`;
  };

  const formatRemainingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isTimerRunning = !!currentStepTimer && remainingSeconds !== null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, layout.headerStyle]}>
        <Pressable onPress={handleExit} style={styles.headerButton}>
          <Ionicons name="close" size={24} color="#9CA3AF" />
        </Pressable>
        <View style={styles.headerCenter}>
          {isListening ? (
            <Pressable onPress={handleToggleVoiceCommands} style={styles.listeningBadge}>
              <View style={styles.listeningDot} />
              <Text style={styles.listeningText}>Listening...</Text>
            </Pressable>
          ) : (
            <Text style={styles.recipeName} numberOfLines={1}>
              {recipe.title.toUpperCase()}
            </Text>
          )}
        </View>
        <Pressable onPress={openMenu} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Swipe Direction Indicators */}
      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorLeft, { opacity: swipeRightOpacity }]} pointerEvents="none">
        <Ionicons name="chevron-back" size={28} color="#F2330D" />
        <Text style={styles.swipeIndicatorText}>PREV</Text>
      </Animated.View>
      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorRight, { opacity: swipeLeftOpacity }]} pointerEvents="none">
        <Text style={styles.swipeIndicatorText}>NEXT</Text>
        <Ionicons name="chevron-forward" size={28} color="#F2330D" />
      </Animated.View>

      {/* Options Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
      >
        <TouchableWithoutFeedback onPress={closeMenu}>
          <Animated.View style={[styles.menuOverlay, { opacity: menuOpacity }]}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.menuContainer,
                  {
                    opacity: menuOpacity,
                    transform: [{ scale: menuScale }, { translateY: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10, 0],
                    }) }],
                  },
                ]}
              >
                <BlurView intensity={90} tint="light" style={styles.menuBlur}>
                  <View style={styles.menuContent}>
                    {/* Voice Commands */}
                    {VOICE_AVAILABLE && (
                      <>
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            handleToggleVoiceCommands();
                            closeMenu();
                          }}
                        >
                          <View style={[styles.menuIconContainer, isListening && styles.menuIconActive]}>
                            <Ionicons
                              name={isListening ? 'mic' : 'mic-off'}
                              size={20}
                              color={isListening ? '#F2330D' : '#64748B'}
                            />
                          </View>
                          <View style={styles.menuItemText}>
                            <Text style={styles.menuItemTitle}>Voice Commands</Text>
                            <Text style={styles.menuItemSubtitle}>
                              {isListening ? 'Say "next" or "back"' : 'Hands-free control'}
                            </Text>
                          </View>
                          <View style={[styles.menuToggle, isListening && styles.menuToggleActive]}>
                            <View style={[styles.menuToggleKnob, isListening && styles.menuToggleKnobActive]} />
                          </View>
                        </Pressable>
                        <View style={styles.menuDivider} />
                      </>
                    )}

                    {/* Read Aloud */}
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        toggleVoice();
                        closeMenu();
                      }}
                    >
                      <View style={[styles.menuIconContainer, isVoiceEnabled && styles.menuIconActive]}>
                        <Ionicons
                          name={isVoiceEnabled ? 'volume-high' : 'volume-mute'}
                          size={20}
                          color={isVoiceEnabled ? '#F2330D' : '#64748B'}
                        />
                      </View>
                      <View style={styles.menuItemText}>
                        <Text style={styles.menuItemTitle}>Read Aloud</Text>
                        <Text style={styles.menuItemSubtitle}>
                          {isVoiceEnabled ? 'Steps read automatically' : 'Read steps out loud'}
                        </Text>
                      </View>
                      <View style={[styles.menuToggle, isVoiceEnabled && styles.menuToggleActive]}>
                        <View style={[styles.menuToggleKnob, isVoiceEnabled && styles.menuToggleKnobActive]} />
                      </View>
                    </Pressable>

                    {recipe.source_url && (
                      <>
                        <View style={styles.menuDivider} />
                        <Pressable
                          style={styles.menuItem}
                          onPress={() => {
                            closeMenu();
                            handleOpenSourceVideo();
                          }}
                        >
                          <View style={styles.menuIconContainer}>
                            <Ionicons name="play-circle" size={20} color="#64748B" />
                          </View>
                          <View style={styles.menuItemText}>
                            <Text style={styles.menuItemTitle}>Watch Video</Text>
                            <Text style={styles.menuItemSubtitle}>Open original recipe video</Text>
                          </View>
                        </Pressable>
                      </>
                    )}

                    <View style={styles.menuDivider} />

                    {/* All Steps */}
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        closeMenu();
                      }}
                    >
                      <View style={styles.menuIconContainer}>
                        <Ionicons name="list" size={20} color="#64748B" />
                      </View>
                      <View style={styles.menuItemText}>
                        <Text style={styles.menuItemTitle}>All Steps</Text>
                        <Text style={styles.menuItemSubtitle}>
                          {`Step ${currentStep + 1} of ${recipe?.steps.length}`}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.menuDivider} />

                    {/* Exit */}
                    <Pressable
                      style={styles.menuItem}
                      onPress={() => {
                        closeMenu();
                        handleExit();
                      }}
                    >
                      <View style={styles.menuIconContainer}>
                        <Ionicons name="exit-outline" size={20} color="#EF4444" />
                      </View>
                      <View style={styles.menuItemText}>
                        <Text style={[styles.menuItemTitle, { color: '#EF4444' }]}>Exit Cooking</Text>
                        <Text style={styles.menuItemSubtitle}>Progress won't be saved</Text>
                      </View>
                    </Pressable>
                  </View>
                </BlurView>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Intro Modal */}
      {showIntro && (
        <Modal transparent animationType="none" visible={showIntro}>
          <View style={styles.introOverlay}>
            <Animated.View
              style={[
                styles.introCard,
                {
                  opacity: introAnim,
                  transform: [
                    { scale: introAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                    { translateY: introAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
                  ],
                },
              ]}
            >
              <View style={styles.introIconContainer}>
                <Ionicons name="hand-left-outline" size={36} color="#F2330D" />
              </View>

              <Text style={styles.introTitle}>Hands-Free Cooking</Text>
              <Text style={styles.introSubtitle}>
                Navigate steps without touching your phone
              </Text>

              {/* Feature: Swipe */}
              <View style={styles.introFeature}>
                <View style={styles.introFeatureIcon}>
                  <Animated.View
                    style={{
                      transform: [{
                        translateX: swipeHintAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-12, 12],
                        }),
                      }],
                    }}
                  >
                    <Ionicons name="swap-horizontal" size={24} color="#F2330D" />
                  </Animated.View>
                </View>
                <View style={styles.introFeatureText}>
                  <Text style={styles.introFeatureTitle}>Swipe to Navigate</Text>
                  <Text style={styles.introFeatureDesc}>
                    Swipe left for next step, right for previous
                  </Text>
                </View>
              </View>

              {/* Feature: Voice Commands */}
              <View style={[styles.introFeature, !VOICE_AVAILABLE && styles.introFeatureDisabled]}>
                <View style={styles.introFeatureIcon}>
                  <Ionicons name="mic" size={24} color={VOICE_AVAILABLE ? '#F2330D' : '#CBD5E1'} />
                </View>
                <View style={styles.introFeatureText}>
                  <Text style={[styles.introFeatureTitle, !VOICE_AVAILABLE && { color: '#9CA3AF' }]}>
                    Voice Commands
                  </Text>
                  <Text style={styles.introFeatureDesc}>
                    {VOICE_AVAILABLE
                      ? 'Say "next step", "go back", or "start timer"'
                      : 'Requires a development build (run npx expo prebuild)'}
                  </Text>
                </View>
              </View>

              {/* Buttons */}
              {VOICE_AVAILABLE ? (
                <>
                  <Pressable
                    style={styles.introStartButton}
                    onPress={() => dismissIntro(true)}
                  >
                    <Ionicons name="mic" size={20} color="#FFF" />
                    <Text style={styles.introStartButtonText}>Start with Voice</Text>
                  </Pressable>

                  <Pressable
                    style={styles.introSkipButton}
                    onPress={() => dismissIntro(false)}
                  >
                    <Text style={styles.introSkipButtonText}>Start with Swipe Only</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    style={styles.introStartButton}
                    onPress={() => dismissIntro(false)}
                  >
                    <Ionicons name="swap-horizontal" size={20} color="#FFF" />
                    <Text style={styles.introStartButtonText}>Start Cooking</Text>
                  </Pressable>

                  <View style={styles.introBuildNote}>
                    <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.introBuildNoteText}>
                      Voice commands need a native build. Run{' '}
                      <Text style={{ fontFamily: 'PlusJakartaSans_700Bold' }}>npx expo prebuild</Text>
                      {' '}then build through Xcode.
                    </Text>
                  </View>
                </>
              )}
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Main Content with swipe gesture */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX: swipeAnim }] }]}
        {...panResponder.panHandlers}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Recipe Image */}
          {recipe.thumbnail_url && (
            <Pressable
              style={styles.imageContainer}
              onPress={recipe.source_url ? handleOpenSourceVideo : undefined}
              disabled={!recipe.source_url}
            >
              <Image
                source={{ uri: recipe.thumbnail_url }}
                style={styles.recipeImage}
                resizeMode="cover"
              />
              <View style={styles.imageGradient} />
              {recipe.source_url ? (
                <View style={styles.rewatchButton}>
                  <Ionicons name="play-circle" size={18} color="#FFF" />
                  <Text style={styles.rewatchText}>REWATCH</Text>
                </View>
              ) : null}
            </Pressable>
          )}

          {/* Step Card */}
          <View style={styles.stepCard}>
            <Text style={styles.stepWatermark}>{stepNumber}</Text>

            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                STEP {currentStep + 1} OF {totalSteps}
              </Text>
            </View>

            <Text style={styles.stepInstruction}>{step.instruction}</Text>

            {step.temperature && (
              <View style={styles.tipContainer}>
                <Ionicons name="bulb-outline" size={20} color="#F2330D" />
                <Text style={styles.tipText}>
                  Set your oven or stove to {step.temperature} for best results.
                </Text>
              </View>
            )}

            {step.duration_minutes && (
              <View style={[styles.timerCard, isTimerRunning && styles.timerCardRunning]}>
                <View style={styles.timerLeft}>
                  <View style={[styles.timerIconContainer, isTimerRunning && styles.timerIconRunning]}>
                    <Ionicons name="timer-outline" size={28} color="#FFF" />
                  </View>
                  <View>
                    <Text style={styles.timerLabel}>
                      {isTimerRunning ? 'Time Left' : 'Timer'}
                    </Text>
                    <Text style={styles.timerValue}>
                      {isTimerRunning
                        ? formatRemainingTime(remainingSeconds!)
                        : formatTimerDuration(step.duration_minutes)}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.startButton, isTimerRunning && styles.stopButton]}
                  onPress={isTimerRunning ? handleStopTimer : handleAddTimer}
                >
                  <Text style={[styles.startButtonText, isTimerRunning && styles.stopButtonText]}>
                    {isTimerRunning ? 'STOP' : 'START'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Active Timers from other steps */}
          {timers.filter(t => t.label !== `Step ${currentStep + 1}`).length > 0 && (
            <View style={styles.timersContainer}>
              <Text style={styles.otherTimersLabel}>Other Active Timers</Text>
              {timers
                .filter(t => t.label !== `Step ${currentStep + 1}`)
                .map((timer) => (
                  <View key={timer.timer_id} style={styles.otherTimerItem}>
                    <View style={styles.otherTimerInfo}>
                      <Ionicons name="timer-outline" size={18} color="#F2330D" />
                      <Text style={styles.otherTimerLabel}>{timer.label}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        cancelNotification(timer.notification_id);
                        removeTimer(timer.timer_id);
                      }}
                    >
                      <Ionicons name="close-circle" size={22} color="#9CA3AF" />
                    </Pressable>
                  </View>
                ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, layout.fixedBottomStyle]}>
        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentStep && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        <View style={styles.navButtons}>
          <Pressable
            style={[styles.backButton, currentStep === 0 && styles.backButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentStep === 0}
          >
            <Ionicons
              name="arrow-back"
              size={28}
              color={currentStep === 0 ? '#CBD5E1' : '#64748B'}
            />
            <Text style={[styles.backButtonText, currentStep === 0 && styles.backButtonTextDisabled]}>
              BACK
            </Text>
          </Pressable>

          <Pressable style={styles.nextButton} onPress={handleNext}>
            <View style={styles.nextButtonContent}>
              <Text style={styles.nextButtonKicker}>
                {currentStep === totalSteps - 1 ? 'FINISH' : 'COMING UP'}
              </Text>
              <Text style={styles.nextButtonText}>
                {currentStep === totalSteps - 1 ? 'Complete' : 'Next Step'}
              </Text>
            </View>
            <Ionicons
              name={currentStep === totalSteps - 1 ? 'checkmark' : 'chevron-forward'}
              size={32}
              color="#FFF"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FCFAF9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FCFAF9',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  recipeName: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#9CA3AF',
    letterSpacing: 2,
  },
  listeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F2330D',
  },
  listeningText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#F2330D',
    letterSpacing: 0.5,
  },
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 220,
  },
  // Swipe Indicators
  swipeIndicator: {
    position: 'absolute',
    top: '45%',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 2,
  },
  swipeIndicatorLeft: {
    left: 8,
  },
  swipeIndicatorRight: {
    right: 8,
  },
  swipeIndicatorText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F2330D',
    letterSpacing: 1,
  },
  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 7,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#E5E7EB',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
  },
  rewatchButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rewatchText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 0.5,
  },
  // Step Card
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  stepWatermark: {
    position: 'absolute',
    top: 20,
    right: 24,
    fontSize: 48,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: 'rgba(242, 51, 13, 0.1)',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  stepBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F2330D',
    letterSpacing: 1.5,
  },
  stepInstruction: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
    lineHeight: 28,
    marginBottom: 20,
    paddingRight: 40,
  },
  // Tip
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F8F6F5',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0E6E2',
    marginBottom: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#64748B',
    lineHeight: 22,
  },
  // Timer Card
  timerCard: {
    backgroundColor: '#F2330D',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 4,
    borderColor: '#FFF',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  timerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  startButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#F2330D',
    letterSpacing: 0.5,
  },
  timerCardRunning: {
    backgroundColor: '#1C100D',
  },
  timerIconRunning: {
    backgroundColor: 'rgba(242, 51, 13, 0.3)',
  },
  stopButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  stopButtonText: {
    color: '#FFF',
  },
  // Other Timers
  timersContainer: {
    marginTop: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
  },
  otherTimersLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  otherTimerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6E2',
  },
  otherTimerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otherTimerLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
  },
  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(252, 250, 249, 0.9)',
    paddingHorizontal: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  progressDot: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  progressDotActive: {
    backgroundColor: '#F2330D',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  navButtons: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  backButton: {
    width: 80,
    height: 80,
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButtonDisabled: {
    opacity: 0.5,
  },
  backButtonText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#64748B',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  backButtonTextDisabled: {
    color: '#CBD5E1',
  },
  nextButton: {
    flex: 1,
    height: 80,
    backgroundColor: '#F2330D',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  nextButtonContent: {
    alignItems: 'flex-start',
  },
  nextButtonKicker: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  nextButtonText: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
  },
  // Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 100,
    paddingRight: 20,
  },
  menuContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  menuBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  menuContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 8,
    minWidth: 260,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconActive: {
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1C100D',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginHorizontal: 14,
  },
  menuToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5E7EB',
    padding: 3,
    justifyContent: 'center',
  },
  menuToggleActive: {
    backgroundColor: '#F2330D',
  },
  menuToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  menuToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  // Intro Modal
  introOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  introCard: {
    backgroundColor: '#FFF',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 10,
  },
  introIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  introTitle: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
    marginBottom: 8,
  },
  introSubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  introFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: '#F8F6F5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  introFeatureDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.7,
  },
  introFeatureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(242, 51, 13, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introFeatureText: {
    flex: 1,
  },
  introFeatureTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
    marginBottom: 2,
  },
  introFeatureDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    lineHeight: 18,
  },
  introStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2330D',
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    marginTop: 16,
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  introStartButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
  },
  introSkipButton: {
    paddingVertical: 14,
    marginTop: 4,
  },
  introSkipButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9CA3AF',
  },
  introBuildNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  introBuildNoteText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#9CA3AF',
    lineHeight: 18,
  },
});
