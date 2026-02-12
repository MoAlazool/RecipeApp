import Expo
import React
import ReactAppDependencyProvider
import WidgetKit

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  private let mealPlanWidgetGroupIdentifier = "group.com.moalazool.recipeapp"
  private let mealPlanWidgetStorageKey = "mealPlanWidgetWeekV1"
  private let mealPlanWidgetUpdatedAtKey = "mealPlanWidgetUpdatedAt"
  private let savedRecipesWidgetStorageKey = "savedRecipesWidgetV1"
  private let savedRecipesWidgetUpdatedAtKey = "savedRecipesWidgetUpdatedAt"

  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if handleWidgetSync(url: url) {
      return true
    }

    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  private func handleWidgetSync(url: URL) -> Bool {
    guard let host = url.host else {
      return false
    }

    let target: (storageKey: String, updatedAtKey: String, widgetKinds: [String])?
    switch host {
    case "widget-sync":
      target = (mealPlanWidgetStorageKey, mealPlanWidgetUpdatedAtKey, ["MealPlanWeekWidget", "MealPlanTodayWidget"])
    case "widget-sync-saved":
      target = (savedRecipesWidgetStorageKey, savedRecipesWidgetUpdatedAtKey, ["SavedRecipesWidget"])
    default:
      target = nil
    }

    guard let target else {
      return false
    }

    guard
      let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      let payload = components.queryItems?.first(where: { $0.name == "payload" })?.value,
      let defaults = UserDefaults(suiteName: mealPlanWidgetGroupIdentifier)
    else {
      return true
    }

    guard
      let payloadData = payload.data(using: .utf8),
      let json = try? JSONSerialization.jsonObject(with: payloadData),
      JSONSerialization.isValidJSONObject(json),
      let normalizedData = try? JSONSerialization.data(withJSONObject: json, options: []),
      let normalizedString = String(data: normalizedData, encoding: .utf8)
    else {
      return true
    }

    defaults.set(normalizedString, forKey: target.storageKey)
    defaults.set(Date().timeIntervalSince1970, forKey: target.updatedAtKey)

    if #available(iOS 14.0, *) {
      for kind in target.widgetKinds {
        WidgetCenter.shared.reloadTimelines(ofKind: kind)
      }
    }

    return true
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
