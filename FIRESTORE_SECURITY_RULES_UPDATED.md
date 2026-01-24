# Firestore Security Rules - Updated for Pantry

## Complete Security Rules

Copy and paste these rules into Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // User profiles - users can only read/write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Recipes - users can only access their own recipes
    match /recipes/{recipeId} {
      allow read: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.user_id == request.auth.uid;
    }

    // Shopping lists - users can only access their own lists
    match /shopping_lists/{listId} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;

      // Shopping list items (subcollection)
      match /items/{itemId} {
        allow read, write: if request.auth != null;
      }
    }

    // Fridge scans - users can only access their own scans
    match /fridge_scans/{scanId} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;
    }

    // User pantry (saved fridge items) - NEW
    // Document ID is the user ID
    match /user_pantry/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## What's New

Added `user_pantry` collection rules:
- Each user has ONE document with their user ID
- Users can only read/write their own pantry
- Document structure:
  ```typescript
  {
    id: "user123",
    user_id: "user123",
    items: [...],
    last_scan_at: "...",
    updated_at: "..."
  }
  ```

## Composite Indexes Required

Go to Firebase Console → Firestore → Indexes and create these:

### Index 1: Recipes
- **Collection ID:** `recipes`
- **Fields:**
  - `user_id` → Ascending
  - `created_at` → Descending
- **Query scope:** Collection

### Index 2: Shopping Lists
- **Collection ID:** `shopping_lists`
- **Fields:**
  - `user_id` → Ascending
  - `is_active` → Ascending
- **Query scope:** Collection

### Index 3: Fridge Scans
- **Collection ID:** `fridge_scans`
- **Fields:**
  - `user_id` → Ascending
  - `created_at` → Descending
- **Query scope:** Collection

**Note:** `user_pantry` doesn't need indexes since we query by document ID directly.

## Testing Security Rules

### Test 1: Read Own Pantry
```typescript
// Should succeed
const pantry = await firebaseService.getUserPantry(currentUserId);
```

### Test 2: Read Other User's Pantry
```typescript
// Should fail with permission denied
const pantry = await firebaseService.getUserPantry(otherUserId);
```

### Test 3: Create Pantry
```typescript
// Should succeed (authenticated user)
await firebaseService.createUserPantry({
  user_id: currentUserId,
  items: [...],
  updated_at: new Date().toISOString()
});
```

### Test 4: Update Pantry
```typescript
// Should succeed (own pantry)
await firebaseService.updateUserPantry({
  id: currentUserId,
  items: [...updated items...],
  updated_at: new Date().toISOString()
});
```

## Deploy Instructions

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `recipeapp-dcb62`
3. Go to **Firestore Database** → **Rules** tab
4. Copy the rules above
5. Paste into the editor
6. Click **"Publish"**
7. Wait for confirmation: "Rules published successfully"

## Verification

After deploying rules:

1. **Test in Firestore Console:**
   - Go to Firestore → user_pantry collection
   - Try to read a document
   - Should see: "Missing or insufficient permissions" (if not authenticated)

2. **Test in App:**
   ```bash
   npx expo run:ios
   ```
   - Sign in
   - Scan fridge
   - Tap "Find Recipes"
   - Check Firestore → user_pantry → [your_user_id]
   - Should see saved items ✓

3. **Test AI Chef:**
   - Go to AI Chef tab
   - Should show item count from saved pantry
   - Ask "What's in my fridge?"
   - Should list saved items ✓

## Rollback

If you need to rollback:

1. Go to Firestore → Rules → History tab
2. Find previous version
3. Click "Revert to this version"

## Common Issues

### Issue: "Permission denied" when saving pantry

**Solution:** Check that:
- User is authenticated: `firebaseService.getSession()`
- Document ID matches user ID: `doc(db, 'user_pantry', userId)`
- Rules are published (not in draft mode)

### Issue: "Index not ready"

**Solution:** Wait 5-10 minutes for Firebase to build indexes

### Issue: Can't read pantry after scan

**Solution:**
- Check network connection
- Verify user is authenticated
- Check console for Firebase errors
- Verify document exists in Firestore console

---

**Last Updated:** January 23, 2026
**Status:** ✅ Ready to Deploy
