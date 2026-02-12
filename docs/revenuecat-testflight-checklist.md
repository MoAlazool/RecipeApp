# RevenueCat TestFlight Preflight Checklist

Use this checklist before shipping a TestFlight build that contains subscriptions.

## 1) RevenueCat Dashboard
- [ ] App is created for iOS and mapped to bundle ID: `com.moalazool.recipeapp`.
- [ ] Product Catalog contains `EITO_monthly` and `EITO_yearly`.
- [ ] Default offering is active.
- [ ] Default offering contains both monthly and yearly packages.
- [ ] Entitlement exists and is included in `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS`.

## 2) App Store Connect
- [ ] `EITO_monthly` and `EITO_yearly` exist as Auto-Renewable Subscriptions.
- [ ] Both products are in the correct subscription group.
- [ ] Product IDs match RevenueCat exactly (case-sensitive).
- [ ] Products are in a valid state for sandbox/TestFlight (metadata complete as required).

## 3) Build-Time Environment
- [ ] `EXPO_PUBLIC_REVENUECAT_APPLE_KEY` is set for the exact build profile used.
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID=EITO_monthly`.
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID=EITO_yearly`.
- [ ] `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS` matches dashboard entitlement names.
- [ ] If using EAS Build/TestFlight, env vars are configured in EAS (not only local `.env`).
- [ ] If archiving from Xcode locally, verify env is loaded in archive/bundle step.

## 4) Local Sanity Checks
- [ ] `npm run type-check` passes.
- [ ] `npm run lint` passes (or known unrelated warnings are documented).
- [ ] Paywall displays dynamic App Store prices (not only hardcoded defaults).

## 5) TestFlight Validation
- [ ] Install fresh TestFlight build on physical device.
- [ ] Open paywall and verify monthly/yearly plans can be selected.
- [ ] Complete a monthly purchase and confirm entitlement unlocks premium features.
- [ ] Repeat with yearly purchase (or on separate tester account/device).
- [ ] Test "Restore Purchases" and confirm premium state restores correctly.
- [ ] Review startup logs for `[RevenueCat] Startup purchase readiness` and ensure no critical issues.
