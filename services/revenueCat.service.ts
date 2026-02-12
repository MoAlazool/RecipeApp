import Purchases, {
  CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  PurchasesOffering,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const APPLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || '';
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || '';
const IOS_MONTHLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID || '';
const IOS_YEARLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_YEARLY_PRODUCT_ID || '';
const ANDROID_MONTHLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID || '';
const ANDROID_YEARLY_PRODUCT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID || '';
const ENTITLEMENT_IDS = (
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_IDS || 'pro,premium,EITO Pro'
)
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

export type Plan = 'monthly' | 'yearly';

export type RevenueCatIssue =
  | 'MISSING_API_KEY'
  | 'MISSING_PRODUCT_IDS'
  | 'NO_CURRENT_OFFERING'
  | 'NO_MATCHING_PACKAGE'
  | 'NO_STORE_PRODUCTS';

export interface RevenueCatReadiness {
  isReady: boolean;
  issues: RevenueCatIssue[];
  offeringIdentifier: string | null;
  packageIdentifiers: string[];
  packageProductIds: string[];
  configuredProductIds: { monthly: string | null; yearly: string | null };
  candidateProductIds: string[];
  fetchedProductIds: string[];
}

class RevenueCatService {
  private initialized = false;
  private logHandlerInitialized = false;
  private listenerRemover: (() => void) | null = null;

  private async ensureInitialized(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.initialized;
  }

  private configureLogHandler() {
    if (this.logHandlerInitialized) return;

    Purchases.setLogHandler((level, message) => {
      const prefixedMessage = `[RevenueCat] ${message}`;

      // These errors are expected/transient — don't trigger a dev redbox.
      if (this.isOfferingsConfigurationError(message) || this.isPurchaseCancelled(message) || this.isNetworkError(message)) {
        console.warn(prefixedMessage);
        return;
      }

      if (level === LOG_LEVEL.ERROR) {
        console.error(prefixedMessage);
        return;
      }
      if (level === LOG_LEVEL.WARN) {
        console.warn(prefixedMessage);
        return;
      }
      if (level === LOG_LEVEL.INFO) {
        console.info(prefixedMessage);
        return;
      }
      if (__DEV__) {
        console.debug(prefixedMessage);
      }
    });

    this.logHandlerInitialized = true;
  }

  private getCurrentApiKey(): string {
    return Platform.OS === 'ios' ? APPLE_API_KEY : GOOGLE_API_KEY;
  }

  private getCurrentProductIds() {
    const isIOS = Platform.OS === 'ios';
    const monthly = isIOS ? IOS_MONTHLY_PRODUCT_ID : ANDROID_MONTHLY_PRODUCT_ID;
    const yearly = isIOS ? IOS_YEARLY_PRODUCT_ID : ANDROID_YEARLY_PRODUCT_ID;

    return {
      monthly: monthly || null,
      yearly: yearly || null,
    };
  }

  private getCandidateProductIds(plan: Plan): string[] {
    const ids = this.getCurrentProductIds();
    const selectedId = plan === 'yearly' ? ids.yearly : ids.monthly;
    return selectedId ? [selectedId] : [];
  }

  private isPurchaseCancelled(errorOrMessage: unknown): boolean {
    const message = String(errorOrMessage || '').toLowerCase();
    return message.includes('purchase was cancelled') || message.includes('purchase was canceled');
  }

  private isNetworkError(errorOrMessage: unknown): boolean {
    const message = String(errorOrMessage || '').toLowerCase();
    return (
      message.includes('network error') ||
      message.includes('network connection was lost') ||
      message.includes('network request failed') ||
      message.includes('the internet connection appears to be offline')
    );
  }

  private isOfferingsConfigurationError(errorOrMessage: unknown): boolean {
    const message = String(errorOrMessage || '').toLowerCase();
    return (
      message.includes('error fetching offerings') ||
      message.includes('none of the products registered in the revenuecat dashboard') ||
      message.includes('offeringsmanager.error')
    );
  }

  private logOfferingsConfigHint() {
    const { monthly, yearly } = this.getCurrentProductIds();
    const platform = Platform.OS === 'ios' ? 'iOS' : 'Android';
    console.warn(
      `RevenueCat offerings are empty for ${platform}. Verify product IDs in RevenueCat/App Store Connect/StoreKit match exactly: "${monthly ?? 'missing'}", "${yearly ?? 'missing'}".`
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.configureLogHandler();

      const alreadyConfigured = await Purchases.isConfigured();
      if (alreadyConfigured) {
        this.initialized = true;
        return;
      }

      const apiKey = this.getCurrentApiKey();

      if (!apiKey) {
        console.warn('RevenueCat API key not configured');
        return;
      }

      Purchases.configure({
        apiKey,
        diagnosticsEnabled: __DEV__,
      });
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
    }
  }

  async login(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
    } catch (error: any) {
      // Network errors are transient — don't surface as hard errors
      if (this.isNetworkError(error?.message || error)) {
        console.warn('RevenueCat login deferred (network unavailable)');
      } else {
        console.error('RevenueCat login failed:', error);
      }
    }
  }

  async logout(): Promise<void> {
    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('RevenueCat logout failed:', error);
    }
  }

  async getOfferings(retryCount = 0): Promise<PurchasesOffering | null> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return null;

    try {
      let offerings = await Purchases.getOfferings();
      if (!offerings.current) {
        // Pull fresh offerings in case dashboard mappings changed recently.
        offerings = await Purchases.syncAttributesAndOfferingsIfNeeded();
      }
      if (!offerings.current && retryCount < 2) {
        // SDK may not be fully synced yet — wait and retry
        await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
        return this.getOfferings(retryCount + 1);
      }
      if (!offerings.current) {
        this.logOfferingsConfigHint();
      }
      return offerings.current;
    } catch (error: any) {
      if (
        error?.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR ||
        this.isOfferingsConfigurationError(error?.message || error)
      ) {
        this.logOfferingsConfigHint();
        console.warn('Failed to get offerings (configuration issue):', error);
        return null;
      }
      console.error('Failed to get offerings:', error);
      return null;
    }
  }

  async purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return false;

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return this.checkPremiumStatus(customerInfo);
    } catch (error: any) {
      if (error.userCancelled) {
        return false;
      }
      throw error;
    }
  }

  getPackageForPlan(
    offering: PurchasesOffering,
    plan: Plan
  ): PurchasesPackage | null {
    return this.resolvePackageForPlan(offering, plan);
  }

  private resolvePackageForPlan(
    offering: PurchasesOffering,
    plan: Plan
  ): PurchasesPackage | null {
    const packageTypeMatch = offering.availablePackages.find((pkg) =>
      plan === 'yearly' ? pkg.packageType === 'ANNUAL' : pkg.packageType === 'MONTHLY'
    );
    if (packageTypeMatch) return packageTypeMatch;

    const rcIdentifierMatch = offering.availablePackages.find((pkg) =>
      plan === 'yearly'
        ? pkg.identifier === '$rc_annual'
        : pkg.identifier === '$rc_monthly'
    );
    if (rcIdentifierMatch) return rcIdentifierMatch;

    const ids = this.getCurrentProductIds();
    const configuredProductId = plan === 'yearly' ? ids.yearly : ids.monthly;
    if (configuredProductId) {
      const configuredIdMatch = offering.availablePackages.find(
        (pkg) => pkg.product.identifier === configuredProductId
      );
      if (configuredIdMatch) return configuredIdMatch;
    }

    const pattern = plan === 'yearly' ? /(year|annual)/i : /month/i;
    const heuristicMatch = offering.availablePackages.find((pkg) =>
      pattern.test(pkg.product.identifier)
    );
    return heuristicMatch || null;
  }

  async getFallbackProductForPlan(plan: Plan): Promise<PurchasesStoreProduct | null> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return null;

    try {
      const candidateProductIds = this.getCandidateProductIds(plan);
      if (!candidateProductIds.length) {
        console.warn('RevenueCat fallback fetch skipped: missing product ID configuration');
        return null;
      }

      const primaryProductId = candidateProductIds[0];
      const products = await Purchases.getProducts(
        candidateProductIds,
        Purchases.PRODUCT_CATEGORY.SUBSCRIPTION
      );
      if (!products.length) {
        console.warn(
          `No store products returned for candidate IDs (${Platform.OS}): ${candidateProductIds.join(', ')}`
        );
      }

      return (
        products.find((product) => product.identifier === primaryProductId) ||
        products[0] ||
        null
      );
    } catch (error: any) {
      if (
        error?.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR ||
        this.isOfferingsConfigurationError(error?.message || error)
      ) {
        this.logOfferingsConfigHint();
        console.warn('Failed to fetch fallback store product (configuration issue):', error);
        return null;
      }
      console.error('Failed to fetch fallback store product:', error);
      return null;
    }
  }

  async getPurchaseReadiness(plan: Plan): Promise<RevenueCatReadiness> {
    const issues = new Set<RevenueCatIssue>();
    const apiKey = this.getCurrentApiKey();
    const configuredProductIds = this.getCurrentProductIds();

    if (!apiKey) {
      issues.add('MISSING_API_KEY');
    }
    if (!configuredProductIds.monthly || !configuredProductIds.yearly) {
      issues.add('MISSING_PRODUCT_IDS');
    }

    const candidateProductIds = this.getCandidateProductIds(plan);
    const readiness: RevenueCatReadiness = {
      isReady: false,
      issues: [],
      offeringIdentifier: null,
      packageIdentifiers: [],
      packageProductIds: [],
      configuredProductIds,
      candidateProductIds,
      fetchedProductIds: [],
    };

    const isReady = await this.ensureInitialized();
    if (!isReady) {
      readiness.issues = Array.from(issues);
      readiness.isReady = readiness.issues.length === 0;
      return readiness;
    }

    const offering = await this.getOfferings();
    if (!offering) {
      issues.add('NO_CURRENT_OFFERING');
    } else {
      readiness.offeringIdentifier = offering.identifier;
      readiness.packageIdentifiers = offering.availablePackages.map((pkg) => pkg.identifier);
      readiness.packageProductIds = offering.availablePackages.map((pkg) => pkg.product.identifier);

      if (!this.resolvePackageForPlan(offering, plan)) {
        issues.add('NO_MATCHING_PACKAGE');
      }
    }

    if (candidateProductIds.length) {
      try {
        const products = await Purchases.getProducts(
          candidateProductIds,
          Purchases.PRODUCT_CATEGORY.SUBSCRIPTION
        );
        readiness.fetchedProductIds = products.map((product) => product.identifier);
        if (!products.length) {
          issues.add('NO_STORE_PRODUCTS');
        }
      } catch (error) {
        console.warn('RevenueCat readiness check failed to fetch products:', error);
        issues.add('NO_STORE_PRODUCTS');
      }
    }

    readiness.issues = Array.from(issues);
    readiness.isReady = readiness.issues.length === 0;
    return readiness;
  }

  async purchaseStoreProduct(product: PurchasesStoreProduct): Promise<boolean> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return false;

    try {
      const { customerInfo } = await Purchases.purchaseStoreProduct(product);
      return this.checkPremiumStatus(customerInfo);
    } catch (error: any) {
      if (error.userCancelled) {
        return false;
      }
      throw error;
    }
  }

  async restorePurchases(): Promise<boolean> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return false;

    try {
      const customerInfo = await Purchases.restorePurchases();
      return this.checkPremiumStatus(customerInfo);
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      return false;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo | null> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return null;

    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('Failed to get customer info:', error);
      return null;
    }
  }

  async isPremium(): Promise<boolean> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return false;

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return this.checkPremiumStatus(customerInfo);
    } catch (error) {
      console.error('Failed to check premium status:', error);
      return false;
    }
  }

  addPremiumStatusListener(
    callback: (customerInfo: CustomerInfo) => void
  ): () => void {
    this.removePremiumStatusListener();
    Purchases.addCustomerInfoUpdateListener(callback);
    this.listenerRemover = () => {
      Purchases.removeCustomerInfoUpdateListener(callback);
    };
    return this.listenerRemover;
  }

  removePremiumStatusListener(): void {
    if (this.listenerRemover) {
      this.listenerRemover();
      this.listenerRemover = null;
    }
  }

  async checkTrialEligibility(
    productIds: string[]
  ): Promise<boolean> {
    const isReady = await this.ensureInitialized();
    if (!isReady) return true; // default to eligible if RC not ready

    try {
      const eligibilityMap =
        await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
      return Object.values(eligibilityMap).some(
        (result) =>
          result.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
      );
    } catch (error) {
      console.warn('Failed to check trial eligibility:', error);
      return true; // default to eligible on error
    }
  }

  getExpirationDate(customerInfo: CustomerInfo): string | null {
    for (const entitlementId of ENTITLEMENT_IDS) {
      const entitlement = customerInfo.entitlements.active[entitlementId];
      if (entitlement?.expirationDate) {
        return entitlement.expirationDate;
      }
    }
    return null;
  }

  hasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
    return this.checkPremiumStatus(customerInfo);
  }

  private checkPremiumStatus(customerInfo: CustomerInfo): boolean {
    const activeEntitlementIds = Object.keys(customerInfo.entitlements.active || {});
    return activeEntitlementIds.some((activeId) =>
      ENTITLEMENT_IDS.some((expectedId) => expectedId.toLowerCase() === activeId.toLowerCase())
    );
  }
}

export const revenueCatService = new RevenueCatService();
export default RevenueCatService;
