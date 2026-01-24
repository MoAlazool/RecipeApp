# 💬 Direct Messaging & Social Feature - Firebase Implementation Guide

---

## 🎯 Feature Overview

Build a real-time messaging system that allows users to:
1. **Direct 1:1 messaging** with other app users
2. **Share recipes** (saved, favorites, cooking today, or recipe links)
3. **Add reactions** to messages (❤️ 😂 👍 etc.)
4. **View user profiles** with bio, username, and public recipes
5. **Follow/Unfollow** other users
6. **See online status** (is_online, last_seen_at)
7. **Receive notifications** for new messages and follows

### User Value
- Share recipe ideas with friends
- Get recipe recommendations from others
- Collaborate on meal prep
- Build community within the app

---

## 📊 Firebase Firestore Schema

### Collection 1: `conversations`
**Document ID:** `{userId1}_{userId2}` (both IDs concatenated, smaller ID first)

```javascript
{
  user_1_id: "uid1",                    // Alphabetically smaller ID
  user_2_id: "uid2",                    // Alphabetically larger ID
  participants: ["uid1", "uid2"],       // Array for easier queries
  
  // Last message info
  last_message_id: "msgId",
  last_message_content: "Hey, check out this recipe!",
  last_message_type: "text",            // 'text' or 'recipe'
  last_message_at: Timestamp,
  last_sender_id: "uid1",
  
  // User preferences
  user_1_muted: false,                  // Mute notifications
  user_2_muted: false,
  user_1_archived: false,               // Archive conversation
  user_2_archived: false,
  
  // Metadata
  created_at: Timestamp,
  updated_at: Timestamp
}
```

**Subcollection: `conversations/{conversationId}/messages`**
```javascript
{
  id: "auto-generated",
  sender_id: "uid1",
  recipient_id: "uid2",
  
  // Message content
  message_type: "text",                 // 'text' or 'recipe'
  content: "Try this amazing pasta recipe!",
  
  // If recipe is shared
  recipe_id: "recipeId",                // Reference to recipe doc
  recipe_data: {                        // Quick preview snapshot
    title: "Pasta Carbonara",
    image_url: "gs://bucket/...",
    prep_time: 10,
    cook_time: 20,
    servings: 4
  },
  
  // Read status
  is_read: true,
  read_at: Timestamp,
  
  // Reactions/Emojis
  reactions: {
    "❤️": ["uid2", "uid3"],
    "😂": ["uid4"],
    "👍": ["uid5"]
  },
  
  // Metadata
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### Collection 2: `users` (Extended)
**Document ID:** `{userId}` (Firebase Auth UID)

```javascript
{
  // Auth info
  email: "user@example.com",
  
  // Profile
  username: "ahmed_cooking",            // Unique, searchable
  full_name: "Ahmed Ali",
  bio: "Food lover & cooking enthusiast",
  avatar_url: "gs://bucket/avatars/...",
  is_public: true,                      // Public or private profile
  
  // Stats
  followers_count: 42,
  following_count: 18,
  recipes_count: 15,
  
  // Presence
  is_online: true,
  last_seen_at: Timestamp,
  
  // Metadata
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### Collection 3: `follows`
**Document ID:** `{auto-generated}`

```javascript
{
  follower_id: "uid1",                  // Who is following
  following_id: "uid2",                 // Who is being followed
  created_at: Timestamp
}
```

**Optional: Subcollection approach**
```
users/{userId}/following/{followingId}
users/{userId}/followers/{followerId}
```

### Collection 4: `recipe_shares`
**Document ID:** `{auto-generated}`

```javascript
{
  recipe_id: "recipeId",
  shared_by_id: "uid1",
  shared_to_id: "uid2",                 // null for public shares
  message_id: "msgId",                  // Link to the message
  share_type: "direct",                 // 'direct' or 'public'
  shared_at: Timestamp
}
```

---

## 🔐 Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users - Anyone auth'd can read, users can only write their own
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Conversations - Only participants can read/write
    match /conversations/{conversationId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
      allow update: if request.auth.uid in resource.data.participants;
      
      // Messages within conversation
      match /messages/{messageId} {
        allow read: if request.auth.uid in resource.data.sender_id || 
                       request.auth.uid in resource.data.recipient_id;
        allow create: if request.auth.uid == request.resource.data.sender_id;
        allow update: if request.auth.uid == resource.data.sender_id;
        allow delete: if request.auth.uid == resource.data.sender_id;
      }
    }
    
    // Follows - Anyone auth'd can read, users control their follows
    match /follows/{followId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.follower_id;
      allow delete: if request.auth.uid == resource.data.follower_id;
    }
    
    // Recipe shares - Track sharing analytics
    match /recipe_shares/{shareId} {
      allow read: if request.auth.uid == resource.data.shared_by_id ||
                     request.auth.uid == resource.data.shared_to_id ||
                     resource.data.share_type == 'public';
      allow create: if request.auth.uid == request.resource.data.shared_by_id;
    }
  }
}
```

---

## 🛠️ Services Implementation

### `services/messaging.service.ts`
```typescript
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

