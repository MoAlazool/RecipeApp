import { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  Share,
  Platform,
  Pressable,
  LayoutAnimation,
  Dimensions,
} from 'react-native';
import { Text } from '@rneui/themed';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useShoppingStore,
  CATEGORY_ICONS,
  CATEGORY_ORDER,
  type ShoppingItem,
  type SortOption,
  type FilterOption,
} from '@/stores/shoppingStore';
import { AddItemModal } from '@/components/shopping/AddItemModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { INGREDIENT_CATEGORIES } from '@/utils/types';
import { useBottomTabBarHeight } from '@/hooks/useBottomTabBarHeight';
import { TabScreenTransition } from '@/components/layout/TabScreenTransition';

// Recipe badge colors for visual variety
const RECIPE_COLORS = [
  { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.2)' },
  { bg: 'rgba(249, 115, 22, 0.1)', text: '#F97316', border: 'rgba(249, 115, 22, 0.2)' },
  { bg: 'rgba(34, 197, 94, 0.1)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.2)' },
  { bg: 'rgba(168, 85, 247, 0.1)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.2)' },
  { bg: 'rgba(236, 72, 153, 0.1)', text: '#EC4899', border: 'rgba(236, 72, 153, 0.2)' },
];

const getRecipeColor = (recipeName: string) => {
  if (!recipeName) return null;
  const index = recipeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return RECIPE_COLORS[index % RECIPE_COLORS.length];
};

const SWIPE_DELETE_THRESHOLD = 160; // ~160px for iOS-native full-swipe delete

