# Firebase Migration - Quick Start

## ✅ What's Already Done

1. ✅ **Code Migration Complete**
   - Firebase service created (mirrors Supabase API)
   - All imports updated (stores, components)
   - Firebase SDK installed

2. ✅ **Configuration Files Ready**
   - GoogleService-Info.plist exists with correct bundle ID
   - .env updated with Firebase values from plist
   - app.json configured

3. ✅ **Firebase Project Exists**
   - Project ID: `recipeapp-dcb62`
   - Bundle ID: `com.moalazool.recipeapp`
   - Storage Bucket: `recipeapp-dcb62.firebasestorage.app`

## 🔧 Still Need To Do

### 1. Get Google Web Client ID (5 minutes)

Your .env has: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=92914755909-XXXXXXXXXXXXXXXXXX.apps.googleusercontent.com`

**How to find it:**

Option A - Firebase Console:
1. Go to https://console.firebase.google.com/project/recipeapp-dcb62
2. Authentication → Sign-in method → Google
3. Look for "Web SDK configuration" section
4. Copy the **Web client ID**
5. Update .env file

Option B - Google Cloud Console:
1. Go to https://console.cloud.google.com/
2. Select project "recipeapp-dcb62"
3. Go to APIs & Services → Credentials
4. Find "Web client (auto created by Google Service)" in OAuth 2.0 Client IDs
5. Copy the Client ID
6. Update .env file

### 2. Enable Firestore (if not already enabled) (10 minutes)

Check if Firestore is enabled:
1. Go to https://console.firebase.google.com/project/recipeapp-dcb62/firestore
2. If you see "Get started" or "Create database" button:
   - Click it
   - Choose **Production mode**
   - Select location: **us-central1** (or closest to you)
   - Click "Enable"

### 3. Add Firestore Security Rules (5 minutes)

1. Go to Firestore Database → Rules tab
2. Replace everything with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /recipes/{recipeId} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;
    }

    match /shopping_lists/{listId} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;

      match /items/{itemId} {
        allow read, write: if request.auth != null;
      }
    }

    match /fridge_scans/{scanId} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;
    }
  }
}
```

3. Click **Publish**

### 4. Create Composite Indexes (5 minutes)

Go to Firestore Database → Indexes tab

Create these 3 indexes:

**Index 1: recipes**
- Collection ID: `recipes`
- Fields indexed:
  - `user_id` → Ascending
  - `created_at` → Descending
- Query scope: Collection
- Click "Create"

**Index 2: shopping_lists**
- Collection ID: `shopping_lists`
- Fields indexed:
  - `user_id` → Ascending
  - `is_active` → Ascending
- Query scope: Collection
- Click "Create"

**Index 3: fridge_scans**
- Collection ID: `fridge_scans`
- Fields indexed:
  - `user_id` → Ascending
  - `created_at` → Descending
- Query scope: Collection
- Click "Create"

⏳ Wait 5-10 minutes for indexes to build (they'll show "Building..." then "Enabled")

### 5. Enable Email/Password Authentication (2 minutes)

1. Go to Authentication → Sign-in method
2. Click on "Email/Password"
3. Toggle "Enable"
4. Click "Save"

### 6. Enable Google Authentication (2 minutes)

1. Go to Authentication → Sign-in method
2. Click on "Google"
3. Toggle "Enable"
4. Select your support email from dropdown
5. Click "Save"

## 🚀 Run the App

Once the above steps are complete:

```bash
# Install iOS pods
cd ios
pod install
cd ..

# Run the app
npx expo run:ios
```

## 🧪 Quick Test

1. **Sign Up:**
   - Create account with email/password
   - Check Firebase Console → Authentication → Users (should show new user)

2. **Create Recipe:**
   - Add a recipe in the app
   - Check Firebase Console → Firestore → recipes collection

3. **Delete Recipe (The Bug Fix!):**
   - Delete the recipe you just created
   - Verify it's deleted from both Firestore and app
   - This should work now! (This was the original bug with Supabase)

## 🆘 Troubleshooting

### "Permission denied" when creating data
**Fix:** Make sure security rules are published in Firestore

### Google OAuth not working
**Fix:** Update `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in .env with actual Web client ID

### "Index not ready" error
**Fix:** Wait for indexes to finish building (check Firestore → Indexes tab)

### App crashes on launch
**Fix:**
```bash
cd ios
pod install
cd ..
npx expo run:ios
```

## 📚 More Help

- **Detailed Setup:** See `FIREBASE_SETUP.md`
- **Technical Details:** See `MIGRATION_SUMMARY.md`
- **Step-by-Step:** See `NEXT_STEPS.md`

## ⏱️ Total Time Estimate

- Firebase Console setup: ~30 minutes
- Testing: ~15 minutes
- **Total: ~45 minutes**

---

**Current Status:** Ready to configure Firebase Console and test!

**Firebase Project:** https://console.firebase.google.com/project/recipeapp-dcb62
