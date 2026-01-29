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
import type { UserProfile, Follow } from '@/utils/types';
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
        followers_count: 0,
        following_count: 0,
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
      const docRef = doc(this.db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();

      // Get follower/following counts
      const [followersCount, followingCount] = await Promise.all([
        this.getFollowersCount(userId),
        this.getFollowingCount(userId),
      ]);

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
        followers_count: followersCount,
        following_count: followingCount,
        recipes_count: recipesSnap.size,
        is_online: data.is_online,
        last_seen_at: data.last_seen_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
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

      // Check if searching by username (starts with @)
      const isUsernameSearch = normalizedQuery.startsWith('@');
      const cleanQuery = isUsernameSearch ? normalizedQuery.slice(1) : normalizedQuery;

      // Search by username if query starts with @ or looks like a username
      if (isUsernameSearch || /^[a-z0-9_]+$/.test(cleanQuery)) {
        const usernameQuery = query(
          usersRef,
          where('username', '>=', cleanQuery),
          where('username', '<=', cleanQuery + '\uf8ff'),
          firestoreLimit(limitCount)
        );

        const usernameSnapshot = await getDocs(usernameQuery);
        usernameSnapshot.docs.forEach(doc => {
          if (doc.id !== currentUserId) {
            const data = doc.data();
            results.set(doc.id, {
              id: doc.id,
              email: data.email || '',
              username: data.username,
              full_name: data.full_name,
              avatar_url: data.avatar_url,
              bio: data.bio,
              is_public: data.is_public ?? true,
              followers_count: 0,
              following_count: 0,
              recipes_count: 0,
              created_at: data.created_at,
              updated_at: data.updated_at,
            } as UserProfile);
          }
        });
      }

      // Also search by full_name if not a pure username search
      if (!isUsernameSearch) {
        const nameQuery = query(
          usersRef,
          orderBy('full_name'),
          startAt(searchQuery),
          endAt(searchQuery + '\uf8ff'),
          firestoreLimit(limitCount)
        );

        const nameSnapshot = await getDocs(nameQuery);
        nameSnapshot.docs.forEach(doc => {
          if (doc.id !== currentUserId && !results.has(doc.id)) {
            const data = doc.data();
            results.set(doc.id, {
              id: doc.id,
              email: data.email || '',
              username: data.username,
              full_name: data.full_name,
              avatar_url: data.avatar_url,
              bio: data.bio,
              is_public: data.is_public ?? true,
              followers_count: 0,
              following_count: 0,
              recipes_count: 0,
              created_at: data.created_at,
              updated_at: data.updated_at,
            } as UserProfile);
          }
        });
      }

      return Array.from(results.values()).slice(0, limitCount);
    } catch (error) {
      console.error('[UserService] Search error:', error);
      return [];
    }
  }

  // ============================================
  // FOLLOW SYSTEM
  // ============================================
  private getFollowId(followerId: string, followingId: string): string {
    return `${followerId}_${followingId}`;
  }

  async followUser(targetUserId: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      if (userId === targetUserId) {
        throw new Error('You cannot follow yourself');
      }

      const followId = this.getFollowId(userId, targetUserId);
      const followRef = doc(this.db, 'follows', followId);

      // Check if already following
      const existingFollow = await getDoc(followRef);
      if (existingFollow.exists()) {
        throw new Error('Already following this user');
      }

      const now = new Date().toISOString();
      const followData: Omit<Follow, 'id'> = {
        follower_id: userId,
        following_id: targetUserId,
        created_at: now,
      };

      await setDoc(followRef, followData);
    } catch (error) {
      this.handleError(error);
    }
  }

  async unfollowUser(targetUserId: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      const followId = this.getFollowId(userId, targetUserId);
      const followRef = doc(this.db, 'follows', followId);

      await deleteDoc(followRef);
    } catch (error) {
      this.handleError(error);
    }
  }

  async isFollowing(targetUserId: string): Promise<boolean> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return false;

      const followId = this.getFollowId(userId, targetUserId);
      const followRef = doc(this.db, 'follows', followId);
      const followSnap = await getDoc(followRef);

      return followSnap.exists();
    } catch (error) {
      console.error('[UserService] isFollowing error:', error);
      return false;
    }
  }

  async getFollowers(userId: string, limitCount = 50): Promise<UserProfile[]> {
    try {
      const followsRef = collection(this.db, 'follows');
      const q = query(
        followsRef,
        where('following_id', '==', userId),
        orderBy('created_at', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const followerIds = querySnapshot.docs.map(doc => doc.data().follower_id);

      // Fetch user profiles
      const profiles = await Promise.all(
        followerIds.map(id => this.getUserProfile(id))
      );

      return profiles.filter((p): p is UserProfile => p !== null);
    } catch (error) {
      console.error('[UserService] getFollowers error:', error);
      return [];
    }
  }

  async getFollowing(userId: string, limitCount = 50): Promise<UserProfile[]> {
    try {
      const followsRef = collection(this.db, 'follows');
      const q = query(
        followsRef,
        where('follower_id', '==', userId),
        orderBy('created_at', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      const followingIds = querySnapshot.docs.map(doc => doc.data().following_id);

      // Fetch user profiles
      const profiles = await Promise.all(
        followingIds.map(id => this.getUserProfile(id))
      );

      return profiles.filter((p): p is UserProfile => p !== null);
    } catch (error) {
      console.error('[UserService] getFollowing error:', error);
      return [];
    }
  }

  private async getFollowersCount(userId: string): Promise<number> {
    try {
      const followsRef = collection(this.db, 'follows');
      const q = query(followsRef, where('following_id', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch {
      return 0;
    }
  }

  private async getFollowingCount(userId: string): Promise<number> {
    try {
      const followsRef = collection(this.db, 'follows');
      const q = query(followsRef, where('follower_id', '==', userId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch {
      return 0;
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

      // Also unfollow if following
      try {
        await this.unfollowUser(targetUserId);
      } catch {
        // Ignore if not following
      }
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

      await updateDoc(userRef, {
        ...updates,
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
