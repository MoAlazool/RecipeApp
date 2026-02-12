# Recipe App

تطبيق Recipe App يحوّل فيديوهات الطبخ وصور الثلاجة إلى وصفات قابلة للاستخدام عبر الذكاء الاصطناعي.

## الفكرة باختصار
- لصق رابط YouTube/TikTok/Instagram لاستخراج المكونات والخطوات تلقائيًا.
- تصوير ما في الثلاجة للحصول على أفكار وصفات بناءً على المتاح.
- إنشاء قوائم تسوّق ذكية من الوصفات.
- وضع طبخ يوجّهك خطوة بخطوة مع مؤقّتات.
- اشتراكات مدفوعة لميزات احترافية عبر RevenueCat.

## المزايا الأساسية
- **Video → Recipe**: استخراج مكونات وخطوات من فيديوهات الطبخ.
- **Fridge Scan**: تحليل صورة الثلاجة واقتراح وصفات.
- **Smart Shopping List**: قوائم تسوّق مجمّعة حسب الفئة.
- **Cooking Mode**: وضع طبخ مع قراءة صوتية ومؤقّتات.
- **Auth + Profile**: تسجيل دخول ببريد إلكتروني أو Google.
- **Paywall**: اشتراكات شهرية/سنوية عبر RevenueCat.

## التقنيات المستخدمة

**TL;DR Tech Stack:**
React Native (Expo) + TypeScript + Supabase + Google Gemini AI + RevenueCat + Zustand

---

### 🎯 Core Framework & Language
- **React Native** `0.81.5` - Cross-platform mobile development
- **React** `19.1.0` - UI library
- **TypeScript** `5.9.2` - Type safety and developer experience
- **Expo SDK** `54` - Development platform and tooling

### 🎨 UI & Styling
- **React Native Elements** (`@rneui/themed`) - Pre-built UI components
- **Expo Linear Gradient** - Gradient styling
- **Expo Blur** - Blur effects
- **React Native SVG** - Vector graphics
- **React Native Gesture Handler** - Touch interactions
- **React Native Reanimated** `4.1.1` - Smooth animations
- **React Native Worklets** - High-performance animations
- **@gorhom/bottom-sheet** - Bottom sheet modals
- **Custom Fonts**: Plus Jakarta Sans, Noto Sans (Arabic support)

### 🧭 Navigation & Routing
- **Expo Router** `6.0.21` - File-based routing system
- **React Native Screens** - Native navigation primitives
- **React Native Safe Area Context** - Safe area handling

### 🗄️ State Management & Storage
- **Zustand** `5.0.0` - Lightweight state management
- **AsyncStorage** - Local persistent storage
- **Expo FileSystem** - File management

### 🔧 Backend & Database
- **Supabase** `2.45.0` - PostgreSQL database + Auth + Storage
- **Axios** `1.7.0` - HTTP client for API calls

### 🤖 AI & Machine Learning
- **Google Gemini AI** (`@google/generative-ai` v0.17.0)
  - Model: `gemini-2.5-flash`
  - Recipe extraction from video transcripts
  - Image analysis for fridge scanning
  - Smart recipe recommendations
- **Custom AI Prompts** - Structured JSON responses

### 🔐 Authentication
- **Supabase Auth** - Email/password and OAuth
- **Expo Auth Session** - OAuth flow handling
- **Expo Web Browser** - In-app browser for auth

### 💳 Payments & Monetization
- **RevenueCat** (`react-native-purchases` v8.2.0)
  - Subscription management
  - Apple and Google Play billing
  - Paywall implementation

### 📸 Media & Camera
- **Expo Camera** - Camera access and capture
- **Expo Image Picker** - Gallery access
- **Expo Image** - Optimized image rendering
- **Expo AV** - Audio/video playback

### 🔔 Notifications & Background
- **Expo Notifications** - Push notifications
- **Expo Speech** - Text-to-speech for cooking mode
- **Expo Live Activity** `0.4.2` - iOS Live Activities (cooking timers)

### 🛠️ Development Tools
- **Expo Dev Client** - Custom development builds
- **Expo Constants** - Environment variables
- **Expo Crypto** - Cryptographic functions
- **Expo Linking** - Deep linking
- **Date-fns** - Date manipulation
- **ESLint** - Code linting

### 🎥 Optional Backend Service
- **FastAPI** (Python) - YouTube transcript extraction service
- Deployed separately for fetching video transcripts

---

## 💡 Why This Stack?

| Technology | Reason |
|-----------|--------|
| **Expo** | Fastest way to build and deploy React Native apps with over-the-air updates |
| **TypeScript** | Type safety prevents bugs and improves developer experience |
| **Supabase** | Open-source Firebase alternative with PostgreSQL, instant APIs, and auth |
| **Gemini AI** | Free tier, fast responses, multimodal (text + images), structured JSON output |
| **RevenueCat** | Handles subscription complexity across iOS/Android without backend code |
| **Zustand** | Simplest state management, no boilerplate, great TypeScript support |
| **Expo Router** | File-based routing like Next.js, SEO-friendly, deep linking built-in |

