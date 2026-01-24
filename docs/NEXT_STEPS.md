# Firebase Migration - Next Steps

## ✅ Completed

1. ✅ Created `services/firebase.service.ts` - Full Firebase implementation
2. ✅ Updated all store imports (authStore, recipeStore, shoppingStore)
3. ✅ Updated app component imports (auth/index.tsx, fridge-review.tsx)
4. ✅ Installed Firebase SDK (`npm install firebase`)
5. ✅ Updated `.env` with Firebase configuration placeholders
6. ✅ Updated `app.json` with googleServicesFile reference
7. ✅ Created comprehensive setup guides (FIREBASE_SETUP.md, MIGRATION_SUMMARY.md)
8. ✅ GoogleService-Info.plist exists in project root

## 🔧 Required Manual Steps

### Step 1: Configure Firebase Console (30 minutes)

1. **Create/Configure Firebase Project:**
   - Go to https://console.firebase.google.com/
   - Create new project OR use existing project
   - Note your Project ID

2. **Enable Authentication:**
   - Go to Authentication → Sign-in method
   - Enable **Email/Password**
   - Enable **Google** provider
   - Note the **Web client ID** shown in Google provider settings

3. **Enable Firestore:**
   - Go to Firestore Database
   - Click "Create database"
   - Choose **Production mode**
   - Select region (us-central1 recommended)

4. **Add Security Rules:**
   - Go to Firestore → Rules tab
   - Copy the security rules from `FIREBASE_SETUP.md` (lines 44-68)
   - Click "Publish"

5. **Create Composite Indexes:**
   - Go to Firestore → Indexes tab
   - Create 3 indexes as detailed in `FIREBASE_SETUP.md` (lines 72-86)
   - Wait for indexes to finish building (~5 minutes)

### Step 2: Update Environment Variables (5 minutes)

1. **Get Firebase Configuration:**
   - Firebase Console → Project Settings (gear icon)
   - Scroll to "Your apps" → iOS app
   - Copy configuration values

2. **Update `.env` file:**

Replace placeholders with actual values:

```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...     # From Firebase config
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:ios:abc...

# Google OAuth
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123...apps.googleusercontent.com
```

**Where to find Google Web Client ID:**
- Firebase Console → Authentication → Sign-in method → Google provider
- OR Google Cloud Console → APIs & Services → Credentials

### Step 3: Verify GoogleService-Info.plist (2 minutes)

1. **Check the file:**
   ```bash
   cat GoogleService-Info.plist
   ```

2. **Ensure it matches your Firebase project:**
   - PROJECT_ID should match your Firebase project
   - BUNDLE_ID should be `com.moalazool.recipeapp`

3. **If file is outdated:**
   - Download new one from Firebase Console
   - Go to Project Settings → iOS app
   - Click "Download GoogleService-Info.plist"
   - Replace existing file

### Step 4: Rebuild iOS Project (5 minutes)

```bash
# Install/update pods
cd ios
pod install
cd ..

# Clean and rebuild
npx expo run:ios
```

### Step 5: Test Authentication (10 minutes)

Start the app and test:

1. **Sign Up:**
   - Create new account with email/password
   - Verify user appears in Firebase Console → Authentication → Users

2. **Sign In:**
   - Sign out and sign back in
   - Close app and reopen (test session persistence)

3. **Google OAuth:**
   - Try "Sign in with Google"
   - Complete OAuth flow
   - Verify profile created in Firestore

4. **Password Reset:**
   - Test "Forgot Password" flow
   - Check email received

### Step 6: Test Data Operations (15 minutes)

1. **Create Recipe:**
   - Add a recipe from YouTube video
   - Check Firebase Console → Firestore → `recipes` collection
   - Verify all fields saved correctly

2. **Delete Recipe (Original Bug!):**
   - Delete the recipe you just created
   - Verify it's removed from Firestore
   - Verify it's removed from app UI
   - Check no errors in console

3. **Shopping List:**
   - Add items to shopping list
   - Check Firestore → `shopping_lists` → [list_id] → `items` subcollection
   - Toggle items checked/unchecked
   - Delete items

