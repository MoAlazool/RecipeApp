import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '@rneui/themed';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeInDown,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { firebaseService } from '@/services/firebase.service';
import { useUsageGate } from '@/hooks/useUsageGate';
import UsageLimitSheet from '@/components/ui/UsageLimitSheet';
import type { FridgeScan } from '@/utils/types';
import {
  getIngredientEmoji,
  CATEGORY_BG_COLORS,
} from '@/utils/ingredientEmojis';
import { getIngredientImage } from '@/utils/ingredientImages';

// ============================================================
// DESIGN TOKENS — Matching Recipe Detail Screen
// ============================================================

const C = {
  ivory: '#FFFFFF',
  charcoal: '#1A1510',
  gold: '#D4AF37',
  terracotta: '#C66E4E',
  muted: '#8A8578',
  hairline: 'rgba(26, 21, 16, 0.06)',
  glass: 'rgba(255, 255, 255, 0.85)',
  cardBg: 'rgba(26, 21, 16, 0.03)',
  olive: '#6B8E23',
};

const SHADOW_SOFT = {
  shadowColor: '#1A1510',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 6,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 24;
const CARD_GAP = 10;
const NUM_COLUMNS = 4;
const CARD_SIZE = (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

// ============================================================
// INGREDIENT CARD COMPONENT
// ============================================================

interface IngredientCardProps {
  ingredient: {
    name: string;
    category?: string;
    quantity_estimate?: string;
    confidence_percent?: number;
  };
  index: number;
}

function IngredientCard({ ingredient, index }: IngredientCardProps) {
  const ingredientImage = getIngredientImage(ingredient.name);
  const emoji = getIngredientEmoji(ingredient.name);
  const bgColor = CATEGORY_BG_COLORS[ingredient.category as keyof typeof CATEGORY_BG_COLORS] || '#F5F3EE';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={styles.ingredientCard}
    >
      <View
        style={[
          styles.ingredientImageArea,
          ingredientImage
            ? { backgroundColor: 'transparent', borderWidth: 0 }
            : { backgroundColor: bgColor },
        ]}
      >
        {ingredientImage ? (
          <ExpoImage
            source={ingredientImage}
            style={styles.ingredientPhoto}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={styles.ingredientEmoji}>{emoji}</Text>
        )}
        {ingredient.confidence_percent && (
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>{ingredient.confidence_percent}%</Text>
          </View>
        )}
      </View>
      <Text style={styles.ingredientName} numberOfLines={2}>
        {ingredient.name}
      </Text>
      {ingredient.quantity_estimate && (
        <Text style={styles.ingredientQuantity}>{ingredient.quantity_estimate}</Text>
      )}
    </Animated.View>
  );
}

// ============================================================
// ADD CARD COMPONENT
// ============================================================

function AddCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.ingredientCard, pressed && { opacity: 0.7 }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={styles.addCardInner}>
        <Ionicons name="add" size={28} color={C.muted} />
      </View>
      <Text style={styles.addCardLabel}>Add Item</Text>
    </Pressable>
  );
}

// ============================================================
// MAIN SCREEN
// ============================================================

