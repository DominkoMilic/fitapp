// expo-task-manager always adds the iOS "fetch" background mode. PACE only runs in the background
// to record location during an activity, so keep just "location" (App Review 2.5.4).
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withLocationOnlyBackground(config) {
  return withInfoPlist(config, (c) => {
    const modes = c.modResults.UIBackgroundModes ?? [];
    c.modResults.UIBackgroundModes = modes.filter((m) => m !== 'fetch');
    return c;
  });
};
