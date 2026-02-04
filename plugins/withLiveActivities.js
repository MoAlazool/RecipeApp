const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Swift source files for the LiveActivity widget extension.
//
// These are the "source of truth" for the Dynamic Island / Live Activity UI.
// The expo-live-activity plugin creates the extension target and writes
// default Swift files during prebuild. This plugin runs AFTER it (using
// withDangerousMod which executes after withXcodeProject) and overwrites
// those files with the custom implementations stored in
// plugins/live-activity-sources/.
//
// To update the Dynamic Island UI, edit the files in
// plugins/live-activity-sources/ — NOT ios/LiveActivity/.
// ---------------------------------------------------------------------------

const TARGET_NAME = "LiveActivity";

const SWIFT_FILES = [
  "LiveActivityWidget.swift",
  "LiveActivityWidgetBundle.swift",
  "LiveActivityView.swift",
  "Color+hex.swift",
  "Date+toTimerInterval.swift",
  "Image+dynamic.swift",
  "View+applyIfPresent.swift",
  "View+applyWidgetURL.swift",
  "ViewHelpers.swift",
];

module.exports = function withLiveActivities(config) {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const targetPath = path.join(platformProjectRoot, TARGET_NAME);
      const sourcesDir = path.join(__dirname, "live-activity-sources");

      // Ensure the extension directory exists (expo-live-activity should
      // have already created it, but guard for safety).
      fs.mkdirSync(targetPath, { recursive: true });

      // Overwrite each Swift file with our custom implementation.
      for (const fileName of SWIFT_FILES) {
        const src = path.join(sourcesDir, fileName);
        const dest = path.join(targetPath, fileName);
        fs.copyFileSync(src, dest);
      }

      return config;
    },
  ]);

  return config;
};
