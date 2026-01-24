# Firebase Migration Checklist

Quick checklist for completing the Firebase migration.

## ✅ Code Changes (DONE)

- [x] Created firebase.service.ts with full Supabase API compatibility
- [x] Updated authStore.ts imports and service calls
- [x] Updated recipeStore.ts imports and service calls
- [x] Updated shoppingStore.ts imports and service calls
- [x] Updated app/auth/index.tsx imports
- [x] Updated app/fridge-review.tsx imports
- [x] Installed Firebase SDK (npm install firebase)
- [x] Updated .env with Firebase config from GoogleService-Info.plist
- [x] Updated app.json with googleServicesFile path
- [x] Verified GoogleService-Info.plist exists (Project: recipeapp-dcb62)
- [x] iOS pods installing

## ⏳ Firebase Console Setup (TODO)

### 1. Update .env with Web Client ID
- [ ] Go to Firebase Console → Authentication → Google provider
- [ ] Copy Web client ID
- [ ] Update `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in .env

### 2. Enable Firestore
- [ ] Go to https://console.firebase.google.com/project/recipeapp-dcb62/firestore
- [ ] Click "Create database" (if not already created)
- [ ] Choose Production mode
- [ ] Select location (us-central1 recommended)

### 3. Add Security Rules
- [ ] Go to Firestore → Rules tab
- [ ] Copy rules from FIREBASE_QUICKSTART.md
- [ ] Click "Publish"

### 4. Create Composite Indexes
- [ ] Go to Firestore → Indexes tab
- [ ] Create index: recipes (user_id ASC, created_at DESC)
- [ ] Create index: shopping_lists (user_id ASC, is_active ASC)
- [ ] Create index: fridge_scans (user_id ASC, created_at DESC)
- [ ] Wait for indexes to build (~5 minutes)

### 5. Enable Authentication
- [ ] Go to Authentication → Sign-in method
- [ ] Enable Email/Password
- [ ] Enable Google (select support email)

## 🧪 Testing (TODO)

### Authentication
- [ ] Sign up with email/password
- [ ] Sign in with credentials
- [ ] Sign in with Google OAuth
- [ ] Test password reset
- [ ] Test session persistence (close/reopen app)
- [ ] Test sign out

### Recipes
- [ ] Create recipe from YouTube video
- [ ] View recipe in list
- [ ] Open recipe details
- [ ] Edit recipe
- [ ] **Delete recipe (THE BUG FIX!)**
- [ ] Toggle favorite
- [ ] Verify all data in Firestore console

### Shopping List
- [ ] Add item manually
- [ ] Add items from recipe
- [ ] Toggle item checked
- [ ] Delete item
- [ ] Clear checked items
- [ ] Verify subcollection in Firestore

### Fridge Scan
- [ ] Scan fridge image
- [ ] Review detected ingredients
- [ ] Save scan
- [ ] View past scans
- [ ] Delete scan
- [ ] Verify in Firestore console

### Edge Cases
- [ ] Test offline mode
- [ ] Test with multiple users
- [ ] Test rapid operations
- [ ] Test special characters in data
- [ ] Test empty states

## 📊 Verification

### Firestore Console Checks
- [ ] Users collection has test user
- [ ] Recipes collection has test recipes
- [ ] Shopping_lists collection exists
- [ ] Shopping_lists/{id}/items subcollection has items
- [ ] Fridge_scans collection has test scans
- [ ] All timestamps are ISO strings
- [ ] All user_id fields match authenticated user

### Authentication Console Checks
- [ ] Test users appear in Authentication → Users
- [ ] Email/Password provider shows enabled
- [ ] Google provider shows enabled
- [ ] No failed sign-in attempts

### App Behavior
- [ ] No console errors
- [ ] No permission denied errors
- [ ] Data loads correctly
- [ ] Data saves correctly
- [ ] Data updates in real-time (after refresh)
- [ ] Session persists across app restarts

## 🎯 Success Criteria

Migration is complete when ALL of these are true:

✅ All Firebase Console setup steps complete
✅ All authentication methods working
✅ All CRUD operations working
✅ Recipe deletion working (original bug fixed!)
✅ Shopping list sync working
✅ Fridge scans working
✅ No errors in console
✅ No errors in Firebase Console
✅ Data visible in Firestore
✅ Session management working

## 📈 Next Steps After Success

- [ ] Test on physical iOS device
- [ ] Remove Supabase: `npm uninstall @supabase/supabase-js`
- [ ] Delete services/supabase.service.ts
- [ ] Clean up .env (remove Supabase vars)
- [ ] Commit changes
- [ ] Deploy to TestFlight/App Store

## ⚡ Quick Commands

```bash
# Start the app
npx expo run:ios

# Check Firestore data (in browser)
open https://console.firebase.google.com/project/recipeapp-dcb62/firestore

# Check Authentication (in browser)
open https://console.firebase.google.com/project/recipeapp-dcb62/authentication

# View logs
npx expo start

# Rebuild iOS
cd ios && pod install && cd .. && npx expo run:ios
```

## 🆘 If Something Goes Wrong

**Can't sign in:**
- Check Firebase Auth is enabled
- Check .env has correct values
- Check GoogleService-Info.plist exists

**Permission denied on data operations:**
- Check Firestore security rules are published
- Check indexes are built (not "Building...")
- Check user is authenticated

**Google OAuth not working:**
- Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is Web client (not iOS)
- Check URL scheme matches in app.json

**Need to rollback:**
See "Rollback Plan" in README_FIREBASE_MIGRATION.md

---

**Current Status:** Code complete, ready for Firebase Console setup

**Time Required:** ~45 minutes setup + 15 minutes testing = 1 hour total

**Start Here:** FIREBASE_QUICKSTART.md
