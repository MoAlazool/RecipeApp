# Firebase Setup Guide - RecipeApp

This guide will help you complete the Firebase migration for your RecipeApp.

## Prerequisites

- Firebase account (free tier is sufficient to start)
- Google Cloud Console access
- Xcode (for iOS development)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `RecipeApp` (or your preferred name)
4. Disable Google Analytics (optional, can enable later)
5. Click "Create project"

## Step 2: Register iOS App

1. In Firebase Console, click the iOS icon to add an iOS app
2. Enter iOS bundle ID: `com.moalazool.recipeapp` (must match app.json)
3. Enter App nickname: `RecipeApp iOS`
4. Download the `GoogleService-Info.plist` file
5. **IMPORTANT:** Move the downloaded `GoogleService-Info.plist` to your project root directory

## Step 3: Enable Firebase Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle "Enable"
   - Click "Save"

3. Enable **Google** (for OAuth):
   - Click on "Google"
   - Toggle "Enable"
   - Select your support email
   - Click "Save"
   - Note the **Web client ID** (starts with numbers, ends with `.apps.googleusercontent.com`)

## Step 4: Set Up Cloud Firestore

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (we'll add custom security rules)
4. Select your Cloud Firestore location (choose closest to your users)
5. Click "Enable"

### Add Security Rules

Click on the **Rules** tab and replace with:

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
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.user_id == request.auth.uid;
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
  }
}
```

Click **Publish** to save the rules.

### Create Composite Indexes

Go to **Indexes** tab and create these composite indexes:

1. **Collection ID:** `recipes`
   - Fields to index: `user_id` (Ascending), `created_at` (Descending)
   - Query scope: Collection

2. **Collection ID:** `shopping_lists`
   - Fields to index: `user_id` (Ascending), `is_active` (Ascending)
   - Query scope: Collection

3. **Collection ID:** `fridge_scans`
   - Fields to index: `user_id` (Ascending), `created_at` (Descending)
   - Query scope: Collection

Click "Create index" for each one. They will take a few minutes to build.

## Step 5: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click on your iOS app
4. Under "SDK setup and configuration", select **Config**
5. Copy the following values:

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Step 6: Configure Environment Variables

Edit your `.env` file and fill in the Firebase configuration values:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:ios:abc...

# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789012-abcd...apps.googleusercontent.com
```

**Where to find GOOGLE_WEB_CLIENT_ID:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. Under "OAuth 2.0 Client IDs", find the Web client (auto-created by Google Service)
5. Copy the Client ID

## Step 7: Install Dependencies

The dependencies have already been updated. Run:

```bash
npm install
```

This will install:
- `firebase` - Firebase SDK
- Keep existing: `expo-auth-session`, `expo-web-browser` (already installed)

## Step 8: iOS-Specific Setup

### Add GoogleService-Info.plist to Xcode

1. Open your project in Xcode:
   ```bash
   cd ios
   pod install
   cd ..
   npx expo run:ios
   ```

2. In Xcode, locate your project navigator (left sidebar)
3. Right-click on the project root → "Add Files to RecipeApp"
4. Select `GoogleService-Info.plist` from your project root
5. Make sure "Copy items if needed" is checked
6. Click "Add"

### Configure URL Scheme (for Google OAuth)

The URL scheme is already configured in `app.json`:
```json
"scheme": "recipeapp"
```

## Step 9: Test the Migration

### Test Authentication

1. **Sign Up with Email/Password:**
   ```bash
   npx expo start
   ```
   - Press `i` for iOS simulator
   - Go to Sign Up screen
   - Create a new account with email/password
   - Verify user appears in Firebase Console → Authentication

2. **Sign In:**
   - Sign out
   - Sign back in with the same credentials
   - Verify session persists across app restarts

3. **Google OAuth:**
   - Try "Sign in with Google"
   - Verify OAuth flow completes
   - Check user profile is created

### Test Data Operations

1. **Create Recipe:**
   - Add a recipe from a YouTube video
   - Check Firebase Console → Firestore → `recipes` collection
   - Verify recipe document contains correct data

2. **Shopping List:**
   - Add items to shopping list
   - Check Firestore → `shopping_lists` → [list_id] → `items` subcollection
   - Toggle items checked/unchecked
   - Verify real-time updates work

3. **Fridge Scan:**
   - Scan a fridge image
   - Check Firestore → `fridge_scans` collection
   - Verify ingredients are saved

## Step 10: Monitor & Debug

### Check Firestore Console

Monitor your database in real-time:
- Firebase Console → Firestore Database
- Watch documents being created/updated/deleted

### Check Authentication Console

See all signed-up users:
- Firebase Console → Authentication → Users

### Enable Debug Logging (if needed)

Add to your firebase.service.ts if you need detailed logs:
```typescript
import { setLogLevel } from 'firebase/app';
setLogLevel('debug');
```

## Step 11: Post-Migration Cleanup

Once everything is working:

1. **Remove Supabase:**
   ```bash
   npm uninstall @supabase/supabase-js
   rm services/supabase.service.ts
   ```

2. **Remove from .env:**
   - Delete commented Supabase environment variables

3. **Commit changes:**
   ```bash
   git add .
   git commit -m "Migrate from Supabase to Firebase"
   ```

## Troubleshooting

### "Permission denied" errors
- Check Firestore security rules are published
- Verify user is authenticated
- Ensure composite indexes are built

### Google OAuth not working
- Verify `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is correct
- Check URL scheme in app.json matches
- Ensure GoogleService-Info.plist is in iOS project

### Indexes not working
- Wait 5-10 minutes for indexes to build
- Check Firebase Console → Firestore → Indexes tab
- Look for "Building" status, wait until "Enabled"

### App crashes on iOS
- Verify GoogleService-Info.plist is added to Xcode project
- Check bundle identifier matches: `com.moalazool.recipeapp`
- Run `cd ios && pod install` to update pods

## Success Criteria

✅ Users can sign up with email/password
✅ Users can sign in with Google OAuth
✅ Users can create and view recipes
✅ Shopping list items sync correctly
✅ Fridge scans are saved and retrieved
✅ Session persists across app restarts
✅ Delete recipe functionality works
✅ No console errors or warnings

## Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Expo Firebase Guide](https://docs.expo.dev/guides/using-firebase/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
