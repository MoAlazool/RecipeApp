// ============================================
// PANTRY SERVICE - Manage User's Fridge Items
// ============================================

import { firebaseService } from './firebase.service';
import type { DetectedIngredient } from '@/utils/types';

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity_estimate: string;
  confidence: 'high' | 'medium' | 'low';
  added_at: string;
  expires_at?: string;
  is_available: boolean; // false if user marks as used
}

export interface UserPantry {
  id: string;
  user_id: string;
  items: PantryItem[];
  last_scan_at: string;
  updated_at: string;
}

class PantryService {
  // ============================================
  // SAVE FRIDGE SCAN ITEMS
  // ============================================
  async saveFridgeItems(
    detectedIngredients: DetectedIngredient[],
    scanImageUrl?: string
  ): Promise<UserPantry> {
    try {
      const session = await firebaseService.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const now = new Date().toISOString();

      // Get existing pantry or create new one
      let pantry = await this.getPantry();

      // Convert detected ingredients to pantry items
      const newItems: PantryItem[] = detectedIngredients.map((ingredient, index) => ({
        id: `${Date.now()}-${index}`,
        name: ingredient.name,
        category: ingredient.category,
        quantity_estimate: ingredient.quantity_estimate || 'some',
        confidence: ingredient.confidence,
        added_at: now,
        is_available: true,
      }));

      if (pantry) {
        // Update existing pantry - merge new items
        // Remove duplicates and update quantities
        const existingNames = new Set(pantry.items.map(item => item.name.toLowerCase()));
        const itemsToAdd = newItems.filter(item => !existingNames.has(item.name.toLowerCase()));

        pantry.items = [...pantry.items, ...itemsToAdd];
        pantry.last_scan_at = now;
        pantry.updated_at = now;

        await firebaseService.updateUserPantry(pantry);
      } else {
        // Create new pantry
        pantry = await firebaseService.createUserPantry({
          user_id: session.user.id,
          items: newItems,
          last_scan_at: now,
          updated_at: now,
        });
        if (!pantry) {
          throw new Error('Failed to create pantry');
        }
      }

      // Upload scan image to Firebase Storage if provided
      let uploadedImageUrl: string | undefined;
      if (scanImageUrl && !scanImageUrl.startsWith('http')) {
        // It's a local file URI, upload it to Firebase Storage
        try {
          uploadedImageUrl = await firebaseService.uploadFridgeScanImage(scanImageUrl);
        } catch (uploadError) {
          console.warn('Failed to upload scan image, saving without image:', uploadError);
        }
      } else {
        uploadedImageUrl = scanImageUrl;
      }

      // Also save the scan record for history
      await firebaseService.saveFridgeScan({
        image_url: uploadedImageUrl,
        ingredients: detectedIngredients,
        total_items: detectedIngredients.length,
      });

      return pantry;
    } catch (error) {
      console.error('Failed to save fridge items:', error);
      throw error;
    }
  }

  // ============================================
  // GET USER'S PANTRY
  // ============================================
  async getPantry(): Promise<UserPantry | null> {
    try {
      const session = await firebaseService.getSession();
      if (!session?.user) return null;

      return await firebaseService.getUserPantry(session.user.id);
    } catch (error) {
      console.error('Failed to get pantry:', error);
      return null;
    }
  }

  // ============================================
  // UPDATE PANTRY ITEM
  // ============================================
  async updateItem(itemId: string, updates: Partial<PantryItem>): Promise<void> {
    try {
      const pantry = await this.getPantry();
      if (!pantry) throw new Error('Pantry not found');

      pantry.items = pantry.items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      );
      pantry.updated_at = new Date().toISOString();

      await firebaseService.updateUserPantry(pantry);
    } catch (error) {
      console.error('Failed to update item:', error);
      throw error;
    }
  }

  // ============================================
  // MARK ITEM AS USED
  // ============================================
  async markItemAsUsed(itemId: string): Promise<void> {
    await this.updateItem(itemId, { is_available: false });
  }

  // ============================================
  // REMOVE ITEM
  // ============================================
  async removeItem(itemId: string): Promise<void> {
    try {
      const pantry = await this.getPantry();
      if (!pantry) throw new Error('Pantry not found');

      pantry.items = pantry.items.filter(item => item.id !== itemId);
      pantry.updated_at = new Date().toISOString();

      await firebaseService.updateUserPantry(pantry);
    } catch (error) {
      console.error('Failed to remove item:', error);
      throw error;
    }
  }

  // ============================================
  // ADD MANUAL ITEM
  // ============================================
  async addItem(name: string, category: string, quantity?: string): Promise<void> {
    try {
      const pantry = await this.getPantry();
      const now = new Date().toISOString();

      const newItem: PantryItem = {
        id: `${Date.now()}`,
        name,
        category,
        quantity_estimate: quantity || 'some',
        confidence: 'high',
        added_at: now,
        is_available: true,
      };

      if (pantry) {
        pantry.items.push(newItem);
        pantry.updated_at = now;
        await firebaseService.updateUserPantry(pantry);
      } else {
        const session = await firebaseService.getSession();
        if (!session?.user) throw new Error('Not authenticated');

        await firebaseService.createUserPantry({
          user_id: session.user.id,
          items: [newItem],
          last_scan_at: now,
          updated_at: now,
        });
      }
    } catch (error) {
      console.error('Failed to add item:', error);
      throw error;
    }
  }

  // ============================================
  // GET AVAILABLE INGREDIENTS FOR AI
  // ============================================
  async getAvailableIngredients(): Promise<string[]> {
    const pantry = await this.getPantry();
    if (!pantry) return [];

    return pantry.items
      .filter(item => item.is_available)
      .map(item => item.name);
  }

  // ============================================
  // CLEAR ALL ITEMS
  // ============================================
  async clearPantry(): Promise<void> {
    try {
      const pantry = await this.getPantry();
      if (!pantry) return;

      pantry.items = [];
      pantry.updated_at = new Date().toISOString();

      await firebaseService.updateUserPantry(pantry);
    } catch (error) {
      console.error('Failed to clear pantry:', error);
      throw error;
    }
  }
}

export const pantryService = new PantryService();
export default PantryService;