export default function ScanDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scanId: string }>();
  const { checkGate, limitSheetRef, limitInfo } = useUsageGate();
  const [scan, setScan] = useState<FridgeScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [localIngredients, setLocalIngredients] = useState<Array<{
    name: string;
    category?: string;
    quantity_estimate?: string;
    confidence_percent?: number;
  }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualItemName, setManualItemName] = useState('');

  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const headerAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => {
    loadScan();
  }, []);

  const loadScan = async () => {
    try {
      setLoading(true);
      const scanData = await firebaseService.getFridgeScan(params.scanId);
      setScan(scanData);
      if (scanData) {
        setLocalIngredients(scanData.ingredients);
      }
    } catch (error) {
      console.error('[ScanDetail] Failed to load scan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScan = useCallback(() => {
    Alert.alert('Delete Scan', 'Are you sure you want to delete this scan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await firebaseService.deleteFridgeScan(params.scanId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (err) {
            console.error('[ScanDetail] Failed to delete scan:', err);
            Alert.alert('Error', 'Failed to delete scan');
          }
        },
      },
    ]);
  }, [params.scanId, router]);

  const handleAddIngredient = () => {
    setShowAddModal(true);
    setManualItemName('');
  };

  const handleConfirmAdd = () => {
    if (!manualItemName.trim()) return;
    const newIngredient = {
      name: manualItemName.trim(),
      category: 'other',
      confidence_percent: 100,
    };
    const updated = [...localIngredients, newIngredient];
    setLocalIngredients(updated);
    setShowAddModal(false);
    setManualItemName('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Persist to Firebase
    firebaseService.updateFridgeScanIngredients(params.scanId, updated).catch((err) => {
      console.error('[ScanDetail] Failed to save ingredient:', err);
    });
  };

  const handleFindRecipes = useCallback(() => {
    if (localIngredients.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const selectedItems = localIngredients.map((ing) => ({
      name: ing.name,
      emoji: getIngredientEmoji(ing.name),
    }));

    router.replace({
      pathname: '/recipe-preferences',
      params: {
        ingredients: JSON.stringify(selectedItems),
        sourceType: 'fridge_scan',
      },
    });
  }, [localIngredients, router]);

  const handleChatWithAI = useCallback(async () => {
    if (localIngredients.length === 0) return;

    const allowed = await checkGate('ai_chat');
    if (!allowed) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const ingredientsWithQuantities = localIngredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity_estimate || 'some',
      emoji: getIngredientEmoji(ing.name),
      category: ing.category,
    }));

    router.push({
      pathname: '/ai-chef-chat',
      params: { ingredients: JSON.stringify(ingredientsWithQuantities) },
    });
  }, [localIngredients, router, checkGate]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Ionicons name="scan" size={40} color={C.gold} />
        </View>
        <Text style={styles.loadingText}>Loading items...</Text>
      </View>
    );
  }

  // Error state
  if (!scan) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={48} color={C.muted} />
        </View>
        <Text style={styles.errorTitle}>Scan Not Found</Text>
        <Text style={styles.errorText}>This scan may have been deleted</Text>
        <Pressable
          style={({ pressed }) => [
            styles.errorBtn,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.errorBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const scanDate = new Date(scan.created_at);
  const dateString = scanDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const timeString = scanDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Sticky Header */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top }]}>
        <Animated.View style={[styles.stickyHeaderBg, headerAnimStyle]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        </Animated.View>
        <View style={styles.stickyHeaderInner}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.charcoal} />
          </TouchableOpacity>
          <Text style={styles.stickyTitle}>Detected Items</Text>
          <TouchableOpacity onPress={handleDeleteScan} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="trash-outline" size={20} color={C.terracotta} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scroll Content */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 70 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Date & Stats */}
        <View style={styles.headerSection}>
          <Text style={styles.dateText}>{dateString}</Text>
          <Text style={styles.timeText}>{timeString}</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(107, 142, 35, 0.1)' }]}>
              <Ionicons name="cube-outline" size={18} color={C.olive} />
            </View>
            <View>
              <Text style={styles.statValue}>{localIngredients.length}</Text>
              <Text style={styles.statLabel}>Items Found</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
              <Ionicons name="sparkles" size={18} color={C.gold} />
            </View>
            <View>
              <Text style={styles.statValue}>AI</Text>
              <Text style={styles.statLabel}>Detected</Text>
            </View>
          </View>
        </View>

        {/* Gold Hairline */}
        <View style={styles.goldHairline} />

        {/* Section Heading */}
        <Text style={styles.sectionHeading}>Your Ingredients</Text>

        {/* Ingredients Grid */}
        <View style={styles.ingredientGrid}>
          {localIngredients.map((ingredient, index) => (
            <IngredientCard
              key={`${ingredient.name}-${index}`}
              ingredient={ingredient}
              index={index}
            />
          ))}
          <AddCard onPress={handleAddIngredient} />
        </View>

        <View style={{ height: 160 }} />
      </Animated.ScrollView>

      {/* Bottom Dock */}
      <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={styles.dockHairline} />
        <View style={styles.dockInner}>
          <Pressable
            style={({ pressed }) => [
              styles.dockSecondaryBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={handleChatWithAI}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.charcoal} />
            <Text style={styles.dockSecondaryText}>Ask AI Chef</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.dockPrimaryBtn,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={handleFindRecipes}
          >
            <Ionicons name="sparkles" size={18} color="#FFF" />
            <Text style={styles.dockPrimaryText}>Find Recipes</Text>
          </Pressable>
        </View>
      </View>

      {/* Add Ingredient — custom overlay (no native Modal) */}
      {showAddModal && (
        <View style={styles.modalOverlayAbsolute}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setShowAddModal(false)} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Ingredient</Text>
                <Pressable onPress={() => setShowAddModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={C.muted} />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Ingredient Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Tomatoes, Milk, Eggs..."
                  placeholderTextColor={C.muted}
                  value={manualItemName}
                  onChangeText={setManualItemName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmAdd}
                />
              </View>
              <View style={styles.modalFooter}>
                <Pressable
                  style={({ pressed }) => [styles.modalCancelBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalConfirmBtn,
                    !manualItemName.trim() && styles.modalBtnDisabled,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={handleConfirmAdd}
                  disabled={!manualItemName.trim()}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={styles.modalConfirmText}>Add</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <UsageLimitSheet
        ref={limitSheetRef}
        limitType={limitInfo.type}
        used={limitInfo.used}
        total={limitInfo.total}
      />
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.ivory,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.ivory,
    gap: 16,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: C.muted,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.ivory,
    paddingHorizontal: 40,
    gap: 12,
  },
  errorIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: C.charcoal,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
  },
  errorBtn: {
    backgroundColor: C.terracotta,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  errorBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFF',
  },

  // Sticky Header
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  stickyHeaderBg: {
    ...StyleSheet.absoluteFillObject,
    borderBottomWidth: 0.5,
    borderBottomColor: C.hairline,
    overflow: 'hidden',
  },
  stickyHeaderInner: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
  },

  // Header Section
  headerSection: {
    marginBottom: 20,
  },
  dateText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: C.charcoal,
    letterSpacing: -0.5,
  },
  timeText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    color: C.muted,
    marginTop: 4,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardBg,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: C.charcoal,
  },
  statLabel: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 11,
    color: C.muted,
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: C.hairline,
    marginHorizontal: 16,
  },

  // Gold Hairline
  goldHairline: {
    height: 0.5,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    marginBottom: 24,
  },

  // Section
  sectionHeading: {
    fontFamily: 'PlayfairDisplay_800ExtraBold',
    fontSize: 22,
    color: C.charcoal,
    marginBottom: 18,
  },

  // Ingredient Grid
  ingredientGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  ingredientCard: {
    width: CARD_SIZE,
    marginBottom: 6,
  },
  ingredientImageArea: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    ...SHADOW_SOFT,
  },
  ingredientEmoji: {
    fontSize: 32,
  },
  ingredientPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  confidenceBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(107, 142, 35, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  confidenceText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 9,
    color: '#FFF',
  },
  ingredientName: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.charcoal,
    textAlign: 'left',
    marginTop: 7,
  },
  ingredientQuantity: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 11,
    color: C.muted,
    textAlign: 'left',
    marginTop: 2,
  },

  // Dock
  dock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#1A1510',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 14,
  },
  dockHairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
  },
  dockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  dockSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.cardBg,
    borderRadius: 28,
    paddingVertical: 16,
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  dockSecondaryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: C.charcoal,
    letterSpacing: 0.3,
  },
  dockPrimaryBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.terracotta,
    borderRadius: 28,
    paddingVertical: 16,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  dockPrimaryText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#FFF',
    letterSpacing: 0.3,
  },

  // Add Card
  addCardInner: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(26, 21, 16, 0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.cardBg,
  },
  addCardLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: C.muted,
    textAlign: 'left',
    marginTop: 7,
  },

  // Modal
  modalOverlayAbsolute: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalContent: {
    backgroundColor: C.ivory,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: C.charcoal,
  },
  modalBody: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: C.muted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  textInput: {
    height: 52,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    borderWidth: 0.5,
    borderColor: C.hairline,
    paddingHorizontal: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: C.charcoal,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: C.hairline,
  },
  modalCancelText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 15,
    color: C.muted,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.terracotta,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: C.terracotta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBtnDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#FFF',
  },
});
