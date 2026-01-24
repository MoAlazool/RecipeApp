import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { firebaseService } from '@/services/firebase.service';
import type { Ingredient, IngredientCategory } from '@/utils/types';

// ============================================
// TYPES
// ============================================

export interface ShoppingItem {
  id: string;
  list_id: string;
  recipe_id?: string;
  recipe_name?: string;
  name: string;
  amount?: number;
  unit?: string;
  category: IngredientCategory;
  is_checked: boolean;
  is_urgent: boolean;
  notes?: string;
  price?: number;
  store_section?: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type SortOption = 'category' | 'name' | 'checked' | 'recent' | 'recipe';
export type FilterOption = 'all' | 'unchecked' | 'checked' | 'urgent';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value?: string) => !!value && UUID_REGEX.test(value);

// Default lists colors
const LIST_COLORS = ['#F2330D', '#53D887', '#4A90D9', '#9B59B6', '#F39C12', '#1ABC9C'];
const LIST_ICONS = ['cart', 'basket', 'bag', 'storefront', 'restaurant', 'cafe'];

// Common ingredients for quick add
export const COMMON_INGREDIENTS = [
  { name: 'Milk', category: 'dairy' as IngredientCategory },
  { name: 'Eggs', category: 'dairy' as IngredientCategory },
  { name: 'Bread', category: 'pantry' as IngredientCategory },
  { name: 'Butter', category: 'dairy' as IngredientCategory },
  { name: 'Cheese', category: 'dairy' as IngredientCategory },
  { name: 'Chicken', category: 'meat' as IngredientCategory },
  { name: 'Rice', category: 'pantry' as IngredientCategory },
  { name: 'Pasta', category: 'pantry' as IngredientCategory },
  { name: 'Onion', category: 'produce' as IngredientCategory },
  { name: 'Garlic', category: 'produce' as IngredientCategory },
  { name: 'Tomatoes', category: 'produce' as IngredientCategory },
  { name: 'Olive Oil', category: 'pantry' as IngredientCategory },
  { name: 'Salt', category: 'spices' as IngredientCategory },
  { name: 'Pepper', category: 'spices' as IngredientCategory },
  { name: 'Sugar', category: 'pantry' as IngredientCategory },
  { name: 'Flour', category: 'pantry' as IngredientCategory },
];

// Category icons mapping
export const CATEGORY_ICONS: Record<string, string> = {
  produce: 'leaf',
  meat: 'fish',
  dairy: 'water',
  pantry: 'cube',
  spices: 'flame',
  frozen: 'snow',
  beverage: 'wine',
  condiment: 'flask',
  other: 'ellipsis-horizontal',
};

// Category order for consistent display
export const CATEGORY_ORDER = [
  'produce',
  'meat',
  'dairy',
  'pantry',
  'spices',
  'frozen',
  'beverage',
  'condiment',
  'other',
];

// Store sections for organization
export const STORE_SECTIONS = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Frozen',
  'Pantry',
  'Beverages',
  'Snacks',
  'Health & Beauty',
  'Household',
];

// ============================================
// STORE INTERFACE
// ============================================

interface ShoppingState {
  // Data
  items: ShoppingItem[];
  lists: ShoppingList[];
  activeListId: string;

  // UI State
  sortBy: SortOption;
  filterBy: FilterOption;
  searchQuery: string;
  isLoading: boolean;
  selectedItems: string[];

  // List Management
  createList: (name: string) => ShoppingList;
  updateList: (id: string, updates: Partial<ShoppingList>) => void;
  deleteList: (id: string) => void;
  setActiveList: (id: string) => void;
  getActiveList: () => ShoppingList;

