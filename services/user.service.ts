import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAt,
  endAt,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { UserProfile } from '@/utils/types';
import { firebaseService } from './firebase.service';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

class UserService {
  private db: Firestore;

  constructor() {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  private removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
  }

  // ============================================
  // ERROR HANDLING
  // ============================================
  private handleError(error: any): never {
    const errorMessages: Record<string, string> = {
      'permission-denied': 'You do not have permission to perform this action',
      'not-found': 'User not found',
      'already-exists': 'Already following this user',
    };

    const code = error.code || '';
    const message = errorMessages[code] || error.message || 'An error occurred';

    const newError = new Error(message);
    (newError as any).code = code;
    throw newError;
  }

  // ============================================
  // AUTH HELPERS
  // ============================================
  private getCurrentUserId(): string | null {
    const auth = getAuth();
    return auth.currentUser?.uid || null;
  }

  private requireAuth(): string {
    const userId = this.getCurrentUserId();
    if (!userId) {
      throw new Error('You must be signed in');
    }
    return userId;
  }

  // ============================================
  // USERNAME MANAGEMENT
  // ============================================

  /**
   * Validate username format
   * Rules: 3-20 chars, lowercase, alphanumeric + underscores, must start with letter
   */
  validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username) {
      return { valid: false, error: 'Username is required' };
    }

    const trimmed = username.toLowerCase().trim();

    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' };
    }

    if (trimmed.length > 20) {
      return { valid: false, error: 'Username must be 20 characters or less' };
    }

    if (!/^[a-z]/.test(trimmed)) {
      return { valid: false, error: 'Username must start with a letter' };
    }

    if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    // Reserved usernames
    const reserved = ['admin', 'support', 'help', 'system', 'recipe', 'recipeapp', 'official'];
    if (reserved.includes(trimmed)) {
      return { valid: false, error: 'This username is reserved' };
    }

    return { valid: true };
  }

  /**
   * Check if a username is available
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const validation = this.validateUsername(username);
      if (!validation.valid) return false;

      const normalizedUsername = username.toLowerCase().trim();

      // Check the usernames collection (document ID = username)
      // This collection has more permissive read rules
      const usernameDoc = doc(this.db, 'usernames', normalizedUsername);
      const snapshot = await getDoc(usernameDoc);

      return !snapshot.exists();
    } catch (error) {
      console.error('[UserService] isUsernameAvailable error:', error);
      return false;
    }
  }

  /**
   * Set username for current user
   */
  async setUsername(username: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      const validation = this.validateUsername(username);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const normalizedUsername = username.toLowerCase().trim();

      // Check availability
      const isAvailable = await this.isUsernameAvailable(normalizedUsername);
      if (!isAvailable) {
        throw new Error('This username is already taken');
      }

      // Get current user to check for existing username
      const userRef = doc(this.db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const currentUsername = userSnap.exists() ? userSnap.data()?.username : null;

      // If user already has a username, delete the old entry from usernames collection
      if (currentUsername && currentUsername !== normalizedUsername) {
        const oldUsernameRef = doc(this.db, 'usernames', currentUsername);
        await deleteDoc(oldUsernameRef);
      }

      // Reserve the new username in the usernames collection
      const usernameRef = doc(this.db, 'usernames', normalizedUsername);
      await setDoc(usernameRef, {
        user_id: userId,
        created_at: new Date().toISOString(),
      });

      // Update user document
      await updateDoc(userRef, {
        username: normalizedUsername,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<UserProfile | null> {
    try {
      const normalizedUsername = username.toLowerCase().trim().replace('@', '');
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where('username', '==', normalizedUsername));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        email: data.email || '',
        username: data.username,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        bio: data.bio,
        is_public: data.is_public ?? true,
        recipes_count: 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as UserProfile;
    } catch (error) {
      console.error('[UserService] getUserByUsername error:', error);
      return null;
    }
  }

  // ============================================
  // USER PROFILES
  // ============================================
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      if (!this.getCurrentUserId()) {
        return null;
      }

      const docRef = doc(this.db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Get recipes count
      const recipesRef = collection(this.db, 'recipes');
      const recipesQuery = query(recipesRef, where('user_id', '==', userId));
      const recipesSnap = await getDocs(recipesQuery);

      return {
        id: docSnap.id,
        email: data.email || '',
        username: data.username,
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        bio: data.bio,
        is_public: data.is_public ?? true,
        recipes_count: recipesSnap.size,
        is_online: data.is_online,
        last_seen_at: data.last_seen_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error: any) {
      // During sign-out and route transitions, auth can drop mid-request.
      // Treat permission-denied as "profile unavailable" instead of throwing.
      if (error?.code === 'permission-denied') {
        return null;
      }
      this.handleError(error);
    }
  }

  async searchUsers(searchQuery: string, limitCount = 20): Promise<UserProfile[]> {
    try {
      this.requireAuth();
      const currentUserId = this.getCurrentUserId();

      if (!searchQuery.trim()) {
        return [];
      }

      const normalizedQuery = searchQuery.toLowerCase().trim();
      const usersRef = collection(this.db, 'users');
      const results: Map<string, UserProfile> = new Map();

      const isUsernameSearch = normalizedQuery.startsWith('@');
      const cleanQuery = isUsernameSearch ? normalizedQuery.slice(1) : normalizedQuery;

      const docToProfile = (d: any): UserProfile => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email || '',
          username: data.username,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          bio: data.bio,
          is_public: data.is_public ?? true,
          recipes_count: 0,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } as UserProfile;
      };

      // Build all queries to run in parallel
      const queries: Promise<any>[] = [];

      // Username prefix search
      if (isUsernameSearch || /^[a-z0-9_]+$/.test(cleanQuery)) {
        queries.push(
          getDocs(query(
            usersRef,
            where('username', '>=', cleanQuery),
            where('username', '<=', cleanQuery + '\uf8ff'),
            firestoreLimit(limitCount)
          ))
        );
      }

      // Full name search — run multiple case variants in parallel
      if (!isUsernameSearch && cleanQuery.length > 0) {
        const capitalised = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);
        const variants = new Set([searchQuery.trim(), cleanQuery, capitalised]);

        for (const variant of variants) {
          queries.push(
            getDocs(query(
              usersRef,
              orderBy('full_name'),
              startAt(variant),
              endAt(variant + '\uf8ff'),
              firestoreLimit(limitCount)
            ))
          );
        }
      }

      // Execute all queries in parallel
      const snapshots = await Promise.all(queries);

      for (const snapshot of snapshots) {
        for (const d of snapshot.docs) {
          if (d.id !== currentUserId && !results.has(d.id)) {
            results.set(d.id, docToProfile(d));
          }
        }
      }

      return Array.from(results.values())
        .filter(u => u.is_public !== false)
        .slice(0, limitCount);
    } catch (error) {
      console.error('[UserService] Search error:', error);
      return [];
    }
  }

  // ============================================
  // ONLINE PRESENCE
  // ============================================
  async setOnlineStatus(isOnline: boolean): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      const userRef = doc(this.db, 'users', userId);
      await setDoc(
        userRef,
        {
          is_online: isOnline,
          last_seen_at: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[UserService] setOnlineStatus error:', error);
    }
  }

  // ============================================
  // BLOCK SYSTEM
  // ============================================
  private getBlockId(blockerId: string, blockedId: string): string {
    return `${blockerId}_${blockedId}`;
  }

  async blockUser(targetUserId: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      if (userId === targetUserId) {
        throw new Error('You cannot block yourself');
      }

      const blockId = this.getBlockId(userId, targetUserId);
      const blockRef = doc(this.db, 'blocks', blockId);

      const now = new Date().toISOString();
      await setDoc(blockRef, {
        blocker_id: userId,
        blocked_id: targetUserId,
        created_at: now,
      });

    } catch (error) {
      this.handleError(error);
    }
  }

  async unblockUser(targetUserId: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      const blockId = this.getBlockId(userId, targetUserId);
      const blockRef = doc(this.db, 'blocks', blockId);

      await deleteDoc(blockRef);
    } catch (error) {
      this.handleError(error);
    }
  }

  async isBlocked(targetUserId: string): Promise<boolean> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return false;

      const blockId = this.getBlockId(userId, targetUserId);
      const blockRef = doc(this.db, 'blocks', blockId);
      const blockSnap = await getDoc(blockRef);

      return blockSnap.exists();
    } catch (error) {
      console.error('[UserService] isBlocked error:', error);
      return false;
    }
  }

  async getBlockedUsers(limitCount = 50): Promise<UserProfile[]> {
    try {
      const userId = this.requireAuth();

      const blocksRef = collection(this.db, 'blocks');
      const q = query(
        blocksRef,
        where('blocker_id', '==', userId),
        orderBy('created_at', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const blockedIds = querySnapshot.docs.map(doc => doc.data().blocked_id);

      // Fetch user profiles
      const profiles = await Promise.all(
        blockedIds.map(id => this.getUserProfile(id))
      );

      return profiles.filter((p): p is UserProfile => p !== null);
    } catch (error) {
      console.error('[UserService] getBlockedUsers error:', error);
      return [];
    }
  }

  // ============================================
  // PROFILE UPDATE
  // ============================================
  async updateUserProfile(updates: {
    full_name?: string;
    bio?: string;
    avatar_url?: string;
    is_public?: boolean;
  }): Promise<void> {
    try {
      const userId = this.requireAuth();
      const userRef = doc(this.db, 'users', userId);
      const safeUpdates = this.removeUndefinedFields(updates);

      await updateDoc(userRef, {
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Upload a new avatar image and update the user profile
   * @param imageUri - Local image URI or file path
   * @returns The new avatar URL
   */
  async uploadAvatar(imageUri: string): Promise<string> {
    try {
      const userId = this.requireAuth();

      // Upload to Firebase Storage
      const avatarUrl = await firebaseService.uploadAvatar(userId, imageUri);

      return avatarUrl;
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      this.handleError(error);
    }
  }

  // ============================================
  // REPORT USER
  // ============================================
  async reportUser(targetUserId: string, reason: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      if (userId === targetUserId) {
        throw new Error('You cannot report yourself');
      }

      const reportId = `${userId}_${targetUserId}_${Date.now()}`;
      const reportRef = doc(this.db, 'reports', reportId);

      await setDoc(reportRef, {
        reporter_id: userId,
        reported_id: targetUserId,
        reason,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }
}

export const userService = new UserService();
export default UserService;
