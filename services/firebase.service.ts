import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  OAuthProvider,
  GoogleAuthProvider,
  signInWithCredential,
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
  QueryDocumentSnapshot,
  arrayUnion,
  arrayRemove,
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
import * as AppleAuthentication from 'expo-apple-authentication';
import { FREE_PLAN_LIMITS, type Recipe, type User, type ShoppingList, type ShoppingItem, type FridgeScan, type DetectedIngredient, type Cookbook } from '@/utils/types';

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

  private removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
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
      'auth/account-exists-with-different-credential': 'An account already exists with this email using another sign in method',
      'auth/missing-or-invalid-nonce': 'Apple Sign In failed due to a nonce mismatch. Please retry. If it continues, reinstall the latest build with Sign In with Apple enabled.',
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

  async signInWithApple() {
    try {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Sign In is not available on this device');
      }

      // Generate nonce — use fallback if Crypto.randomUUID is unavailable
      let rawNonce: string;
      try {
        rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
      } catch {
        const chars = 'abcdef0123456789';
        rawNonce = Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      }

      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      let appleCredential;
      let credentialRawNonce: string | undefined = rawNonce;
      try {
        appleCredential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });
      } catch (appleError: any) {
        const appleErrorCode = String(appleError?.code || '');
        const appleErrorMessage = String(appleError?.message || '');

        // Handle Apple-specific errors before they reach Firebase handler
        if (appleErrorCode === 'ERR_REQUEST_CANCELED' || appleErrorCode === 'ERR_CANCELED') {
          const canceledError = new Error('Apple sign in cancelled');
          (canceledError as any).code = 'ERR_REQUEST_CANCELED';
          (canceledError as any).nativeCode = appleErrorCode;
          (canceledError as any).nativeMessage = appleErrorMessage;
          throw canceledError;
        }

        const normalizedAppleMessage = appleErrorMessage.toLowerCase();
        if (
          appleErrorCode === 'ERR_REQUEST_FAILED' ||
          appleErrorCode === 'ERR_REQUEST_UNKNOWN' ||
          normalizedAppleMessage.includes('authorization attempt failed')
        ) {
          // Fallback: retry without nonce to handle edge cases in dev/TestFlight builds.
          try {
            appleCredential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            credentialRawNonce = undefined;
          } catch (fallbackError: any) {
            const fallbackCode = String(fallbackError?.code || '');
            const fallbackMessage = String(fallbackError?.message || '');
            const requestFailedError = new Error(
              `Apple Sign In failed. Confirm you are signed into your Apple ID in iOS Settings, and that this build has Sign In with Apple capability/provisioning configured. Then try again. Native error: ${fallbackCode || 'UNKNOWN'} ${fallbackMessage}`.trim()
            );
            (requestFailedError as any).code = appleErrorCode || 'ERR_REQUEST_FAILED';
            (requestFailedError as any).nativeCode = fallbackCode || appleErrorCode;
            (requestFailedError as any).nativeMessage = fallbackMessage || appleErrorMessage;
            throw requestFailedError;
          }
          // Retry succeeded — fall through out of catch to continue with Firebase credential creation
        } else if (appleErrorCode || appleErrorMessage) {
          const requestError = new Error(
            `Apple Sign In failed (${appleErrorCode || 'UNKNOWN'}). ${appleErrorMessage || 'Please try again.'}`
          );
          (requestError as any).code = appleErrorCode || 'ERR_APPLE_AUTH';
          (requestError as any).nativeCode = appleErrorCode;
          (requestError as any).nativeMessage = appleErrorMessage;
          throw requestError;
        } else {
          throw appleError;
        }
      }

      if (!appleCredential.identityToken) {
        throw new Error('Apple Sign In failed. Missing identity token.');
      }

      const provider = new OAuthProvider('apple.com');
      const credentialPayload: { idToken: string; rawNonce?: string } = {
        idToken: appleCredential.identityToken,
      };
      if (credentialRawNonce) {
        credentialPayload.rawNonce = credentialRawNonce;
      }
      const firebaseCredential = provider.credential(credentialPayload);

      const userCredential = await signInWithCredential(this.auth, firebaseCredential);
      const displayName = [
        appleCredential.fullName?.givenName,
        appleCredential.fullName?.middleName,
        appleCredential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      return {
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email || appleCredential.email || '',
          user_metadata: {
            full_name: displayName || userCredential.user.displayName || undefined,
            name: displayName || userCredential.user.displayName || undefined,
            apple_user: appleCredential.user,
          }
        }
      };
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        throw error;
      }

      if (typeof error?.code === 'string' && error.code.startsWith('ERR_')) {
        throw error;
      }

      this.handleFirebaseError(error);
    }
  }

  async signInWithGoogle() {
    try {
      const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      if (!googleClientId) {
        throw new Error('Google iOS Client ID not configured. Please add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to .env');
      }

      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
      };

      // Reversed client ID as redirect scheme (standard for iOS OAuth)
      const clientIdPrefix = googleClientId.split('.apps.googleusercontent.com')[0];
      const reversedClientId = `com.googleusercontent.apps.${clientIdPrefix}`;
      const redirectUri = `${reversedClientId}:/oauthredirect`;

      // Build auth request with PKCE (required for mobile OAuth)
      const request = new AuthSession.AuthRequest({
        clientId: googleClientId,
        redirectUri,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });

      const result = await request.promptAsync(discovery);

      if (result.type !== 'success') {
        throw new Error('Authentication cancelled');
      }

      const code = result.params.code;
      if (!code) {
        throw new Error('No authorization code received');
      }

      // Exchange code for tokens using PKCE code_verifier
      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: googleClientId,
          code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier!,
          },
        },
        discovery
      );

      if (!tokenResult.idToken) {
        throw new Error('No ID token received from Google');
      }

      // Sign in to Firebase with the Google ID token
      const credential = GoogleAuthProvider.credential(tokenResult.idToken);
      const userCredential = await signInWithCredential(this.auth, credential);

      // Prefer Firebase profile, then provider profile, then Google userinfo endpoint
      const googleProviderProfile = userCredential.user.providerData.find(
        (provider) => provider?.providerId === 'google.com'
      );
      let displayName =
        userCredential.user.displayName ||
        googleProviderProfile?.displayName ||
        '';
      let photoURL =
        userCredential.user.photoURL ||
        googleProviderProfile?.photoURL ||
        '';

      if ((!displayName || !photoURL) && tokenResult.accessToken) {
        try {
          const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
              Authorization: `Bearer ${tokenResult.accessToken}`,
            },
          });

          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            const googleName =
              typeof userInfo?.name === 'string' ? userInfo.name.trim() : '';
            const googlePhoto =
              typeof userInfo?.picture === 'string' ? userInfo.picture.trim() : '';

            if (!displayName && googleName) displayName = googleName;
            if (!photoURL && googlePhoto) photoURL = googlePhoto;
          }
        } catch (profileError) {
          console.warn('[Auth] Google userinfo fetch failed:', profileError);
        }
      }

      return {
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email || '',
          user_metadata: {
            full_name: displayName,
            name: displayName,
            avatar_url: photoURL,
          }
        }
      };
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        const canceledError = new Error('Google sign in cancelled');
        (canceledError as any).code = error.code;
        throw canceledError;
      }
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

      const defaultProfile: Partial<User> = this.removeUndefinedFields({
        ...profile,
        default_servings: profile.default_servings || 2,
        is_premium: profile.is_premium || false,
        weekly_recipe_count: profile.weekly_recipe_count || 0,
        weekly_scan_count: profile.weekly_scan_count || 0,
        week_reset_at: profile.week_reset_at || now,
        daily_ai_chat_count: profile.daily_ai_chat_count || 0,
        chat_reset_at: profile.chat_reset_at || now,
        created_at: profile.created_at || now,
        updated_at: now,
      });

      await setDoc(doc(this.db, 'users', userId), defaultProfile, { merge: true });

      return { id: userId, ...defaultProfile } as User;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async updateProfile(userId: string, updates: Partial<User>) {
    try {
      const docRef = doc(this.db, 'users', userId);
      const safeUpdates = this.removeUndefinedFields(updates);
      await updateDoc(docRef, {
        ...safeUpdates,
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

  async updateRecipeThumbnail(id: string, thumbnailUrl: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'recipes', id);
      await updateDoc(docRef, { thumbnail_url: thumbnailUrl, updated_at: new Date().toISOString() });
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
    canScan: boolean;
    canChat: boolean;
    canGenerateRecipe: boolean;
    canUseWeekPlanner: boolean;
    scansRemaining: number;
    chatsRemaining: number;
    recipesRemaining: number;
  }> {
    try {
      const session = await this.getSession();
      if (!session) {
        return { canScan: false, canChat: false, canGenerateRecipe: false, canUseWeekPlanner: false, scansRemaining: 0, chatsRemaining: 0, recipesRemaining: 0 };
      }

      const profile = await this.getProfile(session.user.id);
      if (profile?.is_premium) {
        return { canScan: true, canChat: true, canGenerateRecipe: true, canUseWeekPlanner: true, scansRemaining: 999, chatsRemaining: 999, recipesRemaining: 999 };
      }

      // Auto-reset: weekly counters after 7 days
      const now = new Date();
      const weekReset = profile?.week_reset_at ? new Date(profile.week_reset_at) : new Date(0);
      const daysSinceWeekReset = (now.getTime() - weekReset.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceWeekReset >= 7 && profile) {
        await this.updateProfile(session.user.id, {
          weekly_recipe_count: 0,
          weekly_scan_count: 0,
          daily_ai_chat_count: 0,
          chat_reset_at: now.toISOString(),
          week_reset_at: now.toISOString(),
        });
        if (profile) {
          profile.weekly_recipe_count = 0;
          profile.weekly_scan_count = 0;
          profile.daily_ai_chat_count = 0;
        }
      }

      const scansRemaining = Math.max(0, FREE_PLAN_LIMITS.scans_per_week - (profile?.weekly_scan_count || 0));
      const chatsRemaining = Math.max(0, FREE_PLAN_LIMITS.ai_chats_per_week - (profile?.daily_ai_chat_count || 0));
      const recipesRemaining = Math.max(0, FREE_PLAN_LIMITS.recipes_per_week - (profile?.weekly_recipe_count || 0));

      return {
        canScan: scansRemaining > 0,
        canChat: chatsRemaining > 0,
        canGenerateRecipe: recipesRemaining > 0,
        canUseWeekPlanner: false, // Week planner is Pro only
        scansRemaining,
        chatsRemaining,
        recipesRemaining,
      };
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async incrementUsage(type: 'recipe' | 'scan' | 'ai_chat'): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;

      const profile = await this.getProfile(session.user.id);
      if (!profile) return;

      let updates: Partial<User>;
      if (type === 'recipe') {
        updates = { weekly_recipe_count: (profile.weekly_recipe_count || 0) + 1 };
      } else if (type === 'scan') {
        updates = { weekly_scan_count: (profile.weekly_scan_count || 0) + 1 };
      } else {
        updates = { daily_ai_chat_count: (profile.daily_ai_chat_count || 0) + 1 };
      }

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
      const session = await this.getSession();
      if (!session?.user) return null;

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

  async updateFridgeScanIngredients(id: string, ingredients: any[]): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const docRef = doc(this.db, 'fridge_scans', id);
      await updateDoc(docRef, {
        ingredients,
        total_items: ingredients.length,
      });
    } catch (error) {
      this.handleFirebaseError(error);
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
  // COOKBOOKS
  // ============================================
  async getCookbooks(): Promise<Cookbook[]> {
    try {
      const session = await this.getSession();
      if (!session) return [];

      const cookbooksRef = collection(this.db, 'cookbooks');
      const q = query(
        cookbooksRef,
        where('user_id', '==', session.user.id),
        orderBy('created_at', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Cookbook));
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async createCookbook(data: { name: string; emoji?: string }): Promise<Cookbook> {
    try {
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const now = new Date().toISOString();
      const newCookbook = {
        user_id: session.user.id,
        name: data.name,
        emoji: data.emoji || '',
        recipe_ids: [],
        created_at: now,
        updated_at: now,
      };

      const docRef = await addDoc(collection(this.db, 'cookbooks'), newCookbook);
      return { id: docRef.id, ...newCookbook } as Cookbook;
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async updateCookbook(id: string, updates: Partial<Pick<Cookbook, 'name' | 'emoji'>>): Promise<void> {
    try {
      const docRef = doc(this.db, 'cookbooks', id);
      await updateDoc(docRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async deleteCookbook(id: string): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) throw new Error('Not authenticated');

      const docRef = doc(this.db, 'cookbooks', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;

      const data = docSnap.data();
      if (data.user_id !== session.user.id) {
        throw new Error('You can only delete your own cookbooks');
      }

      await deleteDoc(docRef);
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async addRecipeToCookbook(cookbookId: string, recipeId: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'cookbooks', cookbookId);
      await updateDoc(docRef, {
        recipe_ids: arrayUnion(recipeId),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.handleFirebaseError(error);
    }
  }

  async removeRecipeFromCookbook(cookbookId: string, recipeId: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'cookbooks', cookbookId);
      await updateDoc(docRef, {
        recipe_ids: arrayRemove(recipeId),
        updated_at: new Date().toISOString(),
      });
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
