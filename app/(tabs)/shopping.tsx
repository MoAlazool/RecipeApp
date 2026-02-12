import React, { useState, useCallback, useRef, useMemo, memo, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated as RNAnimated,
  Alert,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  FadeIn,
  FadeOut,
  Layout,
  SlideInDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  useShoppingStore,
  type ShoppingItem,
} from '@/stores/shoppingStore';
import { AddItemModal } from '@/components/shopping/AddItemModal';

import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';
import { getIngredientImage } from '@/utils/ingredientImages';
import { getIngredientEmoji, CATEGORY_BG_COLORS } from '@/utils/ingredientEmojis';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent, VOICE_AVAILABLE } from '@/utils/speechRecognition';
import { aiService } from '@/services/ai.service';

// ============================================================
// DESIGN TOKENS
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.08)',
  cardBg: '#F5F3EE',
  background: '#FAFAF8',
};

// ============================================================
// ITEM ROW COMPONENT (with check/uncheck animation)
// ============================================================

interface ItemRowProps {
  item: ShoppingItem;
  onToggle: () => void;
  onDelete: () => void;
}

const ItemRow = memo(function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  const image = useMemo(() => getIngredientImage(item.name), [item.name]);
  const emoji = useMemo(() => getIngredientEmoji(item.name), [item.name]);
  const bgColor = CATEGORY_BG_COLORS[item.category] || C.cardBg;

  // Animation values
  const checkScale = useSharedValue(1);
  const rowOpacity = useSharedValue(1);
  const rowTranslateY = useSharedValue(0);
  const rowHeight = useSharedValue(1); // 1 = full height via scale
  const [showCheck, setShowCheck] = useState(item.is_checked);

  const handleToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!item.is_checked) {
      // Checking: show checkmark with pop, then slide down & fade out, then toggle
      setShowCheck(true);
      checkScale.value = withSequence(
        withTiming(1.3, { duration: 150 }),
        withTiming(1, { duration: 150 }),
      );
      // After checkmark shows, animate row out
      rowOpacity.value = withDelay(350, withTiming(0, { duration: 250 }));
      rowTranslateY.value = withDelay(350, withTiming(30, { duration: 250 }));
      rowHeight.value = withDelay(350, withTiming(0, { duration: 250 }));
      // Fire the actual toggle after animation completes
      setTimeout(() => {
        onToggle();
        // Reset for next render
        rowOpacity.value = 1;
        rowTranslateY.value = 0;
        rowHeight.value = 1;
      }, 620);
    } else {
      // Unchecking: just toggle immediately
      setShowCheck(false);
      onToggle();
    }
  }, [item.is_checked, onToggle, checkScale, rowOpacity, rowTranslateY, rowHeight]);

  const rowAnimStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [
      { translateY: rowTranslateY.value },
      { scaleY: rowHeight.value },
    ],
  }));

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View style={[styles.itemRow, rowAnimStyle]}>
      {/* Tap target — entire row */}
      <Pressable style={styles.itemRowInner} onPress={handleToggle}>
        {/* Image with delete badge */}
        <View style={styles.itemImageWrap}>
          <View style={[styles.itemImage, !image && { backgroundColor: bgColor }, showCheck && styles.itemImageChecked]}>
            {image ? (
              <ExpoImage source={image} style={[styles.itemImageInner, showCheck && { opacity: 0.5 }]} contentFit="cover" />
            ) : (
              <Text style={[styles.itemEmoji, showCheck && { opacity: 0.5 }]}>{emoji}</Text>
            )}
            {showCheck && (
              <Animated.View style={[styles.itemCheckOverlay, checkAnimStyle]}>
                <Ionicons name="checkmark-circle" size={28} color={C.gold} />
              </Animated.View>
            )}
          </View>
          <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
            <Ionicons name="close" size={12} color={C.muted} />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.itemContent}>
          <Text style={[styles.itemName, showCheck && styles.itemNameChecked]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.amount != null && (
            <Text style={styles.itemAmount}>
              {item.amount}{item.unit ? ` ${item.unit}` : ''}
            </Text>
          )}
        </View>

        {/* Checkbox */}
        <Animated.View style={[styles.checkbox, showCheck && styles.checkboxChecked, checkAnimStyle]}>
          {showCheck && <Ionicons name="checkmark" size={14} color="#FFF" />}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
});