---

## 📚 Documentation
Project guides and migration notes live in `docs/`:
- `docs/PROJECT_GUIDE.md`
- `docs/README_FIREBASE_MIGRATION.md`
- `docs/FIREBASE_QUICKSTART.md`
- `docs/FIREBASE_SETUP.md`
- `docs/MIGRATION_SUMMARY.md`
- `docs/MIGRATION_CHECKLIST.md`
- `docs/NEXT_STEPS.md`
- `docs/DEVELOPER_GUIDE_FRIDGE_SCAN.md`
- `docs/FRIDGE_SCAN_ENHANCEMENT_SUMMARY.md`
- `docs/PANTRY_AI_CHEF_GUIDE.md`
- `docs/FIRESTORE_SECURITY_RULES_UPDATED.md`
- `docs/DELETE_RECIPE_GUIDE.md`

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App (Expo)                  │
│                                                              │
│  ┌────────────┐   ┌────────────┐   ┌──────────────────┐    │
│  │   Screens  │   │    UI      │   │   Navigation     │    │
│  │  (Router)  │───│ Components │───│  (Expo Router)   │    │
│  └────────────┘   └────────────┘   └──────────────────┘    │
│         │                                     │              │
│         └─────────────────┬───────────────────┘              │
│                           │                                  │
│                  ┌────────▼────────┐                         │
│                  │  State Stores   │                         │
│                  │   (Zustand)     │                         │
│                  └────────┬────────┘                         │
│                           │                                  │
│         ┌─────────────────┴─────────────────┐               │
│         │                                    │               │
│    ┌────▼─────┐                      ┌──────▼──────┐        │
│    │ Services │                      │  AsyncStorage│       │
│    └────┬─────┘                      └─────────────┘        │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
    ┌─────┴──────────────────────────────────┐
    │                                         │