class MessagingService {
  
  // Get all conversations for a user
  async getConversations(userId: string) {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('last_message_at', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // Real-time listener for conversations
  subscribeToConversations(userId: string, callback: Function) {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('last_message_at', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(conversations);
    });
  }

  // Get or create conversation between two users
  async getOrCreateConversation(userId1: string, userId2: string) {
    const [minId, maxId] = userId1 < userId2 
      ? [userId1, userId2] 
      : [userId2, userId1];
    
    const conversationId = `${minId}_${maxId}`;
    const conversationRef = doc(db, 'conversations', conversationId);
    
    const snapshot = await getDoc(conversationRef);
    
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() };
    }
    
    // Create new conversation
    const newConversation = {
      user_1_id: minId,
      user_2_id: maxId,
      participants: [userId1, userId2],
      last_message_id: null,
      last_message_content: '',
      last_message_type: 'text',
      last_message_at: Timestamp.now(),
      last_sender_id: '',
      user_1_muted: false,
      user_2_muted: false,
      user_1_archived: false,
      user_2_archived: false,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    await setDoc(conversationRef, newConversation);
    return { id: conversationId, ...newConversation };
  }

  // Get messages from a conversation
  async getMessages(conversationId: string, limitNum: number = 20) {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('created_at', 'desc'),
      limit(limitNum)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .reverse(); // Newest last
  }

