import { useEffect, useMemo, useState, useRef, useCallback, type ComponentType } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Vibration,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  AppState,
  Linking,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Text } from '@rneui/themed';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { getIngredientImage } from '@/utils/ingredientImages';
import { getIngredientEmoji } from '@/utils/ingredientEmojis';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
  VOICE_AVAILABLE,
} from '@/utils/speechRecognition';
import { useCookingStore } from '@/stores/cookingStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { LiveActivity } from '@/services/liveActivity';
import { useScreenLayout } from '@/hooks/useScreenLayout';
import {
  cancelNotification,
  scheduleTimerNotification,
} from '@/services/notifications.service';

// ============================================================
// DESIGN TOKENS — Michelin-Star Luxury
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  glassStrong: 'rgba(255, 255, 255, 0.94)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const EmbeddedWebView: ComponentType<any> | null = (() => {
  try {
    return require('react-native-webview').WebView as ComponentType<any>;
  } catch (error) {
    console.warn('[Cooking] react-native-webview native module is unavailable:', error);
    return null;
  }
})();

export default function CookingModeScreen() {
  const { id, laAction, laNonce, laStep } = useLocalSearchParams<{
    id: string;
    laAction?: string | string[];
    laNonce?: string | string[];
    laStep?: string | string[];
  }>();
  const router = useRouter();
  const layout = useScreenLayout({ hasTabBar: false, headerPadding: 12 });
  const { getRecipe, updateRecipe } = useRecipeStore();
  const {
    recipe,
    currentStep,
    timers,
    startSession,
    endSession,
    nextStep,
    previousStep,
    goToStep,
    addTimer,
    setTimerNotification,
    removeTimer,
  } = useCookingStore();

  const [isLoading, setIsLoading] = useState(true);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [miniPlayerUrl, setMiniPlayerUrl] = useState<string | null>(null);
  const [miniPlayerExpanded, setMiniPlayerExpanded] = useState(false);
  const [miniPlayerLoading, setMiniPlayerLoading] = useState(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLiveActivityActionKeyRef = useRef<string | null>(null);
  const lastAppliedResumeStepRef = useRef<string | null>(null);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const introAnim = useRef(new Animated.Value(0)).current;

  const listeningRef = useRef(false);

  // Reanimated shared values for smooth swipe
  const translateX = useSharedValue(0);
  const processedCountsRef = useRef<Record<string, number>>({});
  const isSpeakingRef = useRef(false);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveBars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  // Compute totalSteps
  const totalSteps = recipe?.steps?.length ?? 0;

  const [completedTimers, setCompletedTimers] = useState<string[]>([]);

  // Find the timer for the current step
  const currentStepTimer = useMemo(() => {
    return timers.find((timer) => timer.label === `Step ${currentStep + 1}` && timer.is_active);
  }, [timers, currentStep]);

  const primaryTimer = useMemo(() => {
    // Check for active timers first
    const activeTimers = timers.filter((timer) => timer.is_active);
    if (activeTimers.length > 0) {
      return activeTimers.reduce((soonest, timer) => {
        const timerEnd = new Date(timer.started_at).getTime() + timer.duration_seconds * 1000;
        const soonestEnd = new Date(soonest.started_at).getTime() + soonest.duration_seconds * 1000;
        return timerEnd < soonestEnd ? timer : soonest;
      });
    }

    // If no active, check for the most recently completed one that's still "sticky"
    if (completedTimers.length > 0) {
      const lastId = completedTimers[completedTimers.length - 1];
      return timers.find(t => t.timer_id === lastId) || null;
    }

    return null;
  }, [timers, completedTimers]);

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

        // Mark as completed for the UI/Live Activity
        const tId = currentStepTimer.timer_id;
        setCompletedTimers(prev => [...prev, tId]);

        // IMMEDIATE UPDATE: Force-sync the Live Activity with the Done state
        if (recipe) {
          const step = recipe.steps[currentStep];
          LiveActivity.startCooking({
            recipeId: id!,
            stepInstruction: step?.instruction || `Step ${currentStep + 1}`,
            recipeName: recipe.title,
            stepNumber: currentStep + 1,
            totalSteps: recipe.steps.length,
            timerEndTimeMs: endTime,
            isTimerDone: true,
          });
        }

        // Keep it for 10 seconds so the user sees the green checkmark
        setTimeout(() => {
          removeTimer(tId);
          setCompletedTimers(prev => prev.filter(id => id !== tId));
        }, 10000);
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
  }, [currentStepTimer?.timer_id, currentStepTimer?.started_at, recipe, currentStep]);

  useEffect(() => {
    loadRecipe();
    return () => {
      stopListening();
    };
  }, [id]);

  // Resume exactly where the user left off when opening from Live Activity.
  useEffect(() => {
    if (!recipe || recipe.steps.length === 0) return;

    const normalizedStep = Array.isArray(laStep) ? laStep[0] : laStep;
    if (!normalizedStep) return;

    const parsedStep = Number.parseInt(normalizedStep, 10);
    if (!Number.isInteger(parsedStep) || parsedStep < 0) return;

    const clampedStep = Math.min(parsedStep, recipe.steps.length - 1);
    const resumeKey = `${recipe.id}:${clampedStep}`;

    if (lastAppliedResumeStepRef.current === resumeKey) return;
    lastAppliedResumeStepRef.current = resumeKey;

    goToStep(clampedStep);
  }, [goToStep, laStep, recipe]);

  // Dynamic Island: show cooking status throughout the session
  useEffect(() => {
    if (!recipe) return;

    const step = recipe.steps[currentStep];
    const timerEndTimeMs = primaryTimer
      ? new Date(primaryTimer.started_at).getTime() + primaryTimer.duration_seconds * 1000
      : undefined;
    const isTimerDone = primaryTimer ? completedTimers.includes(primaryTimer.timer_id) : false;

    LiveActivity.startCooking({
      recipeId: id!,
      stepInstruction: step?.instruction || `Step ${currentStep + 1}`,
      recipeName: recipe.title,
      stepNumber: currentStep + 1,
      totalSteps: recipe.steps.length,
      timerEndTimeMs,
      isTimerDone,
    });
  }, [
    currentStep,
    primaryTimer?.timer_id,
    primaryTimer?.started_at,
    primaryTimer?.duration_seconds,
    recipe?.steps.length,
    recipe?.title,
    completedTimers,
  ]);

  // Sync Live Activity when app returns from background (timers may have expired)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && recipe) {
        // Check all running timers — mark any that expired while backgrounded
        for (const timer of timers) {
          const endTime = new Date(timer.started_at).getTime() + timer.duration_seconds * 1000;
          if (Date.now() >= endTime && !completedTimers.includes(timer.timer_id)) {
            setCompletedTimers(prev => {
              if (prev.includes(timer.timer_id)) return prev;
              return [...prev, timer.timer_id];
            });
          }
        }

        // Force an immediate Live Activity update with current state
        const step = recipe.steps[currentStep];
        const timerEndTimeMs = primaryTimer
          ? new Date(primaryTimer.started_at).getTime() + primaryTimer.duration_seconds * 1000
          : undefined;
        const isTimerDone = primaryTimer
          ? completedTimers.includes(primaryTimer.timer_id) || (timerEndTimeMs != null && Date.now() >= timerEndTimeMs)
          : false;

        LiveActivity.startCooking({
          recipeId: id!,
          stepInstruction: step?.instruction || `Step ${currentStep + 1}`,
          recipeName: recipe.title,
          stepNumber: currentStep + 1,
          totalSteps: recipe.steps.length,
          timerEndTimeMs,
          isTimerDone,
        });
      }
    });

    return () => sub.remove();
  }, [recipe, currentStep, timers, completedTimers, primaryTimer, id]);

  // Voice hint banner — fade in then auto-dismiss
  useEffect(() => {
    if (showIntro && !isLoading && recipe && VOICE_AVAILABLE) {
      Animated.timing(introAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => dismissIntro(), 6000);
      return () => clearTimeout(timer);
    }
  }, [showIntro, isLoading, recipe]);

  // ============================================
  // SOUND WAVE ANIMATION
  // ============================================
  // Wave bars: breathing idle + fast burst when speaking
  useEffect(() => {
    if (!isListening) {
      waveBars.forEach(bar => {
        bar.stopAnimation();
        bar.setValue(0.3);
      });
      return;
    }

    // Smooth breathing animation — each bar on its own rhythm
    const heights = [0.35, 0.5, 0.65, 0.5, 0.35];
    waveBars.forEach((bar, i) => {
      const breathe = () => {
        if (!listeningRef.current) return;
        if (isSpeakingRef.current) return;
        Animated.sequence([
          Animated.timing(bar, {
            toValue: heights[i],
            duration: 700 + i * 150,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.2,
            duration: 700 + i * 150,
            useNativeDriver: true,
          }),
        ]).start(() => breathe());
      };
      setTimeout(breathe, i * 100);
    });

    return () => {
      waveBars.forEach(bar => bar.stopAnimation());
    };
  }, [isListening]);

  const startWaveBounce = useCallback(() => {
    waveBars.forEach(bar => bar.stopAnimation());
    waveBars.forEach((bar, i) => {
      const bounce = () => {
        if (!isSpeakingRef.current) return;
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 0.5 + Math.random() * 0.5,
            duration: 60 + Math.random() * 80,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.1 + Math.random() * 0.15,
            duration: 60 + Math.random() * 80,
            useNativeDriver: true,
          }),
        ]).start(() => bounce());
      };
      setTimeout(bounce, i * 30);
    });
  }, [waveBars]);

  const stopWaveBounce = useCallback(() => {
    waveBars.forEach(bar => bar.stopAnimation());
    // Return to breathing idle
    const heights = [0.35, 0.5, 0.65, 0.5, 0.35];
    waveBars.forEach((bar, i) => {
      const breathe = () => {
        if (!listeningRef.current) return;
        if (isSpeakingRef.current) return;
        Animated.sequence([
          Animated.timing(bar, {
            toValue: heights[i],
            duration: 700 + i * 150,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.2,
            duration: 700 + i * 150,
            useNativeDriver: true,
          }),
        ]).start(() => breathe());
      };
      Animated.timing(bar, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }).start(() => breathe());
    });
  }, [waveBars]);

  // ============================================
  // VOICE COMMANDS (using package hooks)
  // ============================================
  useSpeechRecognitionEvent('result', (event: any) => {
    if (!listeningRef.current) return;
    const transcript = event?.results?.[0]?.transcript?.toLowerCase()?.trim() || '';
    if (!transcript) return;
    console.log('[Voice] Heard:', transcript);

    // Animate wave bars while results are coming in
    if (!isSpeakingRef.current) {
      isSpeakingRef.current = true;
      startWaveBounce();
    }
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = setTimeout(() => {
      isSpeakingRef.current = false;
      stopWaveBounce();
    }, 500);

    // Split transcript into words and count command occurrences
    const words = transcript.split(/\s+/);
    const countMatches = (targets: string[]) =>
      words.filter((w: string) => targets.some(t => w.includes(t))).length;

    const commands: { key: string; targets: string[]; action: () => void }[] = [
      { key: 'next', targets: ['next', 'التالي'], action: () => { handleNext(); Vibration.vibrate(50); } },
      { key: 'back', targets: ['back', 'previous', 'السابق'], action: () => { handlePrevious(); Vibration.vibrate(50); } },
      { key: 'start', targets: ['start', 'ابدأ'], action: () => { handleAddTimer(); Vibration.vibrate(50); } },
      { key: 'stop', targets: ['stop', 'أوقف'], action: () => { handleStopTimer(); Vibration.vibrate(50); } },
    ];

    for (const cmd of commands) {
      const total = countMatches(cmd.targets);
      const processed = processedCountsRef.current[cmd.key] || 0;
      if (total > processed) {
        console.log(`[Voice] CMD: ${cmd.key} (new: ${total - processed})`);
        cmd.action();
        processedCountsRef.current[cmd.key] = total;
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[Voice] Session ended, listening:', listeningRef.current);
    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    isSpeakingRef.current = false;
    stopWaveBounce();
    processedCountsRef.current = {};
    if (listeningRef.current && ExpoSpeechRecognitionModule) {
      setTimeout(() => {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
          });
        } catch (e) {
          console.warn('[Voice] Restart failed:', e);
        }
      }, 300);
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    console.warn('[Voice] Error:', event?.error || event);
    processedCountsRef.current = {};
    if (listeningRef.current && ExpoSpeechRecognitionModule) {
      setTimeout(() => {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: 'en-US',
            interimResults: true,
            continuous: true,
          });
        } catch (e) {
          console.warn('[Voice] Restart after error failed:', e);
        }
      }, 1000);
    }
  });

  const startListening = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule) {
      console.warn('[Voice] Native module not available');
      return;
    }

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      console.log('[Voice] Permission:', result);
      if (!result.granted) {
        Alert.alert('Permission Needed', 'Microphone access is required for voice commands.');
        return;
      }

      processedCountsRef.current = {};
      listeningRef.current = true;
      setIsListening(true);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });
      console.log('[Voice] Started listening');
    } catch (e) {
      console.error('[Voice] Failed to start:', e);
      listeningRef.current = false;
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!ExpoSpeechRecognitionModule) return;
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.warn('[Voice] Stop failed:', e);
    }
    listeningRef.current = false;
    setIsListening(false);
    console.log('[Voice] Stopped');
  }, []);

  const loadRecipe = async () => {
    if (!id) return;
    const loadedRecipe = await getRecipe(id);
    if (loadedRecipe) {
      startSession(loadedRecipe);
    }
    setIsLoading(false);
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
    previousStep();
  };

  const buildMiniPlayerUrl = useCallback((rawUrl: string) => {
    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    const youtubeVideoId = normalizedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/|v\/))([^&\s?#/]+)/i
    )?.[1];
    if (youtubeVideoId) {
      return `https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&controls=1`;
    }

    const instagramMatch = normalizedUrl.match(
      /(?:instagram\.com|instagr\.am)\/(reel|reels|p|tv)\/([\w-]+)/i
    );
    if (instagramMatch?.[2]) {
      const kind = instagramMatch[1]?.toLowerCase();
      const mediaType = kind === 'tv' ? 'tv' : kind?.startsWith('reel') ? 'reel' : 'p';
      return `https://www.instagram.com/${mediaType}/${instagramMatch[2]}/embed`;
    }

    const tiktokVideoId =
      normalizedUrl.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i)?.[1] ||
      normalizedUrl.match(/(?:m\.)?tiktok\.com\/v\/(\d+)/i)?.[1];
    if (tiktokVideoId) {
      return `https://www.tiktok.com/embed/v2/${tiktokVideoId}`;
    }

    return normalizedUrl;
  }, []);

  const resolveShareUrl = useCallback(async (url: string) => {
    const needsResolve =
      /(?:vm|vt)\.tiktok\.com\//i.test(url) ||
      /tiktok\.com\/t\//i.test(url) ||
      /instagram\.com\/share\//i.test(url);

    if (!needsResolve) return url;

    try {
      const headResponse = await fetch(url, { method: 'HEAD' });
      if (headResponse.url) return headResponse.url;
    } catch { }

    try {
      const getResponse = await fetch(url);
      if (getResponse.url) return getResponse.url;
    } catch { }

    return url;
  }, []);

  const handleOpenSourceVideo = async () => {
    const rawVideoUrl = recipe?.source_url;
    if (!rawVideoUrl) return;

    const sourceUrl = rawVideoUrl.trim();
    const resolvedUrl = await resolveShareUrl(sourceUrl);

    try {
      await Linking.openURL(resolvedUrl);
    } catch {
      Alert.alert('Unable to open video', 'Please check the source link and try again.');
    }
  };

  const closeMiniPlayer = useCallback(() => {
    setMiniPlayerUrl(null);
    setMiniPlayerExpanded(false);
    setMiniPlayerLoading(false);
  }, []);

  const miniPlayerSource = useMemo(() => {
    if (!miniPlayerUrl) return undefined;
    return {
      html: [
        '<!DOCTYPE html><html><head>',
        '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">',
        '<style>*{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:#000}',
        'iframe{width:100%;height:100%;border:none;position:fixed;top:0;left:0;right:0;bottom:0}</style>',
        '</head><body>',
        `<iframe src="${miniPlayerUrl}" allow="autoplay;encrypted-media;accelerometer;gyroscope;picture-in-picture" allowfullscreen frameborder="0"></iframe>`,
        '</body></html>',
      ].join(''),
    };
  }, [miniPlayerUrl]);

  // ============================================
  // SWIPE GESTURE (react-native-gesture-handler + reanimated)
  // ============================================
  const goToNextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      Vibration.vibrate(25);
      nextStep();
    }
  }, [currentStep, totalSteps, nextStep]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 0) {
      Vibration.vibrate(25);
      previousStep();
    }
  }, [currentStep, previousStep]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      // Add resistance at edges
      let dx = e.translationX;
      if ((currentStep === 0 && dx > 0) || (currentStep === totalSteps - 1 && dx < 0)) {
        dx = dx * 0.25;
      }
      translateX.value = dx;
    })
    .onEnd((e) => {
      const velocity = e.velocityX;
      const translation = e.translationX;

      // Swipe left -> next step
      if ((translation < -SWIPE_THRESHOLD || velocity < -800) && currentStep < totalSteps - 1) {
        // Quick exit then reset + change step
        translateX.value = withTiming(-SCREEN_WIDTH * 0.4, { duration: 120 }, () => {
          translateX.value = 0;
          runOnJS(goToNextStep)();
        });
      }
      // Swipe right -> prev step
      else if ((translation > SWIPE_THRESHOLD || velocity > 800) && currentStep > 0) {
        translateX.value = withTiming(SCREEN_WIDTH * 0.4, { duration: 120 }, () => {
          translateX.value = 0;
          runOnJS(goToPrevStep)();
        });
      }
      // Spring back
      else {
        translateX.value = withSpring(0, { damping: 25, stiffness: 400 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    return {
      transform: [
        { translateX: translateX.value },
        {
          rotateZ: `${interpolate(
            translateX.value,
            [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
            [-2.8, 0, 2.8],
            Extrapolation.CLAMP
          )}deg`,
        },
        {
          scale: interpolate(absX, [0, SCREEN_WIDTH * 0.5], [1, 0.985], Extrapolation.CLAMP),
        },
      ],
      opacity: interpolate(absX, [0, SCREEN_WIDTH * 0.5], [1, 0.95], Extrapolation.CLAMP),
    };
  });

  const leftSwipeCueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 40, 110], [0, 0.5, 1], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(translateX.value, [0, 100], [8, 0], Extrapolation.CLAMP) }],
  }));

  const rightSwipeCueStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-110, -40, 0], [1, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(translateX.value, [-100, 0], [0, -8], Extrapolation.CLAMP) }],
  }));

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
  const dismissIntro = useCallback(() => {
    Animated.timing(introAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowIntro(false));
  }, []);

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
          onPress: async () => {
            stopListening();
            await cancelAllTimerNotifications();
            await LiveActivity.endTimer();
            endSession();
            router.back();
          },
        },
      ]
    );
  };

  const handleAddTimer = async () => {
    // Guard: Don't add if this step already has an active timer
    const existing = timers.find(t => t.label === `Step ${currentStep + 1}` && t.is_active);
    if (existing) return;

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

  // Handle Live Activity quick actions (next/prev/timer) passed via deep link query params.
  useEffect(() => {
    const normalizedAction = Array.isArray(laAction) ? laAction[0] : laAction;
    const normalizedNonce = Array.isArray(laNonce) ? laNonce[0] : laNonce;

    if (!normalizedAction) return;
    if (!recipe) return;

    const actionKey = `${normalizedAction}:${normalizedNonce ?? 'no-nonce'}`;
    if (lastLiveActivityActionKeyRef.current === actionKey) return;
    lastLiveActivityActionKeyRef.current = actionKey;

    if (normalizedAction === 'next') {
      handleNext();
      return;
    }

    if (normalizedAction === 'prev') {
      handlePrevious();
      return;
    }

    if (normalizedAction === 'timer') {
      handleAddTimer();
    }
  }, [handleAddTimer, handleNext, handlePrevious, laAction, laNonce, recipe]);

  const handleStopTimer = () => {
    if (currentStepTimer) {
      cancelNotification(currentStepTimer.notification_id);
      removeTimer(currentStepTimer.timer_id);
    }
  };

  const cancelAllTimerNotifications = async () => {
    await Promise.all(timers.map((timer) => cancelNotification(timer.notification_id)));
  };

  const goToSpecificStep = useCallback((index: number) => {
    if (!recipe || index < 0 || index >= totalSteps || index === currentStep) return;
    Vibration.vibrate(20);
    goToStep(index);
  }, [currentStep, goToStep, recipe, totalSteps]);

  if (isLoading || !recipe) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="restaurant-outline" size={28} color={C.gold} style={{ marginBottom: 12 }} />
        <Text style={styles.loadingText}>Loading recipe...</Text>
      </View>
    );
  }

  const step = recipe.steps[currentStep];
  const stepNumber = String(currentStep + 1).padStart(2, '0');

  const formatTimerDuration = (minutes: number) => {
    const mins = String(minutes).padStart(2, '0');
    return `${mins}:00`;
  };

  const formatRemainingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };


  // ============================================
  // Render a step card (reusable for current & peek)
  // ============================================
  const renderStepCard = (s: typeof step, sNumber: string, sIndex: number, showTimer: boolean) => {
    const stepTimerForCard = showTimer ? timers.find(
      (timer) => timer.label === `Step ${sIndex + 1}` && timer.is_active
    ) : null;
    const cardTimerRunning = !!stepTimerForCard && remainingSeconds !== null && sIndex === currentStep;

    return (
      <View style={styles.stepCard}>
        <Text style={styles.stepWatermark}>{sNumber}</Text>

        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            STEP {sIndex + 1} OF {totalSteps}
          </Text>
        </View>

        <Text style={styles.stepInstruction}>{s.instruction}</Text>

        {recipe.ingredients?.length > 0 && (() => {
          const instructionLower = s.instruction.toLowerCase();
          const matched = recipe.ingredients.filter((ing: any) =>
            ing.name && instructionLower.includes(ing.name.toLowerCase())
          );
          if (matched.length === 0) return null;
          return (
            <>
              <View style={styles.goldDivider} />
              <Text style={styles.ingredientsUsedLabel}>INGREDIENTS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.ingredientSlider}
                style={styles.ingredientSliderWrap}
              >
                {matched.map((ing: any, i: number) => {
                  const ingImage = getIngredientImage(ing.name);
                  const emoji = getIngredientEmoji(ing.name);
                  const amount = `${ing.amount ?? ''} ${ing.unit ?? ''}`.trim();
                  return (
                    <View key={i} style={styles.ingredientCard}>
                      <View style={styles.ingredientImageArea}>
                        {ingImage ? (
                          <Image
                            source={ingImage}
                            style={styles.ingredientPhoto}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <Text style={styles.ingredientInitials}>{ing.name.slice(0, 2).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={styles.ingredientName} numberOfLines={1}>{ing.name}</Text>
                      {amount ? <Text style={styles.ingredientAmount} numberOfLines={1}>{amount}</Text> : null}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          );
        })()}

        {s.temperature && (
          <View style={styles.tipContainer}>
            <View style={styles.tipBorderBar} />
            <View style={styles.tipInner}>
              <Ionicons name="bulb-outline" size={20} color={C.gold} />
              <Text style={styles.tipText}>
                Set your oven or stove to {s.temperature} for best results.
              </Text>
            </View>
          </View>
        )}

        {showTimer && s.duration_minutes && (
          <View style={[styles.timerCard, cardTimerRunning && styles.timerCardRunning]}>
            <View style={styles.timerLeft}>
              <View style={[styles.timerIconContainer, cardTimerRunning && styles.timerIconRunning]}>
                <Ionicons name="timer-outline" size={28} color={C.gold} />
              </View>
              <View>
                <Text style={styles.timerLabel}>
                  {cardTimerRunning ? 'Time Left' : 'Timer'}
                </Text>
                <Text style={styles.timerValue}>
                  {cardTimerRunning
                    ? formatRemainingTime(remainingSeconds!)
                    : formatTimerDuration(s.duration_minutes)}
                </Text>
              </View>
            </View>
            <Pressable
              style={[styles.startButton, cardTimerRunning && styles.stopButton]}
              onPress={cardTimerRunning ? handleStopTimer : handleAddTimer}
            >
              <Text style={[styles.startButtonText, cardTimerRunning && styles.stopButtonText]}>
                {cardTimerRunning ? 'STOP' : 'START'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, layout.headerStyle]}>
        <Pressable onPress={handleExit} style={styles.headerButton}>
          <Ionicons name="close" size={24} color={C.muted} />
        </Pressable>
        <View style={styles.headerCenter}>
          {isListening ? (
            <Pressable onPress={handleToggleVoiceCommands} style={styles.listeningBadge}>
              <View style={styles.waveBarsContainer}>
                {waveBars.map((bar, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      { transform: [{ scaleY: bar }] },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          ) : (
            <Text style={styles.recipeName} numberOfLines={1}>
              {recipe.title.toUpperCase()}
            </Text>
          )}
        </View>
        <Pressable onPress={openMenu} style={styles.headerButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color={C.muted} />
        </Pressable>
      </View>

      {/* Swipe Direction Indicators */}

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
                    transform: [{ scale: menuScale }, {
                      translateY: menuAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      })
                    }],
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
                              color={isListening ? C.gold : C.muted}
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
                        <Ionicons name="exit-outline" size={20} color={C.terracotta} />
                      </View>
                      <View style={styles.menuItemText}>
                        <Text style={[styles.menuItemTitle, { color: C.terracotta }]}>Exit Cooking</Text>
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

      {/* All Steps Modal */}
      <Modal
        visible={showStepsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStepsModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowStepsModal(false)}>
          <View style={styles.stepsModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.stepsModalCard}>
                <View style={styles.stepsModalHeader}>
                  <Text style={styles.stepsModalTitle}>All Steps</Text>
                  <Pressable
                    style={styles.stepsModalClose}
                    onPress={() => setShowStepsModal(false)}
                  >
                    <Ionicons name="close" size={20} color={C.muted} />
                  </Pressable>
                </View>

                <Text style={styles.stepsModalSubtitle}>
                  Step {currentStep + 1} of {totalSteps}
                </Text>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.stepsListContent}
                >
                  {recipe.steps.map((item, index) => {
                    const isActive = index === currentStep;
                    return (
                      <Pressable
                        key={`${item.step_number}-${index}`}
                        style={({ pressed }) => [
                          styles.stepsListItem,
                          isActive && styles.stepsListItemActive,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                          goToSpecificStep(index);
                          setShowStepsModal(false);
                        }}
                      >
                        <View style={[styles.stepsListNumberWrap, isActive && styles.stepsListNumberWrapActive]}>
                          <Text style={[styles.stepsListNumber, isActive && styles.stepsListNumberActive]}>
                            {String(index + 1).padStart(2, '0')}
                          </Text>
                        </View>
                        <View style={styles.stepsListTextWrap}>
                          <Text style={styles.stepsListLabel}>Step {index + 1}</Text>
                          <Text style={styles.stepsListInstruction} numberOfLines={2}>
                            {item.instruction}
                          </Text>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={20} color={C.gold} />}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Recipe Image — Fixed, doesn't move */}
        {recipe.thumbnail_url && (
          <Pressable
            style={styles.imageContainer}
            onPress={recipe.source_url ? handleOpenSourceVideo : undefined}
            disabled={!recipe.source_url}
          >
            <Image
              source={{ uri: recipe.thumbnail_url }}
              style={styles.recipeImage}
              contentFit="cover"
              transition={300}
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

        {/* Voice Commands Hint */}
        {showIntro && VOICE_AVAILABLE && (
          <Animated.View style={[styles.voiceHint, { opacity: introAnim }]}>
            <Ionicons name="mic-outline" size={18} color={C.gold} />
            <View style={styles.voiceHintText}>
              <Text style={styles.voiceHintTitle}>Voice commands available</Text>
              <Text style={styles.voiceHintDesc}>Tap ⋯ menu to enable hands-free</Text>
            </View>
            <Pressable onPress={dismissIntro} style={styles.voiceHintClose}>
              <Ionicons name="close" size={16} color={C.muted} />
            </Pressable>
          </Animated.View>
        )}

        {/* Step Card — Swipeable */}
        <View style={styles.stepCardContainer}>
          <GestureDetector gesture={swipeGesture}>
            <ReAnimated.View style={cardAnimatedStyle}>
              {renderStepCard(step, stepNumber, currentStep, true)}
            </ReAnimated.View>
          </GestureDetector>

          <View pointerEvents="none" style={styles.swipeCueLayer}>
            <ReAnimated.View style={[styles.swipeCue, styles.swipeCueLeft, leftSwipeCueStyle]}>
              <Ionicons name="arrow-back" size={12} color={C.muted} />
              <Text style={styles.swipeCueText}>Previous</Text>
            </ReAnimated.View>
            <ReAnimated.View style={[styles.swipeCue, styles.swipeCueRight, rightSwipeCueStyle]}>
              <Text style={styles.swipeCueText}>Next</Text>
              <Ionicons name="arrow-forward" size={12} color={C.muted} />
            </ReAnimated.View>
          </View>
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
                    <Ionicons name="timer-outline" size={18} color={C.gold} />
                    <Text style={styles.otherTimerLabel}>{timer.label}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      cancelNotification(timer.notification_id);
                      removeTimer(timer.timer_id);
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color={C.muted} />
                  </Pressable>
                </View>
              ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation — Glass Dock */}
      <View style={[styles.bottomNav, layout.fixedBottomStyle]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.dockGoldLine} />
        <View style={styles.progressMetaRow}>
          <Text style={styles.progressMetaText}>
            Step {currentStep + 1} of {totalSteps}
          </Text>
        </View>
        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <Pressable
              key={index}
              style={styles.progressDotPressable}
              onPress={() => goToSpecificStep(index)}
            >
              <View
                style={[
                  styles.progressDot,
                  index <= currentStep && styles.progressDotActive,
                ]}
              />
            </Pressable>
          ))}
        </View>

        <View style={styles.navButtons}>
          <Pressable
            style={[styles.backButton, currentStep === 0 && styles.backButtonDisabled]}
            onPress={handlePrevious}
            disabled={currentStep === 0}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentStep === 0 ? '#CBD5E1' : C.charcoal}
            />
          </Pressable>

          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentStep === totalSteps - 1 ? 'Complete' : 'Next Step'}
            </Text>
            <Ionicons
              name={currentStep === totalSteps - 1 ? 'checkmark' : 'chevron-forward'}
              size={22}
              color="#FFF"
            />
          </Pressable>
        </View>
      </View>

      {miniPlayerUrl && (
        <View
          style={[
            styles.miniPlayerContainer,
            { bottom: Math.max(layout.insets.bottom, 16) + 96 },
            miniPlayerExpanded && styles.miniPlayerContainerExpanded,
          ]}
        >
          <View style={styles.miniPlayerHeader}>
            <Text style={styles.miniPlayerTitle} numberOfLines={1}>
              {miniPlayerExpanded ? 'Recipe Video' : 'Mini Player'}
            </Text>
            <View style={styles.miniPlayerActions}>
              <Pressable
                style={styles.miniPlayerActionButton}
                onPress={() => setMiniPlayerExpanded((prev) => !prev)}
              >
                <Ionicons
                  name={miniPlayerExpanded ? 'contract-outline' : 'expand-outline'}
                  size={16}
                  color={C.ivory}
                />
              </Pressable>
              <Pressable style={styles.miniPlayerActionButton} onPress={closeMiniPlayer}>
                <Ionicons name="close" size={16} color={C.ivory} />
              </Pressable>
            </View>
          </View>

          <View style={styles.miniPlayerBody}>
            {EmbeddedWebView ? (
              <EmbeddedWebView
                source={miniPlayerSource}
                originWhitelist={['*']}
                style={styles.miniPlayerWebView}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                allowsFullscreenVideo
                javaScriptEnabled
                domStorageEnabled
                setSupportMultipleWindows={false}
                startInLoadingState
                onLoadStart={() => setMiniPlayerLoading(true)}
                onLoadEnd={() => setMiniPlayerLoading(false)}
                onError={() => {
                  setMiniPlayerLoading(false);
                  Alert.alert('Video failed to load', 'Try another source video link for this recipe.');
                }}
                onShouldStartLoadWithRequest={(request: { url?: string }) => {
                  const nextUrl = request.url?.toLowerCase() ?? '';
                  return (
                    nextUrl.startsWith('http://') ||
                    nextUrl.startsWith('https://') ||
                    nextUrl.startsWith('blob:') ||
                    nextUrl.startsWith('about:') ||
                    nextUrl.startsWith('data:')
                  );
                }}
              />
            ) : (
              <View style={styles.miniPlayerFallback}>
                <Text style={styles.miniPlayerFallbackText}>Mini player is unavailable in this build.</Text>
              </View>
            )}

            {miniPlayerLoading && (
              <View style={styles.miniPlayerLoadingOverlay}>
                <ActivityIndicator color={C.ivory} size="small" />
              </View>
            )}
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.ivory,
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
    backgroundColor: C.ivory,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.18)',
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.glassStrong,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 21, 16, 0.1)',
    borderRadius: 21,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  recipeName: {
    fontSize: 12,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.muted,
    letterSpacing: 2,
  },
  listeningBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  waveBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
  },
  waveBar: {
    width: 3,
    height: 20,
    borderRadius: 1.5,
    backgroundColor: C.gold,
  },
  // Content — carousel layers
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 220,
  },
  // Image
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 7,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: C.cardBg,
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
  stepCardContainer: {
    position: 'relative',
  },
  swipeCueLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  swipeCue: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: C.hairline,
  },
  swipeCueLeft: {
    left: -6,
  },
  swipeCueRight: {
    right: -6,
  },
  swipeCueText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  // Step Card
  stepCard: {
    backgroundColor: C.ivory,
    borderRadius: 32,
    padding: 28,
    ...SHADOW_SOFT,
    position: 'relative',
    overflow: 'hidden',
  },
  stepWatermark: {
    position: 'absolute',
    top: 20,
    right: 24,
    fontSize: 48,
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    color: 'rgba(212, 175, 55, 0.12)',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  stepBadgeText: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.gold,
    letterSpacing: 1.5,
  },
  stepInstruction: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    lineHeight: 28,
    marginBottom: 20,
    paddingRight: 40,
  },
  goldDivider: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    marginBottom: 16,
  },
  // Ingredients — horizontal slider
  ingredientsUsedLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.gold,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  ingredientSliderWrap: {
    marginHorizontal: -28,
    marginBottom: 20,
  },
  ingredientSlider: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 28,
  },
  ingredientCard: {
    width: 80,
    alignItems: 'center',
  },
  ingredientImageArea: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F0E8DD',
    borderWidth: 1,
    borderColor: C.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    ...SHADOW_SOFT,
  },
  ingredientPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  ingredientInitials: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.terracotta,
  },
  ingredientName: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    textAlign: 'center',
  },
  ingredientAmount: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    textAlign: 'center',
    marginTop: 1,
  },
  // Tip (gold left border bar pattern from StepList)
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: C.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tipBorderBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: C.gold,
  },
  tipInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontStyle: 'italic',
    color: C.muted,
    lineHeight: 22,
  },
  // Timer Card
  timerCard: {
    backgroundColor: C.ivory,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.hairline,
    ...SHADOW_SOFT,
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
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.muted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  timerValue: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: C.charcoal,
    letterSpacing: -0.5,
  },
  startButton: {
    backgroundColor: C.terracotta,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  timerCardRunning: {
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderWidth: 1.5,
    shadowColor: C.gold,
    shadowOpacity: 0.12,
  },
  timerIconRunning: {
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
  },
  stopButton: {
    backgroundColor: 'rgba(212, 175, 55, 0.10)',
    borderWidth: 1,
    borderColor: C.gold,
  },
  stopButtonText: {
    color: C.gold,
  },
  // Other Timers
  timersContainer: {
    marginTop: 20,
    backgroundColor: C.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  otherTimersLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
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
    borderBottomColor: C.hairline,
  },
  otherTimerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otherTimerLabel: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
  },
  // Bottom Navigation — Glass Dock
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: C.glassStrong,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 24,
    paddingTop: 12,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 12,
  },
  dockGoldLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.22)',
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  progressMetaText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  progressDotPressable: {
    flex: 1,
  },
  progressDot: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(26, 21, 16, 0.08)',
    borderRadius: 3,
  },
  progressDotActive: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
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
    width: 56,
    height: 56,
    backgroundColor: '#FFF',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(26, 21, 16, 0.12)',
    ...SHADOW_SOFT,
  },
  backButtonDisabled: {
    opacity: 0.4,
  },
  nextButton: {
    flex: 1,
    height: 56,
    backgroundColor: C.terracotta,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFF',
  },
  miniPlayerContainer: {
    position: 'absolute',
    right: 12,
    width: Math.min(SCREEN_WIDTH * 0.48, 210),
    height: Math.min(SCREEN_WIDTH * 0.82, 340),
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0E0E0E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    zIndex: 40,
    ...SHADOW_SOFT,
  },
  miniPlayerContainerExpanded: {
    left: 12,
    right: 12,
    width: undefined,
    height: Math.min(SCREEN_WIDTH * 1.45, 560),
  },
  miniPlayerHeader: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  miniPlayerTitle: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
    letterSpacing: 0.3,
  },
  miniPlayerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  miniPlayerActionButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  miniPlayerBody: {
    flex: 1,
    backgroundColor: '#000',
  },
  miniPlayerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#121212',
  },
  miniPlayerFallbackText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 18,
  },
  miniPlayerWebView: {
    flex: 1,
    backgroundColor: '#000',
  },
  miniPlayerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
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
    ...SHADOW_SOFT,
  },
  menuBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  menuContent: {
    backgroundColor: C.glass,
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
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIconActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  menuDivider: {
    height: 1,
    backgroundColor: C.hairline,
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
    backgroundColor: C.gold,
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
  // All steps modal
  stepsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  stepsModalCard: {
    maxHeight: '80%',
    borderRadius: 24,
    backgroundColor: C.ivory,
    padding: 16,
    ...SHADOW_SOFT,
  },
  stepsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stepsModalTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  stepsModalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  stepsModalSubtitle: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
    marginBottom: 12,
  },
  stepsListContent: {
    gap: 8,
    paddingBottom: 8,
  },
  stepsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  stepsListItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  stepsListNumberWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: C.hairline,
  },
  stepsListNumberWrapActive: {
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  stepsListNumber: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.charcoal,
    letterSpacing: 0.3,
  },
  stepsListNumberActive: {
    color: C.gold,
  },
  stepsListTextWrap: {
    flex: 1,
  },
  stepsListLabel: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  stepsListInstruction: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    lineHeight: 19,
  },
  // Voice hint banner
  voiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  voiceHintText: {
    flex: 1,
  },
  voiceHintTitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.charcoal,
  },
  voiceHintDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    marginTop: 1,
  },
  voiceHintClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 21, 16, 0.05)',
  },
});