┌───▼─────────┐  ┌──────────────┐  ┌────────▼────────┐
│  Supabase   │  │ Gemini AI    │  │   RevenueCat    │
│  (Backend)  │  │ (AI Models)  │  │   (Payments)    │
│             │  │              │  │                 │
│ • Auth      │  │ • Extraction │  │ • Subscriptions │
│ • Database  │  │ • Analysis   │  │ • Paywalls      │
│ • Storage   │  │ • Suggestions│  │ • Receipts      │
└─────────────┘  └──────────────┘  └─────────────────┘
```

## نظرة معمارية سريعة
تدفق البيانات الأساسي:
- شاشات الواجهة في `app/` → تتعامل مع `stores/` → وتستدعي التكاملات في `services/`.
- طبقة `services/` هي الحد الفاصل مع العالم الخارجي (Supabase، Gemini، الشبكات الاجتماعية، RevenueCat).
- الذكاء الاصطناعي يعيد JSON منظّم، ويُعرض للمستخدم قبل الحفظ.

## التوجيه والتنقّل (Expo Router)
- `app/index.tsx`: توجيه حسب حالة تسجيل الدخول.
- `app/_layout.tsx`: تحميل الثيم والخطوط والملاحة الأساسية.

### تبويبات التطبيق `app/(tabs)/`
- `index.tsx`: صفحة الوصفات الرئيسية.
- `add.tsx`: إضافة وصفات (رابط/إدخال يدوي).
- `shopping.tsx`: قائمة التسوّق.
- `profile.tsx`: الملف الشخصي والاشتراك.

### شاشات مستقلة
- `welcome.tsx`: شاشة ترحيب.
- `onboarding.tsx`: شرائح تعريفية.
- `auth/index.tsx`: تسجيل الدخول/التسجيل.
- `auth/callback.tsx`: رد OAuth.
- `add-recipe.tsx`: مسار استخراج الوصفة.
- `recipe/[id].tsx`: تفاصيل الوصفة.
- `cooking/[id].tsx`: وضع الطبخ.
- `fridge-scan.tsx`: تصوير الثلاجة.
- `fridge-review.tsx`: مراجعة العناصر المكتشفة.
- `recipe-results.tsx`: نتائج وصفات من عناصر الثلاجة.
- `paywall.tsx`: صفحة الاشتراكات.

## مسارات الاستخدام (User Flows)
### 1) فيديو → وصفة
1. المستخدم يفتح تبويب الإضافة.
2. `app/add-recipe.tsx` يستدعي `socialService.extractRecipe()`.
3. بناءً على المنصة:
   - YouTube: جلب النص ثم `aiService.extractRecipeFromTranscript()`.
   - TikTok/Instagram: استخراج الوصف ثم `aiService.extractRecipeFromDescription()`.
4. في حال الفشل، يوجد إدخال يدوي و/أو fallback بصري.
5. معاينة الوصفة عبر `components/recipe/RecipePreview.tsx`.
6. الحفظ عبر `stores/recipeStore.addRecipe()` ثم Supabase.

### 2) تصوير الثلاجة → اقتراحات وصفات
1. التقاط صورة في `app/fridge-scan.tsx`.
2. التحويل إلى base64 ثم `aiService.analyzeFridgeImage()`.
3. مراجعة النتائج في `app/fridge-review.tsx`.
4. توليد وصفات في `app/recipe-results.tsx` عبر `aiService.suggestRecipesFromIngredients()`.

ملاحظة: شاشة `recipe-results.tsx` تستخدم بطاقات UI فقط ولا تحفظ النتائج في Supabase حاليًا.

### 3) وضع الطبخ
- من صفحة الوصفة، يبدأ المستخدم جلسة الطبخ.
- يتم تشغيل مؤقّتات ونطق الخطوات باستخدام `stores/cookingStore` و `expo-speech`.

### 4) قائمة التسوّق
- يمكن إضافة مكونات وصفة كاملة إلى قائمة التسوّق.
- العناصر تُجمّع حسب الفئة وتدعم الحذف والإكمال.

## إدارة الحالة (Zustand)
- `stores/authStore.ts`: الجلسة والملف الشخصي.
- `stores/recipeStore.ts`: الوصفات والمفضلة والكاش.
- `stores/shoppingStore.ts`: قوائم التسوّق والعناصر.
- `stores/cookingStore.ts`: جلسات الطبخ والمؤقّتات.

## الخدمات (Integrations)
- `services/ai.service.ts`: تكامل Gemini وتحليل JSON.
- `services/social.service.ts`: منسّق استخراج الوصفات حسب المنصة.
- `services/youtube.service.ts`: نصوص ومعلومات الفيديو.
- `services/tiktok.service.ts`: بيانات TikTok.
- `services/instagram.service.ts`: تحليل OpenGraph.
- `services/supabase.service.ts`: auth + بيانات.
- `services/revenueCat.service.ts`: اشتراكات ومدفوعات.

## نموذج البيانات (Supabase)
جداول متوقعة:
- `profiles`: بيانات المستخدم.
- `recipes`: الوصفات.
- `shopping_lists` و `shopping_items`.
- `fridge_scans`: نتائج مسح الثلاجة.

الأنواع الأساسية موجودة في `utils/types.ts`.

## طبقة الذكاء الاصطناعي
- نموذج Gemini المستخدم: `gemini-2.5-flash`.
- الـ Prompts في `utils/prompts.ts` تفرض JSON منظّم.
- يوجد إصلاح تلقائي للـ JSON عند الحاجة.

## المكونات (UI)
أمثلة على المكونات المهمة:
- Recipe: `RecipeCard`, `RecipePreview`, `IngredientList`, `StepList`.
- Cooking: `CookingProgress`, `CookingTimer`.
- Shopping: `AddItemModal`.
- UX: `EmptyState`, `LoadingOverlay`.

## Hooks
- `hooks/useTimer.ts`: عدّاد تنازلي.
- `hooks/useVoiceRecognition.ts`: نطق صوتي (وتمهيد للتعرّف الصوتي).

## السيرفر الاختياري (YouTube Transcript API)
المسار: `server/transcript-api/`
- خدمة FastAPI لجلب نصوص YouTube.
- تُستخدم عند تعذر استخراج النص مباشرة.

## الإعداد والتشغيل
```bash
npm install
cp .env.example .env
npm start
```

## الأوامر الشائعة
```bash
npm start
npm run ios
npm run android
npm run web
npm run lint
npm run type-check
```

## متغيرات البيئة
```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GEMINI_API_KEY=your-gemini-key
EXPO_PUBLIC_TRANSCRIPT_API_URL=your-transcript-api
EXPO_PUBLIC_REVENUECAT_APPLE_KEY=your-rc-apple-key
EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=your-rc-google-key
EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID=EITO_monthly
EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID=EITO_yearly
EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID=EITO_monthly
EXPO_PUBLIC_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID=EITO_yearly
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS=pro,premium,EITO Pro
```

## ملاحظات مهمة
- متغيرات `EXPO_PUBLIC_*` تُضمَّن وقت البناء، لا تُخزّن أسرارًا داخلها.
- ملف `.env` المحلي لا يُعتمد عليه تلقائيًا في TestFlight/EAS. استخدم متغيرات البيئة في EAS (أو تأكد من تحميلها داخل أرشفة Xcode) قبل رفع build.
- خدمة النصوص اختيارية لكنها تحسن استخراج وصفات YouTube.
- يجب أن تتطابق معرفات منتجات الاشتراك حرفيًا بين RevenueCat وApp Store Connect و`ios/Products.storekit`.

## الهيكل العام للمجلدات
```
app/                  # شاشات Expo Router
components/           # مكونات UI
services/             # تكاملات خارجية
stores/               # Zustand state
utils/                # أنواع ومساعدات
assets/               # صور وأيقونات
server/transcript-api # خدمة نصوص YouTube الاختيارية
```

## الرخصة
MIT