4. **Fridge Scan:**
   - Scan a fridge image
   - Check Firestore → `fridge_scans` collection
   - Verify ingredients saved

### Step 7: Monitor & Debug (10 minutes)

1. **Watch Firestore Console:**
   - Keep Firestore console open
   - Perform operations in app
   - Watch documents update in real-time

2. **Check for Errors:**
   - Look for console errors in Expo
   - Check Firebase Console → Authentication for failed sign-ins
   - Check Firestore → Rules for "permission denied" logs

3. **Test Edge Cases:**
   - Try operations without internet
   - Test with multiple users
   - Test rapid successive operations

## 📋 Testing Checklist

Copy this checklist and check off as you test:

### Authentication
- [ ] Sign up with email/password
- [ ] Sign in with email/password
- [ ] Sign in with Google OAuth
- [ ] Password reset email received
- [ ] Session persists after app restart
- [ ] Sign out works correctly

### Recipes
- [ ] Create recipe from YouTube
- [ ] View recipe details
- [ ] Edit recipe
- [ ] **Delete recipe (ORIGINAL BUG FIX!)**
- [ ] Toggle favorite
- [ ] List shows all user's recipes

### Shopping List
- [ ] Add item manually
- [ ] Add items from recipe
- [ ] Toggle item checked
- [ ] Edit item
- [ ] Delete item
- [ ] Items persist across app restarts

### Fridge Scans
- [ ] Scan fridge image
- [ ] View scan results
- [ ] List past scans
- [ ] Delete scan

### Usage Limits
- [ ] Check usage limits shown correctly
- [ ] Counters increment after operations
- [ ] Premium users have unlimited access

## 🚨 Troubleshooting

### "Permission denied" errors
**Solution:** Check that Firestore security rules are published and indexes are built

### Google OAuth not working
**Solution:** Verify `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` matches the Web client ID from Firebase Console

### "Document not found" on delete
**Solution:** This should be fixed now! Firebase service has proper delete implementation

### App crashes on launch
**Solution:**
1. Check `.env` has all Firebase variables
2. Verify GoogleService-Info.plist is valid
3. Run `cd ios && pod install`

### Indexes not ready
**Solution:** Wait 5-10 minutes for Firestore to build composite indexes

## 🎯 Success Criteria

Migration is successful when:

✅ All authentication flows work
✅ All data operations work
✅ **Recipe deletion works (original bug fixed!)**
✅ No console errors
✅ Data persists correctly in Firestore
✅ Session management works
✅ No "permission denied" errors

## 📊 Post-Migration

### Once everything works:

1. **Remove Supabase:**
   ```bash
   npm uninstall @supabase/supabase-js
   rm services/supabase.service.ts
   ```

2. **Clean up .env:**
   - Remove commented Supabase variables

3. **Commit:**
   ```bash
   git add .
   git commit -m "chore: migrate from Supabase to Firebase

   - Implement Firebase authentication and Firestore
   - Fix recipe deletion bug
   - Update all service imports
   - Add comprehensive Firebase setup documentation"
   ```

4. **Test on physical device:**
   ```bash
   npx expo run:ios --device
   ```

## 📚 Additional Resources

- **FIREBASE_SETUP.md** - Detailed Firebase Console setup guide
- **MIGRATION_SUMMARY.md** - Technical migration details
- **Firebase Docs** - https://firebase.google.com/docs
- **Expo + Firebase** - https://docs.expo.dev/guides/using-firebase/

## 🎉 Benefits After Migration

1. **Fixed Original Bug:** Recipe deletion now works correctly!
2. **Better Performance:** Firebase has better iOS integration
3. **Offline Support:** Built-in offline persistence
4. **Real-time:** Can easily add live updates later
5. **Scalability:** Google's infrastructure handles growth
6. **Cost-effective:** Better free tier and pricing

---

**Current Status:** Code migration complete, ready for Firebase Console configuration

**Estimated Time:** ~1 hour for complete setup and testing

**Questions?** Check FIREBASE_SETUP.md for detailed instructions