// ============================================================
// SECTION COMPONENT
// ============================================================

interface SectionProps {
  title: string;
  subtitle?: string;
  items: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClear: () => void;
}

const Section = memo(function Section({ title, subtitle, items, onToggleItem, onDeleteItem, onClear }: SectionProps) {
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionCount}>{items.length} item{items.length !== 1 ? 's' : ''}{subtitle ? ` · ${subtitle}` : ''}</Text>
        </View>
        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            Alert.alert('Clear Section', `Remove all ${items.length} items from "${title}"?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: onClear },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={14} color={C.muted} />
        </Pressable>
      </View>

      {/* Items in card */}
      <View style={styles.sectionCard}>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            {index > 0 && <View style={styles.itemDivider} />}
            <ItemRow
              item={item}
              onToggle={() => onToggleItem(item.id)}
              onDelete={() => onDeleteItem(item.id)}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
});

// ============================================================
// CHECKED SECTION COMPONENT
// ============================================================

interface CheckedSectionProps {
  items: ShoppingItem[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
}

const CheckedSection = memo(function CheckedSection({ items, onToggleItem, onDeleteItem, onClearAll }: CheckedSectionProps) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  return (
    <View style={styles.checkedSection}>
      {/* Header */}
      <Pressable style={styles.checkedHeader} onPress={() => setExpanded(!expanded)}>
        <View style={styles.checkedTitleRow}>
          <View style={styles.checkedBadge}>
            <Ionicons name="checkmark" size={12} color={C.ivory} />
          </View>
          <Text style={styles.checkedTitle}>Done</Text>
          <Text style={styles.checkedCount}>{items.length}</Text>
        </View>
        <View style={styles.checkedActions}>
          <Pressable
            style={styles.clearCheckedBtn}
            onPress={() => {
              Alert.alert('Clear Checked', `Remove all ${items.length} checked items?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: onClearAll },
              ]);
            }}
          >
            <Text style={styles.clearCheckedText}>Clear all</Text>
          </Pressable>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
        </View>
      </Pressable>

      {/* Items */}
      {expanded && (
        <View style={styles.sectionCard}>
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={styles.itemDivider} />}
              <Animated.View entering={FadeIn.duration(300).delay(index * 50)} layout={Layout.springify()}>
                <ItemRow
                  item={item}
                  onToggle={() => onToggleItem(item.id)}
                  onDelete={() => onDeleteItem(item.id)}
                />
              </Animated.View>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const {
    items,
    toggleItem,
    removeItem,
    addItem,
  } = useShoppingStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const [deletedItem, setDeletedItem] = useState<ShoppingItem | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(4);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const undoCountdownRef = useRef<ReturnType<typeof setInterval>>(null);
  const undoAnim = useRef(new RNAnimated.Value(100)).current;
  const quickAddScale = useSharedValue(1);
  const quickAddSuccessAnim = useSharedValue(0);

  // Voice input state (continuous listening like cooking mode)
  const [isListening, setIsListening] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const listeningRef = useRef(false);
  const lastProcessedRef = useRef('');
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveBars = useRef(
    Array.from({ length: 5 }, () => new RNAnimated.Value(0.3))
  ).current;

  // Wave animation for listening state
  useEffect(() => {
    if (!isListening) {
      waveBars.forEach(bar => {
        bar.stopAnimation();
        bar.setValue(0.3);
      });
      return;
    }

    // Breathing animation for each bar
    const heights = [0.4, 0.6, 0.8, 0.6, 0.4];
    waveBars.forEach((bar, i) => {
      const breathe = () => {
        if (!listeningRef.current) return;
        RNAnimated.sequence([
          RNAnimated.timing(bar, {
            toValue: heights[i],
            duration: 600 + i * 100,
            useNativeDriver: true,
          }),
          RNAnimated.timing(bar, {
            toValue: 0.25,
            duration: 600 + i * 100,
            useNativeDriver: true,
          }),
        ]).start(() => breathe());
      };
      setTimeout(breathe, i * 80);
    });

    return () => {
      waveBars.forEach(bar => bar.stopAnimation());
    };
  }, [isListening]);

  // Speech recognition event handlers (continuous mode like cooking)
  useSpeechRecognitionEvent('result', (event: any) => {
    if (!listeningRef.current) return;
    const transcript = event?.results?.[0]?.transcript?.trim() || '';
    if (!transcript) return;

    console.log('[Voice] Heard:', transcript);
    setVoiceTranscript(transcript);

    // Debounce processing - wait for user to stop speaking
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }

    processingTimeoutRef.current = setTimeout(async () => {
      // Don't process the same text twice
      if (transcript === lastProcessedRef.current) return;
      lastProcessedRef.current = transcript;

      setIsProcessingVoice(true);
      setVoiceMessage('Adding...');

      try {
        const result = await aiService.parseGroceryVoice(transcript);

        if (result.understood && result.items.length > 0) {
          result.items.forEach(item => {
            addItem({
              name: item.name,
              amount: item.amount ?? undefined,
              unit: item.unit as any,
              category: item.category as any,
            });
          });

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setVoiceMessage(result.message);
          setVoiceTranscript('');
          setIsProcessingVoice(false);

          // Stop listening after successfully adding items
          setTimeout(() => {
            listeningRef.current = false;
            setIsListening(false);
            setVoiceMessage('');
            if (ExpoSpeechRecognitionModule) {
              try { ExpoSpeechRecognitionModule.stop(); } catch (e) {}
            }
          }, 1500);
          return;
        } else {
          setVoiceMessage(result.message || "Didn't catch that");
        }
      } catch (error) {
        console.error('Voice processing error:', error);
        setVoiceMessage('Error processing');
      } finally {
        setIsProcessingVoice(false);
      }
    }, 1500); // Wait 1.5s after user stops speaking
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[Voice] Session ended, listening:', listeningRef.current);
    // Restart if we should still be listening (like cooking mode)
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
    // Restart on error if we should still be listening
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
    if (!VOICE_AVAILABLE) {
      Alert.alert('Voice Unavailable', 'Voice input is not available in Expo Go. Please use a development build.');
      return;
    }

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Microphone permission is required for voice input.');
        return;
      }

      listeningRef.current = true;
      lastProcessedRef.current = '';
      setIsListening(true);
      setVoiceMessage('Listening...');
      setVoiceTranscript('');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US', // Arabic, also understands English
        interimResults: true,
        continuous: true,
      });
      console.log('[Voice] Started continuous listening');
    } catch (error) {
      console.error('Failed to start voice:', error);
      listeningRef.current = false;
      setIsListening(false);
      setVoiceMessage('Could not start');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current);
    }
    listeningRef.current = false;
    setIsListening(false);
    setVoiceMessage('');
    setVoiceTranscript('');
    if (ExpoSpeechRecognitionModule) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.warn('[Voice] Stop failed:', e);
      }
    }
    console.log('[Voice] Stopped');
  }, []);

  // Separate items
  const checkedItems = useMemo(() => items.filter(i => i.is_checked), [items]);
  const uncheckedItems = useMemo(() => items.filter(i => !i.is_checked), [items]);

  const generalItems = useMemo(() =>
    uncheckedItems.filter(i => !i.recipe_name),
    [uncheckedItems]
  );

  const recipeGroups = useMemo(() => {
    const groups: Record<string, ShoppingItem[]> = {};
    uncheckedItems.forEach(item => {
      if (item.recipe_name) {
        if (!groups[item.recipe_name]) groups[item.recipe_name] = [];
        groups[item.recipe_name].push(item);
      }
    });
    return groups;
  }, [uncheckedItems]);

  // Progress
  const totalItems = items.length;
  const completedItems = checkedItems.length;
  const progress = totalItems > 0 ? completedItems / totalItems : 0;

  // Handlers
  const handleToggle = useCallback((id: string) => {
    toggleItem(id);
  }, [toggleItem]);

  const handleDelete = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);

    setDeletedItem(item);
    setShowUndo(true);
    setUndoCountdown(4);
    RNAnimated.spring(undoAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }).start();
    removeItem(id);

    undoCountdownRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    undoTimeoutRef.current = setTimeout(() => {
      if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
      RNAnimated.timing(undoAnim, { toValue: 100, duration: 200, useNativeDriver: true }).start(() => {
        setShowUndo(false);
        setDeletedItem(null);
      });
    }, 4000);
  }, [items, removeItem, undoAnim]);

  const handleUndo = useCallback(() => {
    if (!deletedItem) return;
    addItem(deletedItem);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
    RNAnimated.timing(undoAnim, { toValue: 100, duration: 200, useNativeDriver: true }).start(() => {
      setShowUndo(false);
      setDeletedItem(null);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [deletedItem, addItem, undoAnim]);

  const quickAddBarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: quickAddScale.value }],
  }));
  const quickAddCheckStyle = useAnimatedStyle(() => ({
    opacity: quickAddSuccessAnim.value,
    transform: [{ scale: quickAddSuccessAnim.value }],
  }));

  const handleQuickAdd = useCallback(() => {
    if (!quickAddText.trim()) return;
    addItem({ name: quickAddText.trim(), category: 'other' });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Success flash
    setQuickAddSuccess(true);
    quickAddScale.value = withSequence(
      withTiming(0.96, { duration: 80 }),
      withTiming(1, { duration: 120 }),
    );
    quickAddSuccessAnim.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(400, withTiming(0, { duration: 200 })),
    );

    setQuickAddText('');
    setTimeout(() => setQuickAddSuccess(false), 800);
  }, [quickAddText, addItem]);

  const handleClearGeneral = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    generalItems.forEach(item => removeItem(item.id));
  }, [generalItems, removeItem]);

  const handleClearRecipe = useCallback((recipeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const recipeItems = recipeGroups[recipeName] || [];
    recipeItems.forEach(item => removeItem(item.id));
  }, [recipeGroups, removeItem]);

  const handleClearChecked = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    checkedItems.forEach(item => removeItem(item.id));
  }, [checkedItems, removeItem]);

  // Empty state
  if (items.length === 0) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <TabScreenTransition style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.headerTitle}>Grocery List</Text>
          </View>

          <View style={styles.emptyWrapper}>
            {/* Glass card */}
            <View style={styles.emptyCard}>
              <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFillObject} />
              <LinearGradient
                colors={['rgba(255,255,255,0.9)', 'rgba(245,243,238,0.95)']}
                style={StyleSheet.absoluteFillObject}
              />

              <View style={styles.emptyCardContent}>
                {/* Icon */}
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="cart-outline" size={32} color={C.terracotta} />
                </View>

                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add items manually or let recipes fill your list automatically
                </Text>

                {/* Voice listening inline */}
                {isListening ? (
                  <View style={[styles.voiceListeningContainer, { marginTop: 16, width: '100%' }]}>
                    <View style={styles.voiceListeningHeader}>
                      <View style={styles.waveBarsContainer}>
                        {waveBars.map((bar, i) => (
                          <RNAnimated.View
                            key={i}
                            style={[styles.waveBar, { transform: [{ scaleY: bar }] }]}
                          />
                        ))}
                      </View>
                      <Text style={styles.voiceListeningLabel}>
                        {isProcessingVoice ? 'Adding...' : 'Listening...'}
                      </Text>
                      <Pressable onPress={stopListening} style={styles.stopListeningBtn}>
                        <Ionicons name="close" size={20} color={C.charcoal} />
                      </Pressable>
                    </View>
                    {voiceTranscript ? (
                      <Text style={styles.voiceTranscript} numberOfLines={2}>"{voiceTranscript}"</Text>
                    ) : (
                      <Text style={styles.voiceHint}>Say what you need, e.g. "bread, milk, and eggs"</Text>
                    )}
                    {voiceMessage && voiceMessage !== 'Listening...' && (
                      <Text style={styles.voiceResult}>{voiceMessage}</Text>
                    )}
                  </View>
                ) : (
                  /* Actions */
                  <View style={styles.emptyActions}>
                    <Pressable
                      style={({ pressed }) => [styles.emptyPrimaryBtn, pressed && styles.emptyBtnPressed]}
                      onPress={() => setShowAddModal(true)}
                    >
                      <Ionicons name="add" size={20} color={C.ivory} />
                      <Text style={styles.emptyPrimaryBtnText}>Add Items</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.emptyVoiceBtn, pressed && styles.emptyBtnPressed]}
                      onPress={startListening}
                    >
                      <Ionicons name="mic" size={20} color={C.terracotta} />
                    </Pressable>
                  </View>
                )}
              </View>
            </View>

            {/* Feature rows */}
            <View style={styles.emptyFeatures}>
              <View style={styles.emptyFeatureRow}>
                <View style={[styles.emptyFeatureIcon, { backgroundColor: 'rgba(198, 110, 78, 0.08)' }]}>
                  <Ionicons name="restaurant" size={18} color={C.terracotta} />
                </View>
                <View style={styles.emptyFeatureText}>
                  <Text style={styles.emptyFeatureTitle}>Recipe Sync</Text>
                  <Text style={styles.emptyFeatureDesc}>Ingredients are auto-added when you cook a recipe</Text>
                </View>
              </View>
              <View style={styles.emptyFeatureRow}>
                <View style={[styles.emptyFeatureIcon, { backgroundColor: 'rgba(212, 175, 55, 0.08)' }]}>
                  <Ionicons name="mic" size={18} color={C.gold} />
                </View>
                <View style={styles.emptyFeatureText}>
                  <Text style={styles.emptyFeatureTitle}>Voice Input</Text>
                  <Text style={styles.emptyFeatureDesc}>Say what you need and items get added instantly</Text>
                </View>
              </View>
              <View style={styles.emptyFeatureRow}>
                <View style={[styles.emptyFeatureIcon, { backgroundColor: 'rgba(107, 142, 35, 0.08)' }]}>
                  <Ionicons name="checkmark-done" size={18} color="#6B8E23" />
                </View>
                <View style={styles.emptyFeatureText}>
                  <Text style={styles.emptyFeatureTitle}>Shop & Check Off</Text>
                  <Text style={styles.emptyFeatureDesc}>Track your progress as you go through the store</Text>
                </View>
              </View>
            </View>
          </View>

          <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
        </TabScreenTransition>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  const hasUncheckedContent = generalItems.length > 0 || Object.keys(recipeGroups).length > 0;

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <TabScreenTransition style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.headerTitle}>Grocery List</Text>
          <Pressable
            style={({ pressed }) => [styles.shareListBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
            onPress={() => router.push('/share-shopping' as any)}
          >
            <Ionicons name="share-outline" size={20} color={C.charcoal} />
          </Pressable>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>{completedItems} of {totalItems} items</Text>
            <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAddWrap}>
          {isListening ? (
            // Voice listening mode
            <View style={styles.voiceListeningContainer}>
              <View style={styles.voiceListeningHeader}>
                <View style={styles.waveBarsContainer}>
                  {waveBars.map((bar, i) => (
                    <RNAnimated.View
                      key={i}
                      style={[
                        styles.waveBar,
                        { transform: [{ scaleY: bar }] },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.voiceListeningLabel}>
                  {isProcessingVoice ? 'Adding...' : 'Listening...'}
                </Text>
                <Pressable onPress={stopListening} style={styles.stopListeningBtn}>
                  <Ionicons name="close" size={20} color={C.charcoal} />
                </Pressable>
              </View>
              {voiceTranscript ? (
                <Text style={styles.voiceTranscript} numberOfLines={2}>
                  "{voiceTranscript}"
                </Text>
              ) : (
                <Text style={styles.voiceHint}>
                  Say what you need, e.g. "I need bread, milk, and eggs"
                </Text>
              )}
              {voiceMessage && voiceMessage !== 'Listening...' && (
                <Text style={styles.voiceResult}>{voiceMessage}</Text>
              )}
            </View>
          ) : (
            // Normal quick add input
            <Animated.View style={[styles.quickAdd, quickAddBarStyle]}>
              <TextInput
                style={styles.quickAddInput}
                placeholder="Add item..."
                placeholderTextColor={C.muted}
                value={quickAddText}
                onChangeText={setQuickAddText}
                onSubmitEditing={handleQuickAdd}
                returnKeyType="done"
              />
              {quickAddSuccess && (
                <Animated.View style={[styles.quickAddCheck, quickAddCheckStyle]}>
                  <Ionicons name="checkmark-circle" size={22} color="#4CAF50" />
                </Animated.View>
              )}
              {quickAddText.length > 0 ? (
                <Pressable
                  onPress={handleQuickAdd}
                  style={({ pressed }) => [styles.quickAddSend, pressed && { transform: [{ scale: 0.9 }] }]}
                >
                  <Ionicons name="arrow-up-circle" size={32} color={C.terracotta} />
                </Pressable>
              ) : (
                <View style={styles.quickAddActions}>
                  <Pressable
                    onPress={startListening}
                    style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
                  >
                    <Ionicons name="mic" size={18} color={C.terracotta} />
                  </Pressable>
                  <Pressable
                    onPress={() => setShowAddModal(true)}
                    style={({ pressed }) => [styles.addDetailBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.93 }] }]}
                  >
                    <Ionicons name="add" size={20} color={C.ivory} />
                  </Pressable>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: bottomTabBarHeight + 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* General Section */}
          <Section
            title="General"
            subtitle="Misc. things you need"
            items={generalItems}
            onToggleItem={handleToggle}
            onDeleteItem={handleDelete}
            onClear={handleClearGeneral}
          />

          {/* Recipe Sections */}
          {Object.entries(recipeGroups).map(([recipeName, recipeItems]) => (
            <Section
              key={recipeName}
              title={recipeName}
              subtitle={`${recipeItems.length} ingredient${recipeItems.length !== 1 ? 's' : ''}`}
              items={recipeItems}
              onToggleItem={handleToggle}
              onDeleteItem={handleDelete}
              onClear={() => handleClearRecipe(recipeName)}
            />
          ))}

          {/* All done message when no unchecked items */}
          {!hasUncheckedContent && checkedItems.length > 0 && (
            <View style={styles.allDone}>
              <Ionicons name="checkmark-circle" size={40} color={C.gold} />
              <Text style={styles.allDoneText}>All done!</Text>
            </View>
          )}

          {/* Checked Section */}
          <CheckedSection
            items={checkedItems}
            onToggleItem={handleToggle}
            onDeleteItem={handleDelete}
            onClearAll={handleClearChecked}
          />
        </ScrollView>

        {/* Undo Snackbar */}
        {showUndo && deletedItem && (
          <RNAnimated.View style={[styles.undoSnackbar, { bottom: bottomTabBarHeight + 12, transform: [{ translateY: undoAnim }] }]}>
            <View style={styles.undoCountdownBadge}>
              <Text style={styles.undoCountdownText}>{undoCountdown}</Text>
            </View>
            <Text style={styles.undoText} numberOfLines={1}>Removed "{deletedItem.name}"</Text>
            <TouchableOpacity onPress={handleUndo} style={styles.undoBtnWrap}>
              <Text style={styles.undoBtn}>Undo</Text>
            </TouchableOpacity>
          </RNAnimated.View>
        )}

        <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
      </TabScreenTransition>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.background,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
  },
  shareListBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress
  progressWrap: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
  },
  progressPercent: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
  },
  progressTrack: {
    height: 4,
    backgroundColor: C.hairline,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: C.gold,
    borderRadius: 2,
  },

  // Quick Add
  quickAddWrap: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    height: 52,
    backgroundColor: C.ivory,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  quickAddInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  quickAddCheck: {
    marginRight: 4,
  },
  quickAddSend: {
    marginLeft: 6,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(198, 110, 78, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDetailBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },

  // Voice listening container
  voiceListeningContainer: {
    backgroundColor: C.ivory,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.terracotta,
    padding: 16,
  },
  voiceListeningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waveBarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
  },
  waveBar: {
    width: 4,
    height: 24,
    borderRadius: 2,
    backgroundColor: C.terracotta,
  },
  voiceListeningLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },
  stopListeningBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTranscript: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    marginTop: 12,
    fontStyle: 'italic',
  },
  voiceHint: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 12,
  },
  voiceResult: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.gold,
    marginTop: 8,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.charcoal,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 1,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    marginHorizontal: 16,
    backgroundColor: C.ivory,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  itemDivider: {
    height: 0.5,
    backgroundColor: C.hairline,
    marginLeft: 72,
  },

  // Item Row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 14,
    gap: 12,
  },
  itemImageWrap: {},
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImageChecked: {
    opacity: 0.7,
  },
  itemImageInner: {
    width: '100%',
    height: '100%',
  },
  itemEmoji: {
    fontSize: 26,
  },
  itemCheckOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
  },
  deleteBtn: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: C.muted,
  },
  itemAmount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    marginTop: 1,
  },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(26, 21, 16, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.ivory,
  },
  checkboxChecked: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },

  // Checked Section
  checkedSection: {
    marginTop: 8,
    paddingTop: 4,
  },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  checkedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedTitle: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },
  checkedCount: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.muted,
    backgroundColor: C.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  checkedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearCheckedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  clearCheckedText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.terracotta,
  },

  // All Done
  allDone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  allDoneText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.muted,
  },

  // Empty state
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyCard: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 8,
  },
  emptyCardContent: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 28,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: C.charcoal,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    textAlign: 'center',
    lineHeight: 21,
  },
  emptyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
    width: '100%',
  },
  emptyPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: C.terracotta,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  emptyPrimaryBtnText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.ivory,
  },
  emptyVoiceBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(198, 110, 78, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(198, 110, 78, 0.15)',
  },
  emptyBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  emptyFeatures: {
    marginTop: 24,
    paddingHorizontal: 8,
    gap: 16,
  },
  emptyFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  emptyFeatureIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFeatureText: {
    flex: 1,
  },
  emptyFeatureTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: C.charcoal,
    marginBottom: 2,
  },
  emptyFeatureDesc: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: C.muted,
    lineHeight: 17,
  },

  // Undo
  undoSnackbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: C.ivory,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  undoCountdownBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoCountdownText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.muted,
  },
  undoText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: C.charcoal,
    flex: 1,
  },
  undoBtnWrap: {
    backgroundColor: 'rgba(198, 110, 78, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  undoBtn: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: C.terracotta,
  },
});