// Custom LayoutAnimation for smooth iOS-style row collapse (~180ms)
const deleteLayoutAnimation = {
  duration: 180,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

type SectionData = {
  title: string;
  category: string;
  icon: string;
  data: ShoppingItem[];
  itemCount?: number; // Used to preserve original count when collapsed
};

export default function ShoppingScreen() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const {
    items,
    activeListId,
    lists,
    sortBy,
    filterBy,
    toggleItem,
    removeItem,
    updateItem,
    addItem,
    clearChecked,
    setSortBy,
    setFilterBy,
    getFilteredItems,
    getProgress,
    getTotalPrice,
  } = useShoppingStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  const [showCheckedItems, setShowCheckedItems] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [deletedItem, setDeletedItem] = useState<ShoppingItem | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoSlideAnim = useRef(new Animated.Value(100)).current;

  const toggleSection = (title: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const hapticFiredRef = useRef<Set<string>>(new Set()); // Track haptic per item to fire only once
  const maxDragRef = useRef<Map<string, number>>(new Map()); // Track max drag distance for full-swipe detection

  // Safe haptic wrapper - catches async errors properly
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success') => {
    const fire = async () => {
      try {
        if (type === 'success') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === 'light') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (type === 'medium') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (type === 'heavy') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
      } catch {
        // Haptics not available, silently fail
      }
    };
    fire();
  }, []);

  // Handle deletion with undo
  const handleDeleteItem = useCallback((item: ShoppingItem) => {
    // Trigger haptic feedback
    triggerHaptic('medium');

    // Clear any existing undo timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Store deleted item and show undo
    setDeletedItem(item);
    setShowUndo(true);

    // Animate in
    Animated.spring(undoSlideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();

    // Remove from list
    removeItem(item.id);

    // Auto-hide undo after 4 seconds
    undoTimeoutRef.current = setTimeout(() => {
      Animated.timing(undoSlideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowUndo(false);
        setDeletedItem(null);
      });
    }, 4000);
  }, [removeItem, undoSlideAnim, triggerHaptic]);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (deletedItem) {
      addItem(deletedItem);

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }

      // Animate out
      Animated.timing(undoSlideAnim, {
        toValue: 100,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowUndo(false);
        setDeletedItem(null);
      });

      triggerHaptic('success');
    }
  }, [deletedItem, addItem, undoSlideAnim, triggerHaptic]);

  // Get filtered items
  const allFilteredItems = useMemo(() => {
    return getFilteredItems();
  }, [items, sortBy, filterBy, getFilteredItems]);

  // Separate checked and unchecked items
  const uncheckedItems = useMemo(() => allFilteredItems.filter(i => !i.is_checked), [allFilteredItems]);
  const checkedItems = useMemo(() => allFilteredItems.filter(i => i.is_checked), [allFilteredItems]);

  // Group unchecked items by category or recipe
  const sections = useMemo((): SectionData[] => {
    if (sortBy === 'recipe') {
      const grouped: Record<string, ShoppingItem[]> = {};
      uncheckedItems.forEach((item) => {
        const key = item.recipe_name || 'Other Items';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });
      return Object.entries(grouped).map(([title, data]) => ({
        title,
        category: 'recipe',
        icon: 'restaurant-outline',
        data,
      }));
    }

    // Default: group by category
    const grouped: Record<string, ShoppingItem[]> = {};
    uncheckedItems.forEach((item) => {
      const cat = item.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    return CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0).map((cat) => ({
      title: INGREDIENT_CATEGORIES[cat as keyof typeof INGREDIENT_CATEGORIES] || cat,
      category: cat,
      icon: CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS] || 'ellipse-outline',
      data: grouped[cat],
    }));
  }, [uncheckedItems, sortBy]);

  const sectionDataMap = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    sections.forEach((section) => {
      map.set(section.title, section.data);
    });
    return map;
  }, [sections]);

  // Filter items in collapsed sections for display
  const displaySections = useMemo(() => {
    if (sortBy !== 'recipe') return sections;

    return sections.map(section => ({
      ...section,
      data: collapsedSections.has(section.title) ? [] : section.data,
      itemCount: section.data.length, // Preserve original count for header display
    }));
  }, [sections, collapsedSections, sortBy]);

  const handleDeleteSection = useCallback((section: SectionData) => {
    const itemsToDelete = sectionDataMap.get(section.title) || section.data;
    if (!itemsToDelete.length) return;
    Alert.alert(
      'Delete Recipe Items',
      `Remove ${itemsToDelete.length} items from "${section.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            LayoutAnimation.configureNext(deleteLayoutAnimation);
            itemsToDelete.forEach((item) => handleDeleteItem(item));
          },
        },
      ]
    );
  }, [handleDeleteItem, sectionDataMap]);

  const { checked, total, percentage } = getProgress();

  // Count recipes
  const recipeCount = useMemo(() => {
    const recipes = new Set(items.filter(i => i.recipe_name).map(i => i.recipe_name));
    return recipes.size;
  }, [items]);

  // Quick add handler
  const handleQuickAdd = () => {
    if (!quickAddText.trim()) return;
    addItem({ name: quickAddText.trim(), category: 'other' });
    setQuickAddText('');
  };

  // Swipe actions - track drag for full-swipe detection
  const renderRightActions = useCallback(
    (item: ShoppingItem, progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      // Track max drag distance (negative = swiping left)
      dragX.addListener(({ value }) => {
        const absValue = Math.abs(value);
        const current = maxDragRef.current.get(item.id) || 0;
        if (absValue > current) {
          maxDragRef.current.set(item.id, absValue);
          // Fire haptic once when crossing delete threshold
          if (absValue >= SWIPE_DELETE_THRESHOLD && !hapticFiredRef.current.has(item.id)) {
            hapticFiredRef.current.add(item.id);
            triggerHaptic('medium');
          }
        }
      });

      // Button reveal animation
      const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [120, 0],
      });

      return (
        <View style={styles.swipeActionsContainer}>
          {/* Full-swipe delete background (always visible behind actions) */}
          <View style={styles.swipeDeleteFull}>
            <Ionicons name="trash" size={24} color="#FFF" />
          </View>

          {/* Partial swipe action buttons */}
          <Animated.View style={[styles.swipeActions, { transform: [{ translateX }] }]}>
            <TouchableOpacity
              style={[styles.swipeAction, styles.swipeUrgent]}
              onPress={() => {
                swipeableRefs.current.get(item.id)?.close();
                updateItem(item.id, { is_urgent: !item.is_urgent });
                triggerHaptic('light');
              }}
            >
              <Ionicons
                name={item.is_urgent ? 'flag' : 'flag-outline'}
                size={20}
                color="#FFF"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.swipeAction, styles.swipeDelete]}
              onPress={() => {
                swipeableRefs.current.get(item.id)?.close();
                handleDeleteItem(item);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      );
    },
    [updateItem, handleDeleteItem, triggerHaptic]
  );

  const handleShare = async () => {
    const unchecked = items.filter((i) => !i.is_checked);
    const grouped: Record<string, ShoppingItem[]> = {};

    unchecked.forEach((item) => {
      const cat =
        INGREDIENT_CATEGORIES[item.category as keyof typeof INGREDIENT_CATEGORIES] ||
        item.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    let text = '🛒 Shopping List\n\n';
    Object.entries(grouped).forEach(([category, categoryItems]) => {
      text += `📦 ${category}\n`;
      categoryItems.forEach((item) => {
        const amount = item.amount ? `${item.amount}${item.unit ? ' ' + item.unit : ''}` : '';
        text += `  ○ ${item.name}${amount ? ' - ' + amount : ''}\n`;
      });
      text += '\n';
    });

    try {
      await Share.share({ message: text });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const renderItem = useCallback(
    ({ item, index, section }: { item: ShoppingItem; index: number; section: SectionData }) => {
      const isFirst = index === 0;
      const isLast = index === section.data.length - 1;
      const recipeColor = item.recipe_name ? getRecipeColor(item.recipe_name) : null;

      return (
        <Swipeable
          ref={(ref) => {
            if (ref) swipeableRefs.current.set(item.id, ref);
          }}
          renderRightActions={(progress, dragX) => renderRightActions(item, progress, dragX)}
          overshootRight={false}
          friction={2}
          rightThreshold={40}
          onSwipeableOpen={(direction) => {
            // Check if full swipe exceeded delete threshold
            const maxDrag = maxDragRef.current.get(item.id) || 0;
            if (direction === 'right' && maxDrag >= SWIPE_DELETE_THRESHOLD) {
              LayoutAnimation.configureNext(deleteLayoutAnimation);
              handleDeleteItem(item);
            }
            // Reset tracking
            maxDragRef.current.delete(item.id);
            hapticFiredRef.current.delete(item.id);
          }}
          onSwipeableClose={() => {
            // Reset tracking on close
            maxDragRef.current.delete(item.id);
            hapticFiredRef.current.delete(item.id);
          }}
          containerStyle={[
            isFirst && styles.itemCardFirst,
            isLast && styles.itemCardLast,
            section.data.length === 1 && styles.itemCardSingle,
          ]}
        >
          <Pressable
            onPress={() => toggleItem(item.id)}
            style={[
              styles.item,
              section.data.length === 1 && styles.itemSingle,
              section.data.length > 1 && isFirst && styles.itemFirst,
              section.data.length > 1 && isLast && styles.itemLast,
              section.data.length > 1 && !isFirst && !isLast && styles.itemMiddle,
              !isLast && styles.itemBorder,
              item.is_urgent && styles.itemUrgent,
            ]}
          >
            {/* Circular Checkbox */}
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                onPress={() => toggleItem(item.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.checkbox,
                  item.is_checked && styles.checkboxChecked,
                ]}
              >
                {item.is_checked && (
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>

            {/* Item Content */}
            <View style={styles.itemContent}>
              <Text
                style={[
                  styles.itemName,
                  item.is_checked && styles.itemNameChecked,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              <View style={styles.itemMeta}>
                {item.amount && (
                  <Text style={styles.itemAmount}>
                    {item.amount}{item.unit ? ` ${item.unit}` : ''}
                  </Text>
                )}

                {sortBy !== 'recipe' && item.amount && item.recipe_name && (
                  <View style={styles.dotSeparator} />
                )}

                {sortBy !== 'recipe' && item.recipe_name && recipeColor && (
                  <View style={[
                    styles.recipeBadge,
                    { backgroundColor: recipeColor.bg }
                  ]}>
                    <Text style={[styles.recipeBadgeText, { color: recipeColor.text }]} numberOfLines={1}>
                      {item.recipe_name}
                    </Text>
                  </View>
                )}

                {item.is_urgent && (
                  <>
                    {(item.amount || (sortBy !== 'recipe' && item.recipe_name)) && <View style={styles.dotSeparator} />}
                    <Ionicons name="alert-circle" size={12} color="#F2330D" />
                  </>
                )}
              </View>
            </View>
          </Pressable>
        </Swipeable>
      );
    },
    [toggleItem, renderRightActions, sortBy, triggerHaptic, handleDeleteItem]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => {
      const isRecipeView = sortBy === 'recipe';
      const isCollapsed = collapsedSections.has(section.title);
      const itemCount = section.itemCount ?? section.data.length;

      const leftContent = (
        <>
          {isRecipeView && (
            <Ionicons
              name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
              size={18}
              color="#9C5749"
            />
          )}
          <Ionicons name={section.icon as any} size={20} color="#F2330D" />
          <Text style={styles.sectionTitle} numberOfLines={1}>{section.title}</Text>
        </>
      );

      if (isRecipeView) {
        return (
          <View style={styles.sectionHeader}>
            <TouchableOpacity
              style={styles.sectionHeaderTap}
              onPress={() => toggleSection(section.title)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionLeft}>
                {leftContent}
              </View>
            </TouchableOpacity>
            <View style={styles.sectionRight}>
              <TouchableOpacity
                style={styles.sectionCheckButton}
                onPress={() => handleDeleteSection(section)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionCheckCircle}>
                  <Ionicons name="trash-outline" size={12} color="#F2330D" />
                </View>
              </TouchableOpacity>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionCount}>{itemCount} items</Text>
              </View>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLeft}>
            {leftContent}
          </View>
          <View style={styles.sectionRight}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionCount}>{itemCount} items</Text>
            </View>
          </View>
        </View>
      );
    },
    [sortBy, collapsedSections, toggleSection, handleDeleteSection]
  );

  // Sort options as pills
  const sortPills: { key: SortOption; label: string }[] = [
    { key: 'category', label: 'By Aisle' },
    { key: 'recipe', label: 'By Recipe' },
  ];

  if (items.length === 0) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <TabScreenTransition style={styles.container}>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <View>
              <Text style={styles.headerTitle}>Shopping List</Text>
              <Text style={styles.headerSubtitle}>No items yet</Text>
            </View>
            <TouchableOpacity style={styles.moreButton} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle" size={28} color="#F2330D" />
            </TouchableOpacity>
          </View>

          <EmptyState
            icon="cart-outline"
            title="Your shopping list is empty"
            subtitle="Add items manually or import ingredients from your recipes"
          />

          <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
        </TabScreenTransition>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <TabScreenTransition style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View>
          <Text style={styles.headerTitle}>Shopping List</Text>
          <Text style={styles.headerSubtitle}>
            {total} items{recipeCount > 0 ? ` • ${recipeCount} recipes` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.moreButton} onPress={handleShare}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#F2330D" />
        </TouchableOpacity>
      </View>

      {/* Quick Add Input */}
      <View style={styles.quickAddContainer}>
        <View style={styles.quickAddInput}>
          <Ionicons name="add" size={20} color="#9C5749" style={styles.quickAddIcon} />
          <TextInput
            style={styles.quickAddTextInput}
            placeholder="Add item (e.g., Milk, Eggs)..."
            placeholderTextColor="#9C5749"
            value={quickAddText}
            onChangeText={setQuickAddText}
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.quickAddButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="options-outline" size={18} color="#F2330D" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Pills */}
      <View style={styles.pillsContainer}>
        {sortPills.map((pill) => (
          <TouchableOpacity
            key={pill.key}
            style={[
              styles.pill,
              sortBy === pill.key && styles.pillActive,
            ]}
            onPress={() => setSortBy(pill.key)}
          >
            <Text style={[
              styles.pillText,
              sortBy === pill.key && styles.pillTextActive,
            ]}>
              {pill.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content */}
      <SectionList
        sections={displaySections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomTabBarHeight }]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => (
          <>
            {/* Checked Items Section */}
            {checkedItems.length > 0 && (
              <View style={styles.checkedSection}>
                <TouchableOpacity
                  style={styles.checkedHeader}
                  onPress={() => setShowCheckedItems(!showCheckedItems)}
                >
                  <Text style={styles.checkedTitle}>
                    Checked Items ({checkedItems.length})
                  </Text>
                  <Ionicons
                    name={showCheckedItems ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#9C5749"
                  />
                </TouchableOpacity>

                {showCheckedItems && (
                  <View style={styles.checkedList}>
                    {checkedItems.map((item, index) => (
                      <Swipeable
                        key={item.id}
                        ref={(ref) => {
                          if (ref) swipeableRefs.current.set(item.id, ref);
                        }}
                        renderRightActions={(progress, dragX) => renderRightActions(item, progress, dragX)}
                        overshootRight={false}
                        friction={2}
                        rightThreshold={40}
                        onSwipeableOpen={(direction) => {
                          const maxDrag = maxDragRef.current.get(item.id) || 0;
                          if (direction === 'right' && maxDrag >= SWIPE_DELETE_THRESHOLD) {
                            LayoutAnimation.configureNext(deleteLayoutAnimation);
                            handleDeleteItem(item);
                          }
                          maxDragRef.current.delete(item.id);
                          hapticFiredRef.current.delete(item.id);
                        }}
                        onSwipeableClose={() => {
                          maxDragRef.current.delete(item.id);
                          hapticFiredRef.current.delete(item.id);
                        }}
                      >
                        <Pressable
                          onPress={() => toggleItem(item.id)}
                          style={[
                            styles.checkedItem,
                            index !== checkedItems.length - 1 && styles.itemBorder,
                          ]}
                        >
                          <TouchableOpacity
                            onPress={() => toggleItem(item.id)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={[styles.checkbox, styles.checkboxChecked]}
                          >
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                          </TouchableOpacity>
                          <Text style={styles.checkedItemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </Pressable>
                      </Swipeable>
                    ))}

                    <TouchableOpacity
                      style={styles.clearCheckedButton}
                      onPress={() => {
                        Alert.alert(
                          'Clear Checked Items',
                          `Remove ${checkedItems.length} checked items?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Clear', style: 'destructive', onPress: clearChecked },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#F2330D" />
                      <Text style={styles.clearCheckedText}>Clear all checked</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      />

      {/* Undo Snackbar */}
      {showUndo && deletedItem && (
        <Animated.View
          style={[
            styles.undoSnackbar,
            {
              bottom: bottomTabBarHeight + 8, // Above floating nav bar
              transform: [{ translateY: undoSlideAnim }]
            }
          ]}
        >
          <View style={styles.undoContent}>
            <Ionicons name="trash-outline" size={18} color="#FFF" />
            <Text style={styles.undoText} numberOfLines={1}>
              Deleted "{deletedItem.name}"
            </Text>
          </View>
          <TouchableOpacity
            style={styles.undoButton}
            onPress={handleUndo}
            activeOpacity={0.7}
          >
            <Text style={styles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Add Item Modal */}
      <AddItemModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
      </TabScreenTransition>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#F8F6F5',
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1C100D',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    marginTop: 2,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickAddContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickAddInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickAddIcon: {
    marginRight: 8,
  },
  quickAddTextInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  quickAddButton: {
    padding: 8,
    marginLeft: 4,
  },
  pillsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  pillActive: {
    backgroundColor: '#F2330D',
    borderColor: 'transparent',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontFamily: 'NotoSans_700Bold',
  },
  listContent: {
    paddingHorizontal: 16,
    // paddingBottom is set dynamically via useBottomTabBarHeight()
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionHeaderTap: {
    flex: 1,
  },
  sectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1C100D',
  },
  sectionCheckButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionCheckCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionCount: {
    fontSize: 11,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  itemCardFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  itemCardLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  itemCardSingle: {
    borderRadius: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  itemFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'transparent',
  },
  itemLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'transparent',
  },
  itemMiddle: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'transparent',
  },
  itemSingle: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  itemUrgent: {
    backgroundColor: 'rgba(242, 51, 13, 0.03)',
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8D3CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#F2330D',
    borderColor: '#F2330D',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: 'NotoSans_500Medium',
    color: '#1C100D',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#9C5749',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 6,
  },
  itemAmount: {
    fontSize: 12,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
  },
  dotSeparator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8D3CE',
  },
  recipeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    maxWidth: 140,
  },
  recipeBadgeText: {
    fontSize: 10,
    fontFamily: 'NotoSans_500Medium',
  },
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeDeleteFull: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_DELETE_THRESHOLD + 100,
    backgroundColor: '#FF3B30', // iOS system red
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  swipeUrgent: {
    backgroundColor: '#F59E0B',
  },
  swipeDelete: {
    backgroundColor: '#FF3B30', // iOS system red
  },
  checkedSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  checkedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  checkedTitle: {
    fontSize: 14,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#9C5749',
  },
  checkedList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1C100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  checkedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  checkedItemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#9C5749',
    textDecorationLine: 'line-through',
  },
  clearCheckedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.04)',
  },
  clearCheckedText: {
    fontSize: 13,
    fontFamily: 'NotoSans_600SemiBold',
    color: '#F2330D',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F2330D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F2330D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  undoSnackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#1C100D',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  undoText: {
    fontSize: 14,
    fontFamily: 'NotoSans_500Medium',
    color: '#FFF',
    flex: 1,
  },
  undoButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(242, 51, 13, 0.2)',
  },
  undoButtonText: {
    fontSize: 13,
    fontFamily: 'NotoSans_700Bold',
    color: '#F2330D',
    letterSpacing: 0.5,
  },
});
