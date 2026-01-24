# Recipe Delete Functionality - Complete Guide

## How Delete Works

When you tap the trash button (glass button) on a recipe, here's what happens:

### Step 1: Delete from Firebase (Cloud Database)
```
[Firebase] Deleting recipe: abc123
[Firebase] Session: authenticated
[Firebase] Recipe exists: true
[Firebase] Recipe user_id: user123 Current user: user123
[Firebase] Calling deleteDoc...
[Firebase] ✓ Recipe deleted successfully
```
The recipe is **permanently removed from Firebase Firestore**.

### Step 2: Remove from Local App State
```
[RecipeStore] Removing from local app state...
[RecipeStore] ✓ Removed from local app state
```
The recipe is **removed from the app's memory** so you don't see it in the list anymore.

### Step 3: Sync with Firebase
```
[RecipeStore] Syncing with Firebase...
[RecipeStore] ✓ Synced with Firebase
```
The app refreshes the recipe list from Firebase to ensure everything is in sync.

## Complete Flow

```
User taps trash button
    ↓
Confirmation dialog appears
    ↓
User confirms "Delete"
    ↓
[UI] Deleting recipe...
    ↓
[RecipeStore] Starting delete...
    ↓
[Firebase] Delete from Firestore ✓
    ↓
[RecipeStore] Remove from app state ✓
    ↓
[RecipeStore] Sync with Firebase ✓
    ↓
Navigation back to home
```

## Setup Required (One-Time)

### Update Firebase Security Rules

**IMPORTANT:** You must update your Firestore security rules to allow delete operations.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `recipeapp-dcb62`
3. Go to **Firestore Database** → **Rules** tab
4. Copy and paste these rules:

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

    // User pantry (saved fridge items)
    match /user_pantry/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. Click **"Publish"**
6. Wait for confirmation: "Rules published successfully"

## Testing Delete

### Test Steps:

1. **Restart the app:**
   ```bash
   npx expo start --clear
   ```

2. **Open a recipe:**
   - Go to "Recipes" tab
   - Tap on any recipe

3. **Delete the recipe:**
   - Tap the trash icon (glass blur button in top right)
   - Confirm deletion in the alert dialog

4. **Check Console Logs:**
   You should see:
   ```
   [UI] Deleting recipe: abc123
   [RecipeStore] Starting delete for recipe: abc123
   [RecipeStore] Deleting from Firebase...
   [Firebase] Deleting recipe: abc123
   [Firebase] Session: authenticated
   [Firebase] Recipe exists: true
   [Firebase] Recipe user_id: user123 Current user: user123
   [Firebase] Calling deleteDoc...
   [Firebase] Recipe deleted successfully
   [RecipeStore] ✓ Deleted from Firebase
   [RecipeStore] Removing from local app state...
   [RecipeStore] ✓ Removed from local app state
   [RecipeStore] Syncing with Firebase...
   [RecipeStore] ✓ Synced with Firebase
   [RecipeStore] Delete completed successfully
   [UI] Delete successful, navigating...
   ```

5. **Verify in Firebase Console:**
   - Go to Firestore → recipes collection
   - The recipe should be **gone** from the database

6. **Verify in App:**
   - You should be back at the home screen
   - The recipe should **not appear** in your recipes list

## Troubleshooting

### Error: "Permission denied"
**Cause:** Firestore security rules haven't been updated.
**Fix:** Follow the "Setup Required" section above to update rules.

### Error: "Recipe not found or already deleted"
**Cause:** Recipe was already deleted or doesn't exist.
**Fix:** Refresh the app and try again.

### Error: "Not authenticated"
**Cause:** User is not signed in.
**Fix:** Sign in and try again.

### Error: "You do not have permission to delete this recipe"
**Cause:** Trying to delete someone else's recipe.
**Fix:** You can only delete your own recipes.

## Security

### Who Can Delete?
- ✅ The user who created the recipe
- ❌ Other users (even if they can see it)
- ❌ Unauthenticated users

### What Gets Deleted?
- ✅ Recipe document in Firebase Firestore
- ✅ Recipe from app's local state
- ✅ Recipe from in-memory cache

### What Doesn't Get Deleted?
- ❌ Shopping list items referencing the recipe (kept for history)
- ❌ Fridge scans (independent records)

## Code Locations

**UI (Delete Button):**
- `app/recipe/[id].tsx` - Line 102-128

**Store (Delete Logic):**
- `stores/recipeStore.ts` - Line 159-176

**Firebase Service (Delete from Database):**
- `services/firebase.service.ts` - Line 432-454

---

**Last Updated:** January 23, 2026
**Status:** ✅ Ready to Use (after updating Firestore rules)
