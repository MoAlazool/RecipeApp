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
  deleteField,
  writeBatch,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageType,
  SharedRecipeData,
  UserProfile,
} from '@/utils/types';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

class MessagingService {
  private db: Firestore;
  // Cache user profiles for faster loading (5 minute TTL)
  private profileCache: Map<string, { profile: { full_name?: string; username?: string; avatar_url?: string }; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Use existing Firebase app or initialize new one
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  // ============================================
  // ERROR HANDLING
  // ============================================
  private handleError(error: any): never {
    const errorMessages: Record<string, string> = {
      'permission-denied': 'You do not have permission to perform this action',
      'not-found': 'The requested resource was not found',
      'already-exists': 'This conversation already exists',
      'unauthenticated': 'You must be signed in to send messages',
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
      throw new Error('You must be signed in to use messaging');
    }
    return userId;
  }

  // ============================================
  // CONVERSATION ID HELPERS
  // ============================================
  /**
   * Generate a deterministic conversation ID from two user IDs
   * Always returns the same ID regardless of order
   */
  generateConversationId(userId1: string, userId2: string): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}`;
  }

  // ============================================
  // CONVERSATIONS
  // ============================================
  async getConversations(): Promise<Conversation[]> {
    try {
      const userId = this.requireAuth();

      const conversationsRef = collection(this.db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
        orderBy('last_message_at', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const conversations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Conversation));

      // Enrich participant details with user profiles if missing
      return this.enrichConversationsWithProfiles(conversations);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Enrich conversations with user profile data
   */
  private async enrichConversationsWithProfiles(conversations: Conversation[]): Promise<Conversation[]> {
    // Only fetch profiles for users missing avatar_url (use cache for speed)
    const userIdsNeedingProfiles = new Set<string>();

    for (const conv of conversations) {
      for (const participant of conv.participant_details) {
        // Fetch if missing name OR avatar
        if (!participant.full_name || !participant.avatar_url) {
          userIdsNeedingProfiles.add(participant.user_id);
        }
      }
    }

    if (userIdsNeedingProfiles.size === 0) {
      return conversations;
    }

    // Fetch profiles in parallel (uses cache internally)
    const profilePromises = Array.from(userIdsNeedingProfiles).map(async (userId) => {
      const profile = await this.getUserProfileData(userId);
      return { userId, profile };
    });

    const profiles = await Promise.all(profilePromises);
    const profileMap = new Map(profiles.map(p => [p.userId, p.profile]));

    // Enrich conversations
    return conversations.map(conv => ({
      ...conv,
      participant_details: conv.participant_details.map(participant => {
        const profile = profileMap.get(participant.user_id);
        if (profile) {
          return {
            ...participant,
            full_name: profile.full_name || participant.full_name,
            username: profile.username || participant.username,
            avatar_url: profile.avatar_url || participant.avatar_url,
          };
        }
        return participant;
      }),
    }));
  }

  subscribeToConversations(
    callback: (conversations: Conversation[]) => void
  ): Unsubscribe {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.warn('[Messaging] No user signed in, cannot subscribe to conversations');
      return () => {};
    }

    const conversationsRef = collection(this.db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('last_message_at', 'desc')
    );

    return onSnapshot(
      q,
      async (querySnapshot) => {
        const conversations = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Conversation));

        // Enrich with user profiles
        const enrichedConversations = await this.enrichConversationsWithProfiles(conversations);
        callback(enrichedConversations);
      },
      (error) => {
        console.error('[Messaging] Conversation subscription error:', error);
      }
    );
  }

  /**
   * Fetch user profile data for participant details (with caching)
   */
  private async getUserProfileData(userId: string): Promise<{
    full_name?: string;
    username?: string;
    avatar_url?: string;
  }> {
    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.profile;
    }

    try {
      const userRef = doc(this.db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const profile = {
          full_name: data.full_name,
          username: data.username,
          // Check both avatar_url and photoURL (Firebase Auth default field)
          avatar_url: data.avatar_url || data.photoURL,
        };
        // Cache the result
        this.profileCache.set(userId, { profile, timestamp: Date.now() });
        return profile;
      }
    } catch (error) {
      console.error('[Messaging] Error fetching user profile:', error);
    }
    return {};
  }

  /**
   * Clear profile cache (call when user updates their profile)
   */
  clearProfileCache(userId?: string) {
    if (userId) {
      this.profileCache.delete(userId);
    } else {
      this.profileCache.clear();
    }
  }

  async getOrCreateConversation(otherUserId: string): Promise<Conversation> {
    try {
      const userId = this.requireAuth();
      const conversationId = this.generateConversationId(userId, otherUserId);

      const conversationRef = doc(this.db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (conversationSnap.exists()) {
        return { id: conversationSnap.id, ...conversationSnap.data() } as Conversation;
      }

      // Fetch user profiles for both participants
      const [currentUserProfile, otherUserProfile] = await Promise.all([
        this.getUserProfileData(userId),
        this.getUserProfileData(otherUserId),
      ]);

      // Create new DM conversation
      const now = new Date().toISOString();

      // Build participant details without undefined values (Firestore doesn't allow undefined)
      const buildParticipant = (
        odentifierId: string,
        profile: { full_name?: string; username?: string; avatar_url?: string }
      ): ConversationParticipant => {
        const participant: ConversationParticipant = {
          user_id: odentifierId,
          unread_count: 0,
          role: 'member',
          joined_at: now,
        };
        if (profile.full_name) participant.full_name = profile.full_name;
        if (profile.username) participant.username = profile.username;
        if (profile.avatar_url) participant.avatar_url = profile.avatar_url;
        return participant;
      };

      const newConversation: Omit<Conversation, 'id'> = {
        participants: [userId, otherUserId],
        participant_details: [
          buildParticipant(userId, currentUserProfile),
          buildParticipant(otherUserId, otherUserProfile),
        ],
        is_group: false,
        created_at: now,
        updated_at: now,
      };

      await setDoc(conversationRef, newConversation);

      return { id: conversationId, ...newConversation };
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============================================
  // GROUP CONVERSATIONS
  // ============================================

  /**
   * Create a new group conversation
   */
  async createGroupConversation(
    name: string,
    memberIds: string[],
    description?: string,
    avatarUrl?: string
  ): Promise<Conversation> {
    try {
      console.log('[Messaging] Creating group conversation:', { name, memberIds, description });

      const userId = this.requireAuth();
      console.log('[Messaging] Current user ID:', userId);

      const now = new Date().toISOString();

      // Include creator in participants
      const allParticipants = [userId, ...memberIds.filter(id => id !== userId)];
      console.log('[Messaging] All participants:', allParticipants);

      if (allParticipants.length < 2) {
        throw new Error('A group must have at least 2 members');
      }

      if (allParticipants.length > 50) {
        throw new Error('A group cannot have more than 50 members');
      }

      // Fetch all user profiles
      console.log('[Messaging] Fetching user profiles...');
      const profilePromises = allParticipants.map(id => this.getUserProfileData(id));
      const profiles = await Promise.all(profilePromises);
      console.log('[Messaging] Profiles fetched:', profiles.length);

      const participantDetails: ConversationParticipant[] = allParticipants.map((id, index) => {
        const participant: ConversationParticipant = {
          user_id: id,
          unread_count: 0,
          role: id === userId ? 'admin' : 'member',
          joined_at: now,
        };
        // Only add optional fields if they have values (Firestore doesn't allow undefined)
        if (profiles[index].full_name) {
          participant.full_name = profiles[index].full_name;
        }
        if (profiles[index].username) {
          participant.username = profiles[index].username;
        }
        if (profiles[index].avatar_url) {
          participant.avatar_url = profiles[index].avatar_url;
        }
        return participant;
      });

      // Build group object, excluding undefined values (Firestore doesn't allow undefined)
      const newGroup: Omit<Conversation, 'id'> = {
        participants: allParticipants,
        participant_details: participantDetails,
        is_group: true,
        group_name: name,
        admin_ids: [userId],
        created_by: userId,
        created_at: now,
        updated_at: now,
      };

      // Only add optional fields if they have values
      if (description) {
        newGroup.group_description = description;
      }
      if (avatarUrl) {
        newGroup.group_avatar_url = avatarUrl;
      }

      console.log('[Messaging] Creating group document in Firestore...');
      const docRef = await addDoc(collection(this.db, 'conversations'), newGroup);
      console.log('[Messaging] Group created with ID:', docRef.id);

      // Send system message about group creation
      await this.sendSystemMessage(
        docRef.id,
        `Group "${name}" was created`
      );
      console.log('[Messaging] System message sent');

      return { id: docRef.id, ...newGroup };
    } catch (error: any) {
      console.error('[Messaging] Error creating group:', error);
      console.error('[Messaging] Error code:', error?.code);
      console.error('[Messaging] Error message:', error?.message);
      this.handleError(error);
    }
  }

  /**
   * Update group conversation info
   */
  async updateGroupInfo(
    conversationId: string,
    updates: {
      group_name?: string;
      group_description?: string;
      group_avatar_url?: string;
    }
  ): Promise<void> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation || !conversation.is_group) {
        throw new Error('Group not found');
      }

      // Check if user is admin
      if (!conversation.admin_ids?.includes(userId)) {
        throw new Error('Only admins can update group info');
      }

      // Build update object, filtering out undefined values (Firestore doesn't allow undefined)
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.group_name !== undefined) {
        updateData.group_name = updates.group_name;
      }
      if (updates.group_description !== undefined) {
        // Use empty string or the actual value, but never undefined
        updateData.group_description = updates.group_description || '';
      }
      if (updates.group_avatar_url !== undefined) {
        updateData.group_avatar_url = updates.group_avatar_url;
      }

      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, updateData);

      // Send system message about update
      if (updates.group_name) {
        await this.sendSystemMessage(
          conversationId,
          `Group name changed to "${updates.group_name}"`
        );
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Add members to a group
   */
  async addGroupMembers(conversationId: string, newMemberIds: string[]): Promise<void> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation || !conversation.is_group) {
        throw new Error('Group not found');
      }

      // Check if user is admin or member
      if (!conversation.participants.includes(userId)) {
        throw new Error('You are not a member of this group');
      }

      const now = new Date().toISOString();

      // Filter out existing members
      const actualNewMembers = newMemberIds.filter(
        id => !conversation.participants.includes(id)
      );

      if (actualNewMembers.length === 0) {
        return; // No new members to add
      }

      if (conversation.participants.length + actualNewMembers.length > 50) {
        throw new Error('A group cannot have more than 50 members');
      }

      // Fetch profiles for new members
      const profilePromises = actualNewMembers.map(id => this.getUserProfileData(id));
      const profiles = await Promise.all(profilePromises);

      // Build participant details without undefined values
      const newParticipantDetails: ConversationParticipant[] = actualNewMembers.map((id, index) => {
        const participant: ConversationParticipant = {
          user_id: id,
          unread_count: 0,
          role: 'member',
          joined_at: now,
        };
        if (profiles[index].full_name) participant.full_name = profiles[index].full_name;
        if (profiles[index].username) participant.username = profiles[index].username;
        if (profiles[index].avatar_url) participant.avatar_url = profiles[index].avatar_url;
        return participant;
      });

      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        participants: arrayUnion(...actualNewMembers),
        participant_details: [...conversation.participant_details, ...newParticipantDetails],
        updated_at: now,
      });

      // Send system message
      await this.sendSystemMessage(
        conversationId,
        `${actualNewMembers.length} member(s) were added to the group`
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Remove a member from a group
   */
  async removeGroupMember(conversationId: string, memberIdToRemove: string): Promise<void> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation || !conversation.is_group) {
        throw new Error('Group not found');
      }

      // Check if user is admin or removing themselves
      const isAdmin = conversation.admin_ids?.includes(userId);
      const isRemovingSelf = memberIdToRemove === userId;

      if (!isAdmin && !isRemovingSelf) {
        throw new Error('Only admins can remove other members');
      }

      // Can't remove the last admin unless they're leaving
      if (conversation.admin_ids?.includes(memberIdToRemove) && conversation.admin_ids.length === 1 && !isRemovingSelf) {
        throw new Error('Cannot remove the only admin');
      }

      const updatedParticipants = conversation.participants.filter(id => id !== memberIdToRemove);
      const updatedParticipantDetails = conversation.participant_details.filter(
        p => p.user_id !== memberIdToRemove
      );
      const updatedAdminIds = conversation.admin_ids?.filter(id => id !== memberIdToRemove) || [];

      // If no members left, delete the group entirely
      if (updatedParticipants.length === 0) {
        await this.deleteConversation(conversationId);
        return;
      }

      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        participants: updatedParticipants,
        participant_details: updatedParticipantDetails,
        admin_ids: updatedAdminIds,
        updated_at: new Date().toISOString(),
      });

      // Send system message
      const action = isRemovingSelf ? 'left the group' : 'was removed from the group';
      await this.sendSystemMessage(conversationId, `A member ${action}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Make a member an admin
   */
  async makeGroupAdmin(conversationId: string, memberId: string): Promise<void> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation || !conversation.is_group) {
        throw new Error('Group not found');
      }

      if (!conversation.admin_ids?.includes(userId)) {
        throw new Error('Only admins can promote other members');
      }

      if (!conversation.participants.includes(memberId)) {
        throw new Error('User is not a member of this group');
      }

      if (conversation.admin_ids.includes(memberId)) {
        return; // Already an admin
      }

      const updatedParticipantDetails = conversation.participant_details.map(p => {
        if (p.user_id === memberId) {
          return { ...p, role: 'admin' as const };
        }
        return p;
      });

      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        admin_ids: arrayUnion(memberId),
        participant_details: updatedParticipantDetails,
        updated_at: new Date().toISOString(),
      });

      await this.sendSystemMessage(conversationId, 'A member was made an admin');
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Leave a group
   */
  async leaveGroup(conversationId: string): Promise<void> {
    const userId = this.requireAuth();
    await this.removeGroupMember(conversationId, userId);
  }

  /**
   * Send a system message (for group events)
   */
  private async sendSystemMessage(conversationId: string, content: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');

      await addDoc(messagesRef, {
        conversation_id: conversationId,
        sender_id: 'system',
        content,
        message_type: 'system',
        read_by: [],
        created_at: now,
        updated_at: now,
      });

      // Update conversation last message
      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        last_message: content,
        last_message_at: now,
        last_message_sender_id: 'system',
        updated_at: now,
      });
    } catch (error) {
      console.error('[Messaging] Error sending system message:', error);
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    try {
      this.requireAuth();

      const conversationRef = doc(this.db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        return null;
      }

      return { id: conversationSnap.id, ...conversationSnap.data() } as Conversation;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Check if user is a participant
      if (!conversation.participants.includes(userId)) {
        throw new Error('You are not a member of this conversation');
      }

      // For groups, only admins can delete
      if (conversation.is_group && !conversation.admin_ids?.includes(userId)) {
        throw new Error('Only admins can delete group conversations');
      }

      // Delete all messages in the conversation (batch delete)
      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);

      // Delete in batches of 500 (Firestore limit)
      const batchSize = 500;
      let batch = writeBatch(this.db);
      let operationCount = 0;

      for (const messageDoc of messagesSnapshot.docs) {
        batch.delete(messageDoc.ref);
        operationCount++;

        if (operationCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(this.db);
          operationCount = 0;
        }
      }

      // Commit remaining deletes
      if (operationCount > 0) {
        await batch.commit();
      }

      // Delete the conversation document
      const conversationRef = doc(this.db, 'conversations', conversationId);
      await deleteDoc(conversationRef);

      console.log('[Messaging] Conversation deleted:', conversationId);
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============================================
  // MESSAGES
  // ============================================
  async getMessages(conversationId: string, limitCount = 50): Promise<Message[]> {
    try {
      this.requireAuth();

      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        orderBy('created_at', 'desc'),
        firestoreLimit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Message))
        .reverse(); // Reverse to show oldest first
    } catch (error) {
      this.handleError(error);
    }
  }

  subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): Unsubscribe {
    const userId = this.getCurrentUserId();
    if (!userId) {
      console.warn('[Messaging] No user signed in, cannot subscribe to messages');
      return () => {};
    }

    const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      orderBy('created_at', 'asc')
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const messages = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Message));
        callback(messages);
      },
      (error) => {
        console.error('[Messaging] Messages subscription error:', error);
      }
    );
  }

  async sendMessage(
    recipientId: string,
    content: string,
    messageType: MessageType = 'text',
    recipeData?: SharedRecipeData
  ): Promise<Message> {
    try {
      const userId = this.requireAuth();
      const conversationId = this.generateConversationId(userId, recipientId);

      // Ensure conversation exists
      await this.getOrCreateConversation(recipientId);

      const now = new Date().toISOString();
      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');

      const newMessage: Omit<Message, 'id'> = {
        conversation_id: conversationId,
        sender_id: userId,
        content,
        message_type: messageType,
        read_by: [userId],
        created_at: now,
        updated_at: now,
      };

      if (recipeData) {
        newMessage.recipe_id = recipeData.id;
        newMessage.recipe_data = recipeData;
      }

      const docRef = await addDoc(messagesRef, newMessage);

      // Update conversation with last message
      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        last_message: messageType === 'recipe' ? `Shared a recipe: ${recipeData?.title}` : content,
        last_message_at: now,
        last_message_sender_id: userId,
        updated_at: now,
        // Increment unread count for recipient
        [`participant_details`]: await this.updateUnreadCount(conversationId, recipientId, 1),
      });

      return { id: docRef.id, ...newMessage };
    } catch (error) {
      this.handleError(error);
    }
  }

  async sendRecipeMessage(
    recipientId: string,
    recipeData: SharedRecipeData,
    message?: string
  ): Promise<Message> {
    const content = message || `Check out this recipe: ${recipeData.title}`;
    return this.sendMessage(recipientId, content, 'recipe', recipeData);
  }

  /**
   * Send a message to a conversation (works for both DM and group)
   */
  async sendMessageToConversation(
    conversationId: string,
    content: string,
    messageType: MessageType = 'text',
    recipeData?: SharedRecipeData
  ): Promise<Message> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Check if user is a participant
      if (!conversation.participants.includes(userId)) {
        throw new Error('You are not a member of this conversation');
      }

      const now = new Date().toISOString();
      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');

      const newMessage: Omit<Message, 'id'> = {
        conversation_id: conversationId,
        sender_id: userId,
        content,
        message_type: messageType,
        read_by: [userId],
        created_at: now,
        updated_at: now,
      };

      if (recipeData) {
        newMessage.recipe_id = recipeData.id;
        newMessage.recipe_data = recipeData;
      }

      const docRef = await addDoc(messagesRef, newMessage);

      // Update unread count for all other participants
      const updatedParticipantDetails = conversation.participant_details.map(p => {
        if (p.user_id !== userId) {
          return { ...p, unread_count: p.unread_count + 1 };
        }
        return p;
      });

      // Update conversation with last message
      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        last_message: messageType === 'recipe' ? `Shared a recipe: ${recipeData?.title}` : content,
        last_message_at: now,
        last_message_sender_id: userId,
        participant_details: updatedParticipantDetails,
        updated_at: now,
      });

      return { id: docRef.id, ...newMessage };
    } catch (error) {
      this.handleError(error);
    }
  }

  private async updateUnreadCount(
    conversationId: string,
    recipientId: string,
    increment: number
  ): Promise<ConversationParticipant[]> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return [];

    return conversation.participant_details.map(p => {
      if (p.user_id === recipientId) {
        return { ...p, unread_count: p.unread_count + increment };
      }
      return p;
    });
  }

  /**
   * Delete a message (only the sender can delete their own messages)
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      const userId = this.requireAuth();

      // Get the message to verify ownership
      const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);

      if (!messageSnap.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageSnap.data() as Message;

      // Only the sender can delete their own message
      if (messageData.sender_id !== userId) {
        throw new Error('You can only delete your own messages');
      }

      // Delete the message
      await deleteDoc(messageRef);

      // If this was the last message, update conversation's last_message
      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');
      const q = query(messagesRef, orderBy('created_at', 'desc'), firestoreLimit(1));
      const latestMessageSnap = await getDocs(q);

      const conversationRef = doc(this.db, 'conversations', conversationId);

      if (latestMessageSnap.empty) {
        // No more messages, clear last_message
        await updateDoc(conversationRef, {
          last_message: null,
          last_message_at: null,
          last_message_sender_id: null,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Update to the new last message
        const latestMessage = latestMessageSnap.docs[0].data() as Message;
        await updateDoc(conversationRef, {
          last_message: latestMessage.message_type === 'recipe'
            ? `Shared a recipe: ${latestMessage.recipe_data?.title}`
            : latestMessage.content,
          last_message_at: latestMessage.created_at,
          last_message_sender_id: latestMessage.sender_id,
          updated_at: new Date().toISOString(),
        });
      }

      console.log('[Messaging] Message deleted:', messageId);
    } catch (error) {
      this.handleError(error);
    }
  }

  async markAsRead(conversationId: string, messageIds?: string[]): Promise<void> {
    try {
      const userId = this.requireAuth();
      const now = new Date().toISOString();

      if (messageIds && messageIds.length > 0) {
        // Mark specific messages as read
        const batch = messageIds.map(async (messageId) => {
          const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
          await updateDoc(messageRef, {
            read_by: arrayUnion(userId),
            updated_at: now,
          });
        });
        await Promise.all(batch);
      }

      // Reset unread count for current user in conversation
      const conversation = await this.getConversation(conversationId);
      if (conversation) {
        const updatedParticipants = conversation.participant_details.map(p => {
          if (p.user_id === userId) {
            return { ...p, unread_count: 0, last_read_at: now };
          }
          return p;
        });

        const conversationRef = doc(this.db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
          participant_details: updatedParticipants,
          updated_at: now,
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============================================
  // MUTE NOTIFICATIONS
  // ============================================

  /**
   * Toggle mute status for a conversation
   */
  async toggleMuteConversation(conversationId: string): Promise<boolean> {
    try {
      const userId = this.requireAuth();
      const conversation = await this.getConversation(conversationId);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Check if user is a participant
      if (!conversation.participants.includes(userId)) {
        throw new Error('You are not a member of this conversation');
      }

      const now = new Date().toISOString();

      // Find current mute status and toggle it
      const updatedParticipants = conversation.participant_details.map(p => {
        if (p.user_id === userId) {
          const newMutedStatus = !p.is_muted;
          return {
            ...p,
            is_muted: newMutedStatus,
            muted_at: newMutedStatus ? now : null,
          };
        }
        return p;
      });

      const conversationRef = doc(this.db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        participant_details: updatedParticipants,
        updated_at: now,
      });

      // Return the new muted status
      const currentUser = updatedParticipants.find(p => p.user_id === userId);
      return currentUser?.is_muted ?? false;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Check if current user has muted a conversation
   */
  async isConversationMuted(conversationId: string): Promise<boolean> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return false;

      const conversation = await this.getConversation(conversationId);
      if (!conversation) return false;

      const participant = conversation.participant_details.find(p => p.user_id === userId);
      return participant?.is_muted ?? false;
    } catch (error) {
      console.error('[Messaging] Error checking mute status:', error);
      return false;
    }
  }

  // ============================================
  // REACTIONS
  // ============================================
  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    try {
      const userId = this.requireAuth();
      const now = new Date().toISOString();

      const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        reactions: arrayUnion({
          user_id: userId,
          emoji,
          created_at: now,
        }),
        updated_at: now,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    try {
      const userId = this.requireAuth();
      const now = new Date().toISOString();

      const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);

      if (messageSnap.exists()) {
        const messageData = messageSnap.data() as Message;
        const updatedReactions = (messageData.reactions || []).filter(
          r => !(r.user_id === userId && r.emoji === emoji)
        );

        await updateDoc(messageRef, {
          reactions: updatedReactions,
          updated_at: now,
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  // ============================================
  // UNREAD COUNT
  // ============================================
  async getTotalUnreadCount(): Promise<number> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) return 0;

      const conversations = await this.getConversations();
      return conversations.reduce((total, conv) => {
        const participant = conv.participant_details.find(p => p.user_id === userId);
        return total + (participant?.unread_count || 0);
      }, 0);
    } catch (error) {
      console.error('[Messaging] Error getting unread count:', error);
      return 0;
    }
  }

  subscribeToUnreadCount(callback: (count: number) => void): Unsubscribe {
    return this.subscribeToConversations((conversations) => {
      const userId = this.getCurrentUserId();
      if (!userId) {
        callback(0);
        return;
      }

      const totalUnread = conversations.reduce((total, conv) => {
        const participant = conv.participant_details.find(p => p.user_id === userId);
        return total + (participant?.unread_count || 0);
      }, 0);

      callback(totalUnread);
    });
  }
}

export const messagingService = new MessagingService();
export default MessagingService;
