import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import type { Persistence } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import {
  getStorage,
  FirebaseStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import type { Recipe, User, ShoppingList, ShoppingItem, FridgeScan, DetectedIngredient } from '@/utils/types';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

class FirebaseService {
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;
  private storage: FirebaseStorage;

  getApp(): FirebaseApp {
    return this.app;
  }

  constructor() {
    WebBrowser.maybeCompleteAuthSession();

    // Initialize Firebase
    this.app = initializeApp(firebaseConfig);

    // Initialize Auth with React Native persistence
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence?: (storage: typeof AsyncStorage) => Persistence;
    };
    const persistence = getReactNativePersistence
      ? getReactNativePersistence(AsyncStorage)
      : inMemoryPersistence;
    this.auth = initializeAuth(this.app, { persistence });

    // Initialize Firestore
    this.db = getFirestore(this.app);

    // Initialize Storage
    this.storage = getStorage(this.app);
  }

  // ============================================
  // ERROR HANDLING
  // ============================================
  private handleFirebaseError(error: any): never {
    const errorMessages: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already registered',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/invalid-email': 'Invalid email address',
      'auth/invalid-credential': 'Invalid email or password',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'permission-denied': 'Permission denied',
      'not-found': 'Document not found',
      'already-exists': 'Document already exists',
    };

    const code = error.code || '';
    const message = errorMessages[code] || error.message || 'An error occurred';

    const newError = new Error(message);
    (newError as any).code = code;
    throw newError;
  }

  // ============================================
  // AUTH
  // ============================================
  async getSession() {
    const user = this.auth.currentUser;
    if (!user) return null;

    return {
      user: {
        id: user.uid,
        email: user.email!,
        user_metadata: {
          full_name: user.displayName,
          name: user.displayName,
        }
      }
    };
  }

  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return {
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email!,
          user_metadata: {
            full_name: userCredential.user.displayName,
          }
        },
        session: {
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email!,
          }
        }
      };
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async signUp(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      return {
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email!,
          user_metadata: {}
        },
        session: {
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email!,
          }
        }
      };
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async signOut() {
    try {
      await firebaseSignOut(this.auth);
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async resetPassword(email: string) {
    try {
      // Firebase doesn't support custom redirect URLs in the same way
      // The user will receive a standard Firebase password reset email
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async signInWithGoogle() {
    try {
      const redirectTo = AuthSession.makeRedirectUri({
        scheme: 'recipeapp',
        path: 'auth/callback',
      });

      // Use Firebase's Google Sign-In with OAuth
      // For now, we'll throw a helpful error since full Google OAuth setup requires additional configuration
      const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
      if (!googleClientId) {
        throw new Error('Google Web Client ID not configured. Please add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env');
      }

      // Build Google OAuth URL
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: redirectTo,
        response_type: 'code',
        scope: 'openid email profile',
        state: Crypto.randomUUID(),
      })}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);

      if (result.type !== 'success' || !result.url) {
        throw new Error('Authentication cancelled');
      }

      // Extract the authorization code from the redirect URL
      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Exchange code for tokens with Google
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          redirect_uri: redirectTo,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const tokens = await tokenResponse.json();

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userInfo = await userInfoResponse.json();

      // Create or sign in user with Firebase using custom token
      // For simplicity, we'll create an account with email/password using a random password
      // In production, you'd want to use Firebase Admin SDK to create custom tokens

      // Try to sign in first
      try {
        const randomPassword = Crypto.randomUUID() + Crypto.randomUUID();
        const userCredential = await signInWithEmailAndPassword(this.auth, userInfo.email, randomPassword);

        // Update avatar if user has a Google picture
        if (userInfo.picture) {
          await this.updateProfile(userCredential.user.uid, {
            avatar_url: userInfo.picture,
          });
        }

        return {
          user: {
            id: userCredential.user.uid,
            email: userCredential.user.email!,
            user_metadata: {
              full_name: userInfo.name,
              name: userInfo.name,
              avatar_url: userInfo.picture,
            }
          }
        };
      } catch (signInError: any) {
        // If sign in fails, create a new account
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password') {
          const randomPassword = Crypto.randomUUID() + Crypto.randomUUID();
          const userCredential = await createUserWithEmailAndPassword(this.auth, userInfo.email, randomPassword);

          // Store the Google user info in the profile, including avatar
          await this.createProfile({
            id: userCredential.user.uid,
            email: userInfo.email,
            full_name: userInfo.name,
            avatar_url: userInfo.picture, // Save Google profile picture
          });

          return {
            user: {
              id: userCredential.user.uid,
              email: userCredential.user.email!,
              user_metadata: {
                full_name: userInfo.name,
                name: userInfo.name,
                avatar_url: userInfo.picture,
              }
            }
          };
        }
        throw signInError;
      }
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  // ============================================
  // PROFILES
  // ============================================
  async getProfile(userId: string): Promise<User | null> {
    try {
      const docRef = doc(this.db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() } as User;
    } catch (error: any) {
      if (error.code === 'not-found') {
        return null;
      }
      this.handleFirebaseError(error);
    }
  }

  async createProfile(profile: Partial<User>) {
    try {
      const now = new Date().toISOString();
      const userId = profile.id!;

      const defaultProfile: Partial<User> = {
        ...profile,
        default_servings: profile.default_servings || 2,
        is_premium: profile.is_premium || false,
        weekly_recipe_count: profile.weekly_recipe_count || 0,
        weekly_scan_count: profile.weekly_scan_count || 0,
        week_reset_at: profile.week_reset_at || now,
        created_at: profile.created_at || now,
        updated_at: now,
      };

      await setDoc(doc(this.db, 'users', userId), defaultProfile, { merge: true });

      return { id: userId, ...defaultProfile } as User;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async updateProfile(userId: string, updates: Partial<User>) {
    try {
      const docRef = doc(this.db, 'users', userId);
      await updateDoc(docRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      const updated = await getDoc(docRef);
      return { id: updated.id, ...updated.data() } as User;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  // ============================================
  // RECIPES
  // ============================================
  async getRecipes(): Promise<Recipe[]> {
    try {
      const session = await this.getSession();
      if (!session) return [];

      const recipesRef = collection(this.db, 'recipes');
      const q = query(
        recipesRef,
        where('user_id', '==', session.user.id),
        orderBy('created_at', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Recipe));
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async getRecipe(id: string): Promise<Recipe | null> {
    try {
      const docRef = doc(this.db, 'recipes', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() } as Recipe;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async createRecipe(recipe: Partial<Recipe>): Promise<Recipe> {
    try {
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      const newRecipe: Partial<Recipe> = {
        ...recipe,
        user_id: session.user.id,
        is_favorite: false,
        times_cooked: 0,
        created_at: now,
        updated_at: now,
      };

      const docRef = await addDoc(collection(this.db, 'recipes'), newRecipe);

      return { id: docRef.id, ...newRecipe } as Recipe;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async updateRecipe(id: string, updates: Partial<Recipe>): Promise<Recipe> {
    try {
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const docRef = doc(this.db, 'recipes', id);
      await updateDoc(docRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      const updated = await getDoc(docRef);
      return { id: updated.id, ...updated.data() } as Recipe;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async deleteRecipe(id: string): Promise<void> {
    try {
      console.log('[Firebase] Deleting recipe:', id);
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const docRef = doc(this.db, 'recipes', id);

      // Verify ownership before attempting delete to give clear error
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        console.warn('[Firebase] Recipe not found, may already be deleted:', id);
        return;
      }
      const data = docSnap.data();
      if (data.user_id !== session.user.id) {
        console.error('[Firebase] Ownership mismatch — doc user_id:', data.user_id, '| auth uid:', session.user.id);
        throw new Error('You can only delete your own recipes');
      }

      await deleteDoc(docRef);
      console.log('[Firebase] Recipe deleted successfully');
    } catch (error) {
      console.error('[Firebase] Delete recipe error:', error);
      this.handleFirebaseError(error);
    }
  }

  // ============================================
  // SHOPPING LISTS
  // ============================================
  async getShoppingList(): Promise<ShoppingList | null> {
    try {
      const session = await this.getSession();
      if (!session) return null;

      const listsRef = collection(this.db, 'shopping_lists');
      const q = query(
        listsRef,
        where('user_id', '==', session.user.id),
        where('is_active', '==', true)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const listDoc = querySnapshot.docs[0];
      const listData = { id: listDoc.id, ...listDoc.data() } as ShoppingList;

      // Get items from subcollection
      const itemsRef = collection(this.db, 'shopping_lists', listDoc.id, 'items');
      const itemsSnapshot = await getDocs(itemsRef);

      listData.items = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ShoppingItem));

      return listData;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async addShoppingItem(item: Partial<ShoppingItem>): Promise<ShoppingItem> {
    try {
      const now = new Date().toISOString();
      const newItem: Partial<ShoppingItem> = {
        ...item,
        created_at: now,
        updated_at: now,
      };

      // If list_id exists, add to that list's items subcollection
      if (item.list_id) {
        const itemRef = doc(this.db, 'shopping_lists', item.list_id, 'items', item.id!);
        await setDoc(itemRef, newItem);
        return { id: item.id!, ...newItem } as ShoppingItem;
      }

      throw new Error('Shopping list ID is required');
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async updateShoppingItem(id: string, updates: Partial<ShoppingItem>): Promise<void> {
    try {
      // Find the item across all shopping lists
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const shoppingList = await this.getShoppingList();
      if (!shoppingList) throw new Error('Shopping list not found');

      const itemRef = doc(this.db, 'shopping_lists', shoppingList.id, 'items', id);
      await updateDoc(itemRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async deleteShoppingItem(id: string): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const shoppingList = await this.getShoppingList();
      if (!shoppingList) throw new Error('Shopping list not found');

      const itemRef = doc(this.db, 'shopping_lists', shoppingList.id, 'items', id);
      await deleteDoc(itemRef);
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  // ============================================
  // USAGE TRACKING (for free tier limits)
  // ============================================
  async checkUsageLimits(): Promise<{
    canExtractRecipe: boolean;
    canScanFridge: boolean;
    recipesRemaining: number;
    scansRemaining: number;
  }> {
    try {
      const session = await this.getSession();
      if (!session) {
        return {
          canExtractRecipe: false,
          canScanFridge: false,
          recipesRemaining: 0,
          scansRemaining: 0,
        };
      }

      const profile = await this.getProfile(session.user.id);
      if (profile?.is_premium) {
        return {
          canExtractRecipe: true,
          canScanFridge: true,
          recipesRemaining: 999,
          scansRemaining: 999,
        };
      }

      // Free tier limits
      const recipesRemaining = Math.max(0, 5 - (profile?.weekly_recipe_count || 0));
      const scansRemaining = Math.max(0, 1 - (profile?.weekly_scan_count || 0));

      return {
        canExtractRecipe: recipesRemaining > 0,
        canScanFridge: scansRemaining > 0,
        recipesRemaining,
        scansRemaining,
      };
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async incrementUsage(type: 'recipe' | 'scan'): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;

      const profile = await this.getProfile(session.user.id);
      if (!profile) return;

      const updates =
        type === 'recipe'
          ? { weekly_recipe_count: (profile.weekly_recipe_count || 0) + 1 }
          : { weekly_scan_count: (profile.weekly_scan_count || 0) + 1 };

      await this.updateProfile(session.user.id, updates);
    } catch (error) {
      console.error('Failed to increment usage:', error);
      // Don't throw - usage tracking shouldn't block operations
    }
  }

  // ============================================
  // FRIDGE SCANS
  // ============================================
  async saveFridgeScan(scan: {
    image_url?: string;
    ingredients: DetectedIngredient[];
    total_items: number;
    notes?: string;
  }): Promise<FridgeScan> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      const newScan = {
        ...scan,
        user_id: session.user.id,
        created_at: now,
      };

      const docRef = await addDoc(collection(this.db, 'fridge_scans'), newScan);

      return { id: docRef.id, ...newScan } as FridgeScan;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async getFridgeScans(limitCount = 10): Promise<FridgeScan[]> {
    try {
      console.log('[Firebase] Getting fridge scans, limit:', limitCount);
      const session = await this.getSession();
      if (!session?.user) {
        console.log('[Firebase] No session, returning empty array');
        return [];
      }

      const scansRef = collection(this.db, 'fridge_scans');
      const q = query(
        scansRef,
        where('user_id', '==', session.user.id),
        orderBy('created_at', 'desc'),
        firestoreLimit(limitCount)
      );

      console.log('[Firebase] Querying fridge_scans for user:', session.user.id);
      const querySnapshot = await getDocs(q);
      console.log('[Firebase] Found', querySnapshot.docs.length, 'scans');

      const scans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FridgeScan));

      return scans;
    } catch (error: any) {
      console.error('[Firebase] Error getting fridge scans:', error);
      console.error('[Firebase] Error code:', error?.code);
      console.error('[Firebase] Error message:', error?.message);
      return [];
    }
  }

  async getFridgeScan(id: string): Promise<FridgeScan | null> {
    try {
      console.log('[Firebase] Getting fridge scan:', id);
      const docRef = doc(this.db, 'fridge_scans', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.log('[Firebase] Scan not found:', id);
        return null;
      }

      const scan = { id: docSnap.id, ...docSnap.data() } as FridgeScan;
      console.log('[Firebase] Found scan:', scan.id, 'with', scan.total_items, 'items');
      return scan;
    } catch (error: any) {
      console.error('[Firebase] Error getting fridge scan:', error);
      console.error('[Firebase] Error code:', error?.code);
      console.error('[Firebase] Error message:', error?.message);
      return null;
    }
  }

  async deleteFridgeScan(id: string): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      // Verify ownership before deleting
      const docRef = doc(this.db, 'fridge_scans', id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return; // Already deleted
      }

      const scanData = docSnap.data();
      if (scanData.user_id !== session.user.id) {
        throw new Error('Permission denied');
      }

      await deleteDoc(docRef);
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  // ============================================
  // USER PANTRY (Saved Fridge Items)
  // ============================================
  async getUserPantry(userId: string): Promise<any | null> {
    try {
      const docRef = doc(this.db, 'user_pantry', userId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      return { id: docSnap.id, ...docSnap.data() };
    } catch (error: any) {
      if (error.code === 'not-found') {
        return null;
      }
      this.handleFirebaseError(error);
    }
  }

  async createUserPantry(pantry: any): Promise<any> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const docRef = doc(this.db, 'user_pantry', session.user.id);
      await setDoc(docRef, pantry);

      return { id: docRef.id, ...pantry };
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async updateUserPantry(pantry: any): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const docRef = doc(this.db, 'user_pantry', session.user.id);
      await setDoc(docRef, pantry, { merge: true });
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  // ============================================
  // FIREBASE STORAGE
  // ============================================

  /**
   * Upload a profile avatar image
   * @param userId - User ID
   * @param imageUri - Local image URI or base64 data
   * @returns Download URL of the uploaded image
   */
  async uploadAvatar(userId: string, imageUri: string): Promise<string> {
    try {
      const fileName = `avatars/${userId}/avatar_${Date.now()}.jpg`;
      const storageRef = ref(this.storage, fileName);

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload the blob
      await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);

      // Update user profile with new avatar URL
      await this.updateProfile(userId, { avatar_url: downloadUrl });

      return downloadUrl;
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      this.handleFirebaseError(error);
    }
  }

  /**
   * Upload a fridge scan photo
   * @param imageUri - Local image URI
   * @param scanId - Optional scan ID to associate with
   * @returns Download URL of the uploaded image
   */
  async uploadFridgeScanImage(imageUri: string, scanId?: string): Promise<string> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const fileName = `fridge_scans/${session.user.id}/${scanId || 'scan'}_${Date.now()}.jpg`;
      const storageRef = ref(this.storage, fileName);

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload the blob
      await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);

      return downloadUrl;
    } catch (error) {
      console.error('Failed to upload fridge scan image:', error);
      this.handleFirebaseError(error);
    }
  }

  /**
   * Upload a recipe thumbnail/image
   * @param imageUri - Local image URI
   * @param recipeId - Recipe ID to associate with
   * @returns Download URL of the uploaded image
   */
  async uploadRecipeImage(imageUri: string, recipeId: string): Promise<string> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const fileName = `recipes/${session.user.id}/${recipeId}_${Date.now()}.jpg`;
      const storageRef = ref(this.storage, fileName);

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload the blob
      await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
      });

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);

      return downloadUrl;
    } catch (error) {
      console.error('Failed to upload recipe image:', error);
      this.handleFirebaseError(error);
    }
  }

  /**
   * Upload an image from base64 data
   * @param base64Data - Base64 encoded image data (without data:image prefix)
   * @param path - Storage path (e.g., 'avatars/userId/avatar.jpg')
   * @param contentType - Image content type (default: 'image/jpeg')
   * @returns Download URL of the uploaded image
   */
  async uploadBase64Image(
    base64Data: string,
    path: string,
    contentType: string = 'image/jpeg'
  ): Promise<string> {
    try {
      const storageRef = ref(this.storage, path);

      // Write base64 to temp file, then fetch as blob (RN can't create blobs from ArrayBuffer)
      const tempPath = `${FileSystem.cacheDirectory}upload_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tempPath, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const response = await fetch(tempPath);
      const blob = await response.blob();
      await uploadBytes(storageRef, blob, { contentType });
      FileSystem.deleteAsync(tempPath, { idempotent: true });

      // Get download URL
      const downloadUrl = await getDownloadURL(storageRef);

      return downloadUrl;
    } catch (error) {
      console.error('Failed to upload base64 image:', error);
      this.handleFirebaseError(error);
    }
  }

  /**
   * Delete an image from storage
   * @param imageUrl - The full download URL or storage path of the image
   */
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // If it's a full URL, extract the path
      let storagePath = imageUrl;
      if (imageUrl.includes('firebasestorage.googleapis.com')) {
        // Extract path from URL
        const url = new URL(imageUrl);
        const pathMatch = url.pathname.match(/\/o\/(.+?)(\?|$)/);
        if (pathMatch) {
          storagePath = decodeURIComponent(pathMatch[1]);
        }
      }

      const storageRef = ref(this.storage, storagePath);
      await deleteObject(storageRef);
    } catch (error: any) {
      // Ignore 'object-not-found' errors
      if (error.code !== 'storage/object-not-found') {
        console.error('Failed to delete image:', error);
      }
    }
  }

  /**
   * Delete all images in a folder (e.g., when deleting a user's data)
   * @param folderPath - The storage folder path
   */
  async deleteFolder(folderPath: string): Promise<void> {
    try {
      const folderRef = ref(this.storage, folderPath);
      const listResult = await listAll(folderRef);

      // Delete all files in the folder
      const deletePromises = listResult.items.map((itemRef) =>
        deleteObject(itemRef).catch(() => {})
      );

      // Recursively delete subfolders
      const subfolderPromises = listResult.prefixes.map((prefixRef) =>
        this.deleteFolder(prefixRef.fullPath)
      );

      await Promise.all([...deletePromises, ...subfolderPromises]);
    } catch (error: any) {
      // Ignore errors for non-existent folders
      if (error.code !== 'storage/object-not-found') {
        console.error('Failed to delete folder:', error);
      }
    }
  }

  /**
   * Get a signed download URL for an image (useful for private images)
   * @param path - Storage path
   * @returns Download URL
   */
  async getImageUrl(path: string): Promise<string | null> {
    try {
      const storageRef = ref(this.storage, path);
      return await getDownloadURL(storageRef);
    } catch (error: any) {
      if (error.code === 'storage/object-not-found') {
        return null;
      }
      console.error('Failed to get image URL:', error);
      return null;
    }
  }
}

export const firebaseService = new FirebaseService();
export default FirebaseService;