  // Real-time listener for messages
  subscribeToMessages(conversationId: string, callback: Function) {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('created_at', 'asc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(messages);
    });
  }

  // Send text message
  async sendMessage(senderId: string, recipientId: string, content: string) {
    const conversation = await this.getOrCreateConversation(senderId, recipientId);
    const messageRef = doc(collection(db, 'conversations', conversation.id, 'messages'));
    
    const message = {
      sender_id: senderId,
      recipient_id: recipientId,
      message_type: 'text',
      content,
      recipe_id: null,
      recipe_data: null,
      is_read: false,
      read_at: null,
      reactions: {},
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    await setDoc(messageRef, message);
    
    // Update conversation
    await updateDoc(doc(db, 'conversations', conversation.id), {
      last_message_id: messageRef.id,
      last_message_content: content,
      last_message_type: 'text',
      last_message_at: Timestamp.now(),
      last_sender_id: senderId,
      updated_at: Timestamp.now()
    });
    
    return { id: messageRef.id, ...message };
  }

  // Send recipe as message
  async sendRecipeAsMessage(
    senderId: string,
    recipientId: string,
    recipeId: string,
    recipeData: any
  ) {
    const conversation = await this.getOrCreateConversation(senderId, recipientId);
    const messageRef = doc(collection(db, 'conversations', conversation.id, 'messages'));
    
    const message = {
      sender_id: senderId,
      recipient_id: recipientId,
      message_type: 'recipe',
      content: null,
      recipe_id: recipeId,
      recipe_data: recipeData,
      is_read: false,
      read_at: null,
      reactions: {},
      created_at: Timestamp.now(),
      updated_at: Timestamp.now()
    };
    
    const batch = writeBatch(db);
    batch.set(messageRef, message);
    batch.update(doc(db, 'conversations', conversation.id), {
      last_message_id: messageRef.id,
      last_message_content: `Shared recipe: ${recipeData.title}`,
      last_message_type: 'recipe',
      last_message_at: Timestamp.now(),
      last_sender_id: senderId
    });
    
    // Track the share
    const shareRef = doc(collection(db, 'recipe_shares'));
    batch.set(shareRef, {
      recipe_id: recipeId,
      shared_by_id: senderId,
      shared_to_id: recipientId,
      message_id: messageRef.id,
      share_type: 'direct',
      shared_at: Timestamp.now()
    });
    
    await batch.commit();
    return { id: messageRef.id, ...message };
  }

  // Mark message as read
  async markAsRead(conversationId: string, messageId: string) {
    await updateDoc(
      doc(db, 'conversations', conversationId, 'messages', messageId),
      {
        is_read: true,
        read_at: Timestamp.now()
      }
    );
  }

  // Delete message
  async deleteMessage(conversationId: string, messageId: string) {
    await deleteDoc(
      doc(db, 'conversations', conversationId, 'messages', messageId)
    );
  }

  // Add reaction to message
  async addReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: string
  ) {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageSnapshot = await getDoc(messageRef);
    
    if (!messageSnapshot.exists()) return;
    
    const reactions = messageSnapshot.data().reactions || {};
    
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    
    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
    }
    
    await updateDoc(messageRef, { reactions });
  }

  // Remove reaction from message
  async removeReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
    userId: string
  ) {
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageSnapshot = await getDoc(messageRef);
    
    if (!messageSnapshot.exists()) return;
    
    const reactions = messageSnapshot.data().reactions || {};
    
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    }
    
    await updateDoc(messageRef, { reactions });
  }

  // Mute/Unmute conversation
  async muteConversation(conversationId: string, userId: string, mute: boolean) {
    const [uid1, uid2] = conversationId.split('_');
    const field = userId === uid1 ? 'user_1_muted' : 'user_2_muted';
    
    await updateDoc(doc(db, 'conversations', conversationId), {
      [field]: mute
    });
  }

  // Archive conversation
  async archiveConversation(conversationId: string, userId: string) {
    const [uid1, uid2] = conversationId.split('_');
    const field = userId === uid1 ? 'user_1_archived' : 'user_2_archived';
    
    await updateDoc(doc(db, 'conversations', conversationId), {
      [field]: true
    });
  }

  // Delete conversation
  async deleteConversation(conversationId: string) {
    await deleteDoc(doc(db, 'conversations', conversationId));
  }
}

export const messagingService = new MessagingService();
```

### `services/user.service.ts`
```typescript
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

class UserService {
  
  // Get user profile
  async getUserProfile(userId: string) {
    const snapshot = await getDoc(doc(db, 'users', userId));
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
  }

  // Update user profile
  async updateProfile(userId: string, data: any) {
    await updateDoc(doc(db, 'users', userId), {
      ...data,
      updated_at: Timestamp.now()
    });
  }

