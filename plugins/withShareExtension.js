const { withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const plist = require("@expo/plist");
const util = require("util");

const TARGET_NAME = "ShareExtension";
const GROUP_NAME = "Embed App Extensions";
const DEPLOYMENT_TARGET = "16.0";

// ---------------------------------------------------------------------------
// Swift source for the Share Extension view controller
// ---------------------------------------------------------------------------
const SWIFT_SOURCE = `import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private var didProcess = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        view.isOpaque = false
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didProcess else { return }
        didProcess = true
        extractSharedURL { [weak self] url in
            self?.finishWithURL(url)
        }
    }

    // MARK: - Extract shared content

    private func extractSharedURL(completion: @escaping (URL?) -> Void) {
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else {
            completion(nil)
            return
        }

        for item in items {
            guard let attachments = item.attachments else { continue }
            for provider in attachments {
                let urlTypes: [UTType] = [.url, .fileURL]
                for type in urlTypes {
                    if provider.hasItemConformingToTypeIdentifier(type.identifier) {
                        provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { data, _ in
                            DispatchQueue.main.async {
                                if let url = data as? URL {
                                    completion(url)
                                } else if let str = data as? String, let url = URL(string: str) {
                                    completion(url)
                                } else {
                                    completion(nil)
                                }
                            }
                        }
                        return
                    }
                }

                let textTypes: [UTType] = [.plainText, .text]
                for type in textTypes {
                    if provider.hasItemConformingToTypeIdentifier(type.identifier) {
                        provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { data, _ in
                            DispatchQueue.main.async {
                                if let text = data as? String {
                                    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
                                    let range = NSRange(text.startIndex..., in: text)
                                    completion(detector?.firstMatch(in: text, options: [], range: range)?.url)
                                } else {
                                    completion(nil)
                                }
                            }
                        }
                        return
                    }
                }
            }
        }

        completion(nil)
    }

    // MARK: - Open main app via deep link

    private func openMainApp(with sharedURL: URL) {
        var components = URLComponents()
        components.scheme = "recipeapp"
        components.host = "add-recipe"
        components.queryItems = [
            URLQueryItem(name: "url", value: sharedURL.absoluteString),
            URLQueryItem(name: "autoExtract", value: "1"),
        ]
        guard let deepLink = components.url else { return }

        // Primary: Apple's extension API (available iOS 8+).
        extensionContext?.open(deepLink, completionHandler: nil)

        // Fallback: ObjC runtime — UIApplication.shared.open(_:options:completionHandler:)
        // The modern method (iOS 10+) requires IMP casting because it has 3 params.
        if let appClass = NSClassFromString("UIApplication"),
           let shared = (appClass as AnyObject)
               .perform(NSSelectorFromString("sharedApplication"))?
               .takeUnretainedValue() {
            let selector = NSSelectorFromString("openURL:options:completionHandler:")
            if shared.responds(to: selector) {
                let imp = shared.method(for: selector)
                typealias OpenURL = @convention(c) (AnyObject, Selector, NSURL, NSDictionary, Any?) -> Void
                let open = unsafeBitCast(imp, to: OpenURL.self)
                open(shared, selector, deepLink as NSURL, NSDictionary(), nil)
            }
        }
    }

    private func finishWithURL(_ sharedURL: URL?) {
        if let sharedURL = sharedURL {
            openMainApp(with: sharedURL)
        }
        // Delay teardown so the system has time to dispatch the URL open.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            self?.done()
        }
    }

    private func done() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
`;

// ---------------------------------------------------------------------------
// Info.plist contents for the Share Extension
// ---------------------------------------------------------------------------
const INFO_PLIST = {
  CFBundleDevelopmentRegion: "en",
  CFBundleDisplayName: "RecipeApp",
  CFBundleExecutable: "$(EXECUTABLE_NAME)",
  CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
  CFBundleInfoDictionaryVersion: "6.0",
  CFBundleName: "$(PRODUCT_NAME)",
  CFBundlePackageType: "XPC!",
  CFBundleShortVersionString: "$(MARKETING_VERSION)",
  CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
  LSApplicationQueriesSchemes: ["recipeapp"],
  NSExtension: {
    NSExtensionAttributes: {
      NSExtensionActivationRule: {
        NSExtensionActivationSupportsWebURLWithMaxCount: 1,
        NSExtensionActivationSupportsWebPageWithMaxCount: 1,
        NSExtensionActivationSupportsTextWithMaxCount: 1,
      },
    },
    NSExtensionPointIdentifier: "com.apple.share-services",
    NSExtensionPrincipalClass: "$(PRODUCT_MODULE_NAME).ShareViewController",
  },
};

const buildPlist = plist.build || plist.default.build;

// ---------------------------------------------------------------------------
// Xcode project helpers
// ---------------------------------------------------------------------------

function findTargetByName(xcodeProject, targetName) {
  const targets = xcodeProject.pbxNativeTargetSection();
  return Object.keys(targets)
    .filter((key) => !key.endsWith("_comment"))
    .map((key) => targets[key])
    .find((target) => {
      if (!target || !target.name) return false;
      return target.name.replace(/"/g, "") === targetName;
    });
}

function addXCConfigurationList(
  xcodeProject,
  {
    targetName,
    currentProjectVersion,
    bundleIdentifier,
    deploymentTarget,
    marketingVersion,
  }
) {
  const commonBuildSettings = {
    PRODUCT_NAME: `"${targetName}"`,
    SWIFT_VERSION: "5.0",
    TARGETED_DEVICE_FAMILY: `"1,2"`,
    INFOPLIST_FILE: `${targetName}/Info.plist`,
    CURRENT_PROJECT_VERSION: `"${currentProjectVersion}"`,
    IPHONEOS_DEPLOYMENT_TARGET: `"${deploymentTarget}"`,
    PRODUCT_BUNDLE_IDENTIFIER: `"${bundleIdentifier}"`,
    MARKETING_VERSION: `"${marketingVersion}"`,
    SWIFT_OPTIMIZATION_LEVEL: `"-Onone"`,
    CODE_SIGN_ENTITLEMENTS: `"${targetName}/${targetName}.entitlements"`,
    APPLICATION_EXTENSION_API_ONLY: '"YES"',
    GENERATE_INFOPLIST_FILE: '"NO"',
  };

  const buildConfigurationsList = [
    {
      name: "Debug",
      isa: "XCBuildConfiguration",
      buildSettings: { ...commonBuildSettings },
    },
    {
      name: "Release",
      isa: "XCBuildConfiguration",
      buildSettings: { ...commonBuildSettings },
    },
  ];

  return xcodeProject.addXCConfigurationList(
    buildConfigurationsList,
    "Release",
    `Build configuration list for PBXNativeTarget "${targetName}"`
  );
}

function addProductFile(xcodeProject, { targetName, groupName }) {
  const options = {
    basename: `${targetName}.appex`,
    group: groupName,
    explicitFileType: "wrapper.app-extension",
    settings: {
      ATTRIBUTES: ["RemoveHeadersOnCopy"],
    },
    includeInIndex: 0,
    path: `${targetName}.appex`,
    sourceTree: "BUILT_PRODUCTS_DIR",
  };

  return xcodeProject.addProductFile(targetName, options);
}

function addToPbxNativeTargetSection(
  xcodeProject,
  { targetName, targetUuid, productFile, xCConfigurationList }
) {
  const target = {
    uuid: targetUuid,
    pbxNativeTarget: {
      isa: "PBXNativeTarget",
      name: targetName,
      productName: targetName,
      productReference: productFile.fileRef,
      productType: `"com.apple.product-type.app-extension"`,
      buildConfigurationList: xCConfigurationList.uuid,
      buildPhases: [],
      buildRules: [],
      dependencies: [],
    },
  };

  xcodeProject.addToPbxNativeTargetSection(target);
  return target;
}

function addToPbxProjectSection(xcodeProject, target) {
  xcodeProject.addToPbxProjectSection(target);

  const projectSection = xcodeProject.pbxProjectSection();
  const firstProjectUuid = xcodeProject.getFirstProject().uuid;

  if (!projectSection[firstProjectUuid].attributes.TargetAttributes) {
    projectSection[firstProjectUuid].attributes.TargetAttributes = {};
  }

  projectSection[firstProjectUuid].attributes.TargetAttributes[target.uuid] = {
    LastSwiftMigration: 1250,
  };
}

function addTargetDependency(xcodeProject, target) {
  if (!xcodeProject.hash.project.objects["PBXTargetDependency"]) {
    xcodeProject.hash.project.objects["PBXTargetDependency"] = {};
  }
  if (!xcodeProject.hash.project.objects["PBXContainerItemProxy"]) {
    xcodeProject.hash.project.objects["PBXContainerItemProxy"] = {};
  }

  xcodeProject.addTargetDependency(xcodeProject.getFirstTarget().uuid, [
    target.uuid,
  ]);
}

function addBuildPhases(
  xcodeProject,
  { targetUuid, groupName, productFile, swiftFiles }
) {
  const buildPath = `""`;
  const folderType = "app_extension";

  // Sources build phase
  xcodeProject.addBuildPhase(
    [...swiftFiles],
    "PBXSourcesBuildPhase",
    groupName,
    targetUuid,
    folderType,
    buildPath
  );

  // Copy files build phase (embed extension in main app)
  xcodeProject.addBuildPhase(
    [],
    "PBXCopyFilesBuildPhase",
    groupName,
    xcodeProject.getFirstTarget().uuid,
    folderType,
    buildPath
  );

  xcodeProject
    .buildPhaseObject("PBXCopyFilesBuildPhase", groupName, productFile.target)
    .files.push({
      value: productFile.uuid,
      comment: util.format(
        "%s in %s",
        productFile.basename,
        productFile.group
      ),
    });
  xcodeProject.addToPbxBuildFileSection(productFile);

  // Frameworks build phase
  xcodeProject.addBuildPhase(
    [],
    "PBXFrameworksBuildPhase",
    groupName,
    targetUuid,
    folderType,
    buildPath
  );

  // Resources build phase
  xcodeProject.addBuildPhase(
    [],
    "PBXResourcesBuildPhase",
    groupName,
    targetUuid,
    folderType,
    buildPath
  );
}

function addPbxGroup(xcodeProject, { targetName, fileNames }) {
  const { uuid: pbxGroupUuid } = xcodeProject.addPbxGroup(
    [...fileNames, `${targetName}.entitlements`],
    targetName,
    targetName
  );

  const groups = xcodeProject.hash.project.objects["PBXGroup"];
  if (pbxGroupUuid) {
    Object.keys(groups).forEach(function (key) {
      if (groups[key].name === undefined && groups[key].path === undefined) {
        xcodeProject.addToPbxGroup(pbxGroupUuid, key);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Main config plugin
// ---------------------------------------------------------------------------

module.exports = function withShareExtension(config) {
  if (!config.ios || !config.ios.bundleIdentifier) {
    throw new Error("withShareExtension requires ios.bundleIdentifier");
  }

  const targetName = TARGET_NAME;
  const bundleIdentifier = `${config.ios.bundleIdentifier}.shareext`;
  const deploymentTarget = DEPLOYMENT_TARGET;

  // ---- Step A: Configure Xcode project + write extension files ----
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const { platformProjectRoot } = config.modRequest;

    // Step 1: Write Swift, Info.plist, and entitlements to ios/ShareExtension/
    const targetPath = path.join(platformProjectRoot, targetName);
    fs.mkdirSync(targetPath, { recursive: true });

    fs.writeFileSync(
      path.join(targetPath, "ShareViewController.swift"),
      SWIFT_SOURCE
    );
    fs.writeFileSync(
      path.join(targetPath, "Info.plist"),
      buildPlist(INFO_PLIST)
    );
    fs.writeFileSync(
      path.join(targetPath, `${targetName}.entitlements`),
      buildPlist({})
    );

    // Step 2: Add Xcode target (skip if already present)
    const existingTarget = findTargetByName(xcodeProject, targetName);
    if (existingTarget) {
      return config;
    }

    const targetUuid = xcodeProject.generateUuid();
    const groupName = GROUP_NAME;
    const marketingVersion = config.version || "1.0.0";

    const swiftFiles = ["ShareViewController.swift"];

    const xCConfigurationList = addXCConfigurationList(xcodeProject, {
      targetName,
      currentProjectVersion: config.ios.buildNumber || "1",
      bundleIdentifier,
      deploymentTarget,
      marketingVersion,
    });

    const productFile = addProductFile(xcodeProject, {
      targetName,
      groupName,
    });

    const target = addToPbxNativeTargetSection(xcodeProject, {
      targetName,
      targetUuid,
      productFile,
      xCConfigurationList,
    });

    addToPbxProjectSection(xcodeProject, target);
    addTargetDependency(xcodeProject, target);
    addBuildPhases(xcodeProject, {
      targetUuid,
      groupName,
      productFile,
      swiftFiles,
    });
    addPbxGroup(xcodeProject, {
      targetName,
      fileNames: ["ShareViewController.swift", "Info.plist"],
    });

    return config;
  });

  // ---- Step B: Register with EAS build ----
  if (!config.extra) config.extra = {};
  if (!config.extra.eas) config.extra.eas = {};
  if (!config.extra.eas.build) config.extra.eas.build = {};
  if (!config.extra.eas.build.experimental)
    config.extra.eas.build.experimental = {};
  if (!config.extra.eas.build.experimental.ios)
    config.extra.eas.build.experimental.ios = {};
  if (!config.extra.eas.build.experimental.ios.appExtensions)
    config.extra.eas.build.experimental.ios.appExtensions = [];

  const existingIndex =
    config.extra.eas.build.experimental.ios.appExtensions.findIndex(
      (ext) => ext.targetName === targetName
    );

  if (existingIndex === -1) {
    config.extra.eas.build.experimental.ios.appExtensions.push({
      targetName,
      bundleIdentifier,
    });
  }

  return config;
};