  // Item Management
  addItem: (item: Partial<ShoppingItem>) => Promise<void>;
  addItemsFromRecipe: (recipeId: string, recipeName: string, ingredients: Ingredient[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  toggleUrgent: (id: string) => void;
  updateItem: (id: string, updates: Partial<ShoppingItem>) => void;
  fetchItems: () => Promise<void>;

  // Bulk Actions
  clearChecked: () => Promise<void>;
  clearAll: () => void;
  checkAll: () => void;
  uncheckAll: () => void;
  deleteSelected: () => void;
  toggleSelectItem: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // UI Actions
  setSortBy: (sort: SortOption) => void;
  setFilterBy: (filter: FilterOption) => void;
  setSearchQuery: (query: string) => void;

  // Computed
  getFilteredItems: () => ShoppingItem[];
  getGroupedItems: () => { title: string; icon: string; data: ShoppingItem[] }[];

  // Reset (for sign out)
  resetStore: () => void;
  getProgress: () => { checked: number; total: number; percentage: number };
  getTotalPrice: () => number;
  getItemsByRecipe: () => Record<string, ShoppingItem[]>;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      lists: [
        {
          id: 'default',
          name: 'My Shopping List',
          color: '#F2330D',
          icon: 'cart',
          is_default: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      activeListId: 'default',
      sortBy: 'category',
      filterBy: 'all',
      searchQuery: '',
      isLoading: false,
      selectedItems: [],

      // ============================================
      // LIST MANAGEMENT
      // ============================================

      createList: (name: string) => {
        const newList: ShoppingList = {
          id: Date.now().toString(),
          name,
          color: LIST_COLORS[get().lists.length % LIST_COLORS.length],
          icon: LIST_ICONS[get().lists.length % LIST_ICONS.length],
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          lists: [...state.lists, newList],
        }));

        return newList;
      },

      updateList: (id: string, updates: Partial<ShoppingList>) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === id
              ? { ...list, ...updates, updated_at: new Date().toISOString() }
              : list
          ),
        }));
      },

      deleteList: (id: string) => {
        const state = get();
        if (state.lists.find((l) => l.id === id)?.is_default) return;

        set((state) => ({
          lists: state.lists.filter((list) => list.id !== id),
          items: state.items.filter((item) => item.list_id !== id),
          activeListId: state.activeListId === id ? 'default' : state.activeListId,
        }));
      },

      setActiveList: (id: string) => {
        set({ activeListId: id, selectedItems: [] });
      },

      getActiveList: () => {
        const state = get();
        return state.lists.find((l) => l.id === state.activeListId) || state.lists[0];
      },

      // ============================================
      // ITEM MANAGEMENT
      // ============================================

      addItem: async (item: Partial<ShoppingItem>) => {
        const state = get();

        if (!item.name?.trim()) {
          return;
        }

        // Check for duplicates in the active list
        const existingItem = state.items.find(
          (i) => i.list_id === state.activeListId &&
                 i.name.toLowerCase() === item.name?.toLowerCase()
        );

        if (existingItem) {
          // Update quantity instead of adding duplicate
          const newAmount = (existingItem.amount || 0) + (item.amount || 1);

          // Sync to Supabase
          try {
            if (isUuid(existingItem.id) && isUuid(existingItem.list_id)) {
              await firebaseService.updateShoppingItem(existingItem.id, { amount: newAmount });
            }
          } catch (error) {
            console.error('Failed to update shopping item:', error);
          }

          set((state) => ({
            items: state.items.map((i) =>
              i.id === existingItem.id
                ? { ...i, amount: newAmount, updated_at: new Date().toISOString() }
                : i
            ),
          }));
          return;
        }

        const now = new Date().toISOString();
        const newItem: ShoppingItem = {
          ...item, // Spread first so our values take precedence
          id: Crypto.randomUUID(),
          list_id: state.activeListId, // Always use active list
          name: item.name.trim(),
          amount: item.amount,
          unit: item.unit,
          category: item.category || 'other',
          is_checked: false,
          is_urgent: item.is_urgent || false,
          notes: item.notes,
          price: item.price,
          store_section: item.store_section,
          created_at: now,
          updated_at: now,
        };

        // Sync to Supabase
        if (isUuid(state.activeListId)) {
          try {
            await firebaseService.addShoppingItem({
              id: newItem.id,
              list_id: state.activeListId,
              recipe_id: newItem.recipe_id,
              name: newItem.name,
              amount: newItem.amount,
              unit: newItem.unit,
              category: newItem.category,
              is_checked: newItem.is_checked,
              created_at: newItem.created_at,
              updated_at: newItem.updated_at,
            });
          } catch (error) {
            console.error('Failed to sync shopping item:', error);
          }
        }

        set((state) => ({
          items: [newItem, ...state.items],
        }));
      },

      addItemsFromRecipe: async (recipeId: string, recipeName: string, ingredients: Ingredient[]) => {
        if (!ingredients || ingredients.length === 0) return;

        const state = get();
        const existingNames = state.items
          .filter((i) => i.list_id === state.activeListId)
          .map((i) => i.name.toLowerCase());

        const newItems: ShoppingItem[] = ingredients
          .filter((ing) => ing && ing.name && !existingNames.includes(ing.name.toLowerCase()))
          .map((ing) => ({
            id: Crypto.randomUUID(),
            list_id: state.activeListId,
            recipe_id: recipeId,
            recipe_name: recipeName,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            category: ing.category || 'other',
            is_checked: false,
            is_urgent: false,
            notes: ing.notes,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

        // Sync new items to Supabase
        if (isUuid(state.activeListId)) {
          try {
            for (const item of newItems) {
              await firebaseService.addShoppingItem({
                id: item.id,
                list_id: item.list_id,
                recipe_id: item.recipe_id,
                name: item.name,
                amount: item.amount,
                unit: item.unit,
                category: item.category,
                is_checked: item.is_checked,
                created_at: item.created_at,
                updated_at: item.updated_at,
              });
            }
          } catch (error) {
            console.error('Failed to sync recipe items:', error);
          }
        }

        // Update amounts for existing items
        const updatedItems = state.items.map((item) => {
          if (item.list_id !== state.activeListId) return item;

          const matchingIngredient = ingredients.find(
            (ing) => ing && ing.name && ing.name.toLowerCase() === item.name.toLowerCase()
          );

          if (matchingIngredient && matchingIngredient.amount) {
            return {
              ...item,
              amount: (item.amount || 0) + matchingIngredient.amount,
              updated_at: new Date().toISOString(),
            };
          }

          return item;
        });

        // Sync updated amounts to Supabase
        try {
          for (const item of updatedItems) {
            const originalItem = state.items.find((i) => i.id === item.id);
            if (originalItem && originalItem.amount !== item.amount && isUuid(item.id) && isUuid(item.list_id)) {
              await firebaseService.updateShoppingItem(item.id, { amount: item.amount });
            }
          }
        } catch (error) {
          console.error('Failed to sync updated amounts:', error);
        }

        set({
          items: [...newItems, ...updatedItems],
        });
      },

      removeItem: async (id: string) => {
        const itemToRemove = get().items.find((item) => item.id === id);

        try {
          if (itemToRemove && isUuid(id) && isUuid(itemToRemove.list_id)) {
            await firebaseService.deleteShoppingItem(id);
          }
        } catch (error) {
          console.error('Failed to delete shopping item:', error);
        }

        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          selectedItems: state.selectedItems.filter((itemId) => itemId !== id),
        }));
      },

      toggleItem: async (id: string) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;

        const newChecked = !item.is_checked;

        // OPTIMISTIC: Update UI immediately
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, is_checked: newChecked, updated_at: new Date().toISOString() }
              : item
          ),
        }));

        // BACKGROUND: Sync to Supabase without blocking
        if (isUuid(id) && isUuid(item.list_id)) {
          firebaseService.updateShoppingItem(id, { is_checked: newChecked })
            .catch((error) => {
              console.error('Failed to sync, rolling back:', error);
              // Rollback on failure
              set((state) => ({
                items: state.items.map((item) =>
                  item.id === id ? { ...item, is_checked: !newChecked } : item
                ),
              }));
            });
        }
      },

      toggleUrgent: (id: string) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, is_urgent: !item.is_urgent, updated_at: new Date().toISOString() }
              : item
          ),
        }));
      },

      updateItem: (id: string, updates: Partial<ShoppingItem>) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, ...updates, updated_at: new Date().toISOString() }
              : item
          ),
        }));
      },

      fetchItems: async () => {
        try {
          const state = get();
          set({ isLoading: true });
          const shoppingList = await firebaseService.getShoppingList();
          if (shoppingList?.items) {
            const normalizedItems: ShoppingItem[] = shoppingList.items.map((item: any) => ({
              ...item,
              recipe_name: item.recipe_name ?? undefined,
              is_urgent: item.is_urgent ?? false,
              notes: item.notes,
              price: item.price,
              store_section: item.store_section,
            }));
            const baseList =
              state.lists.find((list) => list.is_default) ||
              state.lists[0] || {
                id: 'default',
                name: 'My Shopping List',
                color: '#F2330D',
                icon: 'cart',
                is_default: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

            const syncedList: ShoppingList = {
              ...baseList,
              id: shoppingList.id,
              name: shoppingList.name || baseList.name,
              is_default: true,
              created_at: shoppingList.created_at || baseList.created_at,
              updated_at: shoppingList.updated_at || baseList.updated_at,
            };

            const nextLists = state.lists.some((list) => list.is_default)
              ? state.lists.map((list) => (list.is_default ? syncedList : list))
              : [syncedList, ...state.lists];

            set({
              items: normalizedItems,
              lists: nextLists,
              activeListId: syncedList.id,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Failed to fetch shopping items:', error);
          set({ isLoading: false });
        }
      },

      // ============================================
      // BULK ACTIONS
      // ============================================

      clearChecked: async () => {
        const state = get();

        const checkedItems = state.items.filter(
          (item) => item.list_id === state.activeListId && item.is_checked
        );

        try {
          for (const item of checkedItems) {
            if (isUuid(item.id) && isUuid(item.list_id)) {
              await firebaseService.deleteShoppingItem(item.id);
            }
          }
        } catch (error) {
          console.error('Failed to clear checked items:', error);
        }

        set({
          items: state.items.filter(
            (item) => item.list_id !== state.activeListId || !item.is_checked
          ),
        });
      },

      clearAll: () => {
        const state = get();
        set({
          items: state.items.filter((item) => item.list_id !== state.activeListId),
          selectedItems: [],
        });
      },

      checkAll: () => {
        const state = get();
        set({
          items: state.items.map((item) =>
            item.list_id === state.activeListId
              ? { ...item, is_checked: true }
              : item
          ),
        });
      },

      uncheckAll: () => {
        const state = get();
        set({
          items: state.items.map((item) =>
            item.list_id === state.activeListId
              ? { ...item, is_checked: false }
              : item
          ),
        });
      },

      deleteSelected: () => {
        const state = get();
        set({
          items: state.items.filter((item) => !state.selectedItems.includes(item.id)),
          selectedItems: [],
        });
      },

      toggleSelectItem: (id: string) => {
        set((state) => ({
          selectedItems: state.selectedItems.includes(id)
            ? state.selectedItems.filter((itemId) => itemId !== id)
            : [...state.selectedItems, id],
        }));
      },

      selectAll: () => {
        const state = get();
        const activeItems = state.items
          .filter((item) => item.list_id === state.activeListId)
          .map((item) => item.id);
        set({ selectedItems: activeItems });
      },

      clearSelection: () => {
        set({ selectedItems: [] });
      },

      // ============================================
      // UI ACTIONS
      // ============================================

      setSortBy: (sort: SortOption) => {
        set({ sortBy: sort });
      },

      setFilterBy: (filter: FilterOption) => {
        set({ filterBy: filter });
      },

      setSearchQuery: (query: string) => {
        set({ searchQuery: query });
      },

      // ============================================
      // COMPUTED VALUES
      // ============================================

      getFilteredItems: () => {
        const state = get();
        let items = state.items.filter((item) => item.list_id === state.activeListId);

        // Apply search filter
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase();
          items = items.filter(
            (item) =>
              item.name.toLowerCase().includes(query) ||
              item.recipe_name?.toLowerCase().includes(query) ||
              item.notes?.toLowerCase().includes(query)
          );
        }

        // Apply status filter
        switch (state.filterBy) {
          case 'checked':
            items = items.filter((item) => item.is_checked);
            break;
          case 'unchecked':
            items = items.filter((item) => !item.is_checked);
            break;
          case 'urgent':
            items = items.filter((item) => item.is_urgent);
            break;
        }

        // Apply sorting
        switch (state.sortBy) {
          case 'name':
            items.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'checked':
            items.sort((a, b) => Number(a.is_checked) - Number(b.is_checked));
            break;
          case 'recent':
            items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            break;
          case 'recipe':
            items.sort((a, b) => (a.recipe_name || 'zzz').localeCompare(b.recipe_name || 'zzz'));
            break;
          case 'category':
          default:
            items.sort((a, b) => a.category.localeCompare(b.category));
            break;
        }

        // Always put urgent items first and checked items last
        items.sort((a, b) => {
          if (a.is_urgent && !b.is_urgent) return -1;
          if (!a.is_urgent && b.is_urgent) return 1;
          if (a.is_checked && !b.is_checked) return 1;
          if (!a.is_checked && b.is_checked) return -1;
          return 0;
        });

        return items;
      },

      getGroupedItems: () => {
        const state = get();
        const items = state.getFilteredItems();

        const CATEGORY_LABELS: Record<string, string> = {
          produce: 'Produce',
          meat: 'Meat & Seafood',
          dairy: 'Dairy & Eggs',
          pantry: 'Pantry',
          spices: 'Spices & Seasonings',
          frozen: 'Frozen',
          beverage: 'Beverages',
          condiment: 'Condiments',
          other: 'Other',
        };

        const grouped = items.reduce((acc: Record<string, ShoppingItem[]>, item) => {
          const category = item.category || 'other';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(item);
          return acc;
        }, {});

        return Object.keys(grouped)
          .sort()
          .map((category) => ({
            title: CATEGORY_LABELS[category] || category,
            icon: CATEGORY_ICONS[category] || 'ellipsis-horizontal',
            data: grouped[category],
          }));
      },

      getProgress: () => {
        const state = get();
        const activeItems = state.items.filter((item) => item.list_id === state.activeListId);
        const checked = activeItems.filter((item) => item.is_checked).length;
        const total = activeItems.length;
        const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;

        return { checked, total, percentage };
      },

      getTotalPrice: () => {
        const state = get();
        return state.items
          .filter((item) => item.list_id === state.activeListId && !item.is_checked)
          .reduce((sum, item) => sum + (item.price || 0), 0);
      },

      getItemsByRecipe: () => {
        const state = get();
        const items = state.items.filter((item) => item.list_id === state.activeListId);

        return items.reduce((acc: Record<string, ShoppingItem[]>, item) => {
          const recipe = item.recipe_name || 'Manual Items';
          if (!acc[recipe]) {
            acc[recipe] = [];
          }
          acc[recipe].push(item);
          return acc;
        }, {});
      },

      resetStore: () => {
        // Clear persisted storage
        AsyncStorage.removeItem('shopping-storage-v2');
        set({
          items: [],
          lists: [
            {
              id: 'default',
              name: 'My Shopping List',
              color: '#F2330D',
              icon: 'cart',
              is_default: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          activeListId: 'default',
          sortBy: 'category',
          filterBy: 'all',
          searchQuery: '',
          isLoading: false,
          selectedItems: [],
        });
      },
    }),
    {
      name: 'shopping-storage-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        lists: state.lists,
        activeListId: state.activeListId,
        sortBy: state.sortBy,
      }),
    }
  )
);