  // Search users by username
  async searchUsers(searchQuery: string, limitNum: number = 10) {
    const q = query(
      collection(db, 'users'),
      where('username', '>=', searchQuery.toLowerCase()),
      where('username', '<=', searchQuery.toLowerCase() + '\uf8ff'),
      where('is_public', '==', true),
      limit(limitNum)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Mark user as online
  async markUserAsActive(userId: string) {
    await updateDoc(doc(db, 'users', userId), {
      is_online: true,
      last_seen_at: Timestamp.now()
    });
  }

  // Mark user as offline
  async markUserAsInactive(userId: string) {
    await updateDoc(doc(db, 'users', userId), {
      is_online: false,
      last_seen_at: Timestamp.now()
    });
  }

  // Follow a user
  async followUser(followerId: string, followingId: string) {
    const batch = writeBatch(db);
    
    // Add follow document
    const followRef = doc(collection(db, 'follows'));
    batch.set(followRef, {
      follower_id: followerId,
      following_id: followingId,
      created_at: Timestamp.now()
    });
    
    // Update following count
    const followerProfile = await this.getUserProfile(followerId);
    batch.update(doc(db, 'users', followerId), {
      following_count: (followerProfile?.following_count || 0) + 1
    });
    
    // Update followers count
    const followingProfile = await this.getUserProfile(followingId);
    batch.update(doc(db, 'users', followingId), {
      followers_count: (followingProfile?.followers_count || 0) + 1
    });
    
    await batch.commit();
  }

  // Unfollow a user
  async unfollowUser(followerId: string, followingId: string) {
    const q = query(
      collection(db, 'follows'),
      where('follower_id', '==', followerId),
      where('following_id', '==', followingId)
    );
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Update counts
    const followerProfile = await this.getUserProfile(followerId);
    batch.update(doc(db, 'users', followerId), {
      following_count: Math.max(0, (followerProfile?.following_count || 0) - 1)
    });
    
    const followingProfile = await this.getUserProfile(followingId);
    batch.update(doc(db, 'users', followingId), {
      followers_count: Math.max(0, (followingProfile?.followers_count || 0) - 1)
    });
    
    await batch.commit();
  }

  // Check if user follows another
  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const q = query(
      collection(db, 'follows'),
      where('follower_id', '==', followerId),
      where('following_id', '==', followingId)
    );
    
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  // Get user's followers
  async getFollowers(userId: string, limitNum: number = 50) {
    const q = query(
      collection(db, 'follows'),
      where('following_id', '==', userId),
      limit(limitNum)
    );
    
    const snapshot = await getDocs(q);
    const followers = [];
    
    for (const doc of snapshot.docs) {
      const user = await this.getUserProfile(doc.data().follower_id);
      if (user) followers.push(user);
    }
    
    return followers;
  }

  // Get users that user is following
  async getFollowing(userId: string, limitNum: number = 50) {
    const q = query(
      collection(db, 'follows'),
      where('follower_id', '==', userId),
      limit(limitNum)
    );
    
    const snapshot = await getDocs(q);
    const following = [];
    
    for (const doc of snapshot.docs) {
      const user = await this.getUserProfile(doc.data().following_id);
      if (user) following.push(user);
    }
    
    return following;
  }
}

export const userService = new UserService();
```

---

## 📱 New Screens

### 1. `/app/(tabs)/messages.tsx` - Inbox/Conversations List
**Features:**
- Display all conversations
- Show last message preview + time
- Unread message count badge
- Search conversations
- Swipe actions: mute, archive, delete
- Empty state when no conversations
- Real-time updates

**UI Flow:**
```
Header: "Messages" + Add button
├── Search bar
├── Conversation List
│   ├── User avatar + name
│   ├── Last message preview
│   ├── Timestamp (2m ago)
│   ├── Unread badge (red)
│   └── Swipe actions
└── Empty State: "No conversations yet"
```

### 2. `/app/chat/[userId].tsx` - Direct Chat
**Features:**
- Message list (newest at bottom)
- Message bubbles with sender info
- Recipe cards inline
- Reactions display
- Input field with send button
- Keyboard handling
- Real-time message updates
- Read receipts (✓ sent, ✓✓ read)

**UI Elements:**
```
Header: User name + online status + menu
├── Messages list (FlatList)
│   ├── My message (right, blue)
│   ├── Their message (left, gray)
│   ├── Recipe card (special styling)
│   ├── Reactions (❤️ 😂 👍)
│   └── Timestamp
├── Unread divider
└── Input area
    ├── Text input
    ├── Icon buttons (recipe, emoji, send)
    └── Keyboard aware
```

### 3. `/app/find-users.tsx` - Search Users
**Features:**
- Search users by username/name
- Show public profiles only
- Display followers/following count
- Follow/Message buttons
- Recent contacts section
- Suggested users section
- User avatars

**UI Flow:**
```
Header: "Find Users"
├── Search bar
├── Recent Contacts
│   └── User list
├── Search Results
│   └── User cards with Follow/Message
└── Suggested Users
    └── Recommended profiles
```

### 4. `/app/profile/[userId].tsx` - User Profile (Extended)
**Features:**
- User avatar + name + @username
- Bio/description
- Followers/Following counts
- Follow/Unfollow button
- Message button
- Public recipes tab
- Online status indicator
- Edit button (if own profile)

**UI Flow:**
```
Header: User name + edit/menu
├── Avatar image
├── @username + bio
├── Followers | Following | Recipes counts
├── Action buttons (Follow, Message)
├── Tabs: Public Recipes | Followers | Following
└── Content list
```

### 5. `/app/share-recipe.tsx` - Share Recipe Modal
**Features:**
- Search and select recipient
- Choose recipe from tabs (Saved, Today, Favorites, Recent)
- Add optional message
- Send button with loading state

**UI Flow:**
```
Header: "Share Recipe"
├── Recipient search field
├── Recipe tabs
│   ├── Saved recipes
│   ├── Today's cooking
│   ├── Favorites
│   └── Recent
├── Recipe list with checkbox
├── Optional message input
└── Share button
```

---

## 🗄️ Zustand Store

### `stores/messagingStore.ts`
```typescript
import { create } from 'zustand';

interface MessagingState {
  conversations: any[];
  currentConversation: any | null;
  messages: any[];
  isLoading: boolean;
  unreadCount: number;
  
  // Actions
  setConversations: (convs: any[]) => void;
  setCurrentConversation: (conv: any) => void;
  addMessage: (msg: any) => void;
  updateMessage: (messageId: string, data: any) => void;
  deleteMessage: (messageId: string) => void;
  setMessages: (msgs: any[]) => void;
  setIsLoading: (loading: boolean) => void;
  resetChat: () => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  unreadCount: 0,
  
  setConversations: (convs) => set({ conversations: convs }),
  setCurrentConversation: (conv) => set({ currentConversation: conv }),
  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg]
  })),
  updateMessage: (messageId, data) => set((state) => ({
    messages: state.messages.map(msg =>
      msg.id === messageId ? { ...msg, ...data } : msg
    )
  })),
  deleteMessage: (messageId) => set((state) => ({
    messages: state.messages.filter(msg => msg.id !== messageId)
  })),
  setMessages: (msgs) => set({ messages: msgs }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  resetChat: () => set({
    currentConversation: null,
    messages: [],
    isLoading: false
  })
}));
```

---

## 🔔 Push Notifications

Integrate with `expo-notifications`:

```typescript
// When new message arrives
async function handleNewMessage(message: Message) {
  // Check if conversation is muted
  if (shouldNotify(conversation)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: senderName,
        body: messagePreview,
        data: {
          conversationId,
          senderId
        }
      },
      trigger: { seconds: 1 }
    });
  }
}

