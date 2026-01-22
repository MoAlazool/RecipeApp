const { withEntitlementsPlist } = require('@expo/config-plugins');

const isDevProfile = (profile) => {
  if (!profile) return false;
  const normalized = profile.toLowerCase();
  return normalized === 'development' || normalized === 'dev' || normalized === 'local';
};

const shouldStripForEnv = () => {
  const isEasBuild = process.env.EAS_BUILD === 'true';
  const profile = process.env.EAS_BUILD_PROFILE;

  // Local `expo prebuild` / `expo run:ios` should strip by default.
  if (!isEasBuild) return true;

  // EAS development profiles should also strip.
  return isDevProfile(profile);
};

module.exports = function withNoPushEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    if (shouldStripForEnv()) {
      delete config.modResults['aps-environment'];
    }
    return config;
  });
};