// When new follower
async function handleNewFollower(follower: User) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Follower',
      body: `${follower.full_name} started following you`,
      data: { userId: follower.id }
    },
    trigger: { seconds: 1 }
  });
}
```

---

## 🔗 Integration with Existing Features

### From Recipe Detail Screen
Add "Share" button to recipe card:
```typescript
<TouchableOpacity onPress={() => navigation.navigate('share-recipe', { recipeId })}>
  <Text>Share Recipe</Text>
</TouchableOpacity>
```

### From Recipe List
Add "Recommend to Friend" action on each recipe card

### From User Profile Tab
Show "Message" button when viewing other users' profiles

---

## 📋 Implementation Phases

### Phase 1: Basic Messaging (Week 1)
- [ ] Create Firestore collections
- [ ] Implement messagingService
- [ ] Create messages.tsx (Inbox)
- [ ] Create chat/[userId].tsx
- [ ] Text messaging only
- [ ] Real-time updates with subscriptions

### Phase 2: Recipe Sharing (Week 2)
- [ ] Add recipe_shares collection
- [ ] Implement sendRecipeAsMessage
- [ ] Recipe card component in chat
- [ ] Share modal screen

### Phase 3: Profiles & Following (Week 2-3)
- [ ] Extend users collection
- [ ] Implement userService (follow/unfollow)
- [ ] Create find-users.tsx
- [ ] Update profile/[userId].tsx
- [ ] Followers/Following lists

### Phase 4: Polish & Notifications (Week 3-4)
- [ ] Push notifications
- [ ] Online/offline status
- [ ] Read receipts
- [ ] Reactions
- [ ] Typing indicators
- [ ] Message search

---

## 📚 Firebase Indexes Needed

Create in Firebase Console:
```
1. conversations
   - participants (Arrays)
   - last_message_at (Descending)

2. follows
   - follower_id (Ascending)
   - following_id (Ascending)

3. follows
   - following_id (Ascending)

4. recipe_shares
   - recipe_id (Ascending)
   - shared_at (Descending)
```

---

## 🚀 Key Considerations

**Performance:**
- Use pagination for message lists (load 20 at a time)
- Cache conversations locally with AsyncStorage
- Unsubscribe from listeners when leaving screens

**UX:**
- Optimistic updates (show message immediately)
- Show typing indicator
- Distinguish own messages from others
- Clear read/unread status

**Security:**
- Validate all user inputs
- Use Firebase Security Rules strictly
- Don't expose user emails in chat UI
- Rate limit message sending

**Real-time:**
- Use Firestore listeners for instant updates
- Handle connection loss gracefully
- Queue messages offline (save to AsyncStorage)
- Sync when connection restored

---

## 📝 Types File (`utils/types.ts`)

```typescript
interface Conversation {
  id: string;
  user_1_id: string;
  user_2_id: string;
  participants: string[];
  last_message_id?: string;
  last_message_content: string;
  last_message_type: 'text' | 'recipe';
  last_message_at: Timestamp;
  last_sender_id: string;
  user_1_muted: boolean;
  user_2_muted: boolean;
  user_1_archived: boolean;
  user_2_archived: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'text' | 'recipe';
  content?: string;
  recipe_id?: string;
  recipe_data?: {
    title: string;
    image_url: string;
    prep_time: number;
    cook_time: number;
    servings: number;
  };
  is_read: boolean;
  read_at?: Timestamp;
  reactions: Record<string, string[]>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface UserProfile {
  id: string;
  email: string;
  username: string;
  full_name: string;
  bio?: string;
  avatar_url?: string;
  is_public: boolean;
  followers_count: number;
  following_count: number;
  recipes_count: number;
  is_online: boolean;
  last_seen_at: Timestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

interface Follow {
  follower_id: string;
  following_id: string;
  created_at: Timestamp;
}

interface RecipeShare {
  recipe_id: string;
  shared_by_id: string;
  shared_to_id?: string;
  message_id?: string;
  share_type: 'direct' | 'public';
  shared_at: Timestamp;
}
```

---

## ✅ Quick Checklist

- [ ] Add Firebase collections to Firestore
- [ ] Write and test Security Rules
- [ ] Create messaging.service.ts
- [ ] Create user.service.ts
- [ ] Create messagingStore
- [ ] Build messages.tsx (Inbox)
- [ ] Build chat/[userId].tsx
- [ ] Build find-users.tsx
- [ ] Integrate with recipe sharing
- [ ] Add push notifications
- [ ] Test real-time updates
- [ ] Add offline support
- [ ] Performance optimization

---

## 🎓 Resources

- Firebase Firestore Docs: https://firebase.google.com/docs/firestore
- Real-time Listeners: https://firebase.google.com/docs/firestore/query-data/listen
- Batch Writes: https://firebase.google.com/docs/firestore/manage-data/transactions
- Security Rules: https://firebase.google.com/docs/firestore/security/start
- React Native Firebase: https://rnfirebase.io/
