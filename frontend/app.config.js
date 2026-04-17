/**
 * Expo app config — production-ready.
 *
 * Required env vars for EAS builds:
 *   EXPO_PUBLIC_BACKEND_URL  — Full HTTPS URL of the deployed backend
 *                              (e.g. https://your-app.replit.app)
 *   EAS_PROJECT_ID           — Set after running `eas init` (optional here,
 *                              EAS CLI writes it to app.json automatically)
 */
const appJson = require("./app.json");

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo?.extra,
      EXPO_PUBLIC_BACKEND_URL:
        process.env.EXPO_PUBLIC_BACKEND_URL ?? "",
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? appJson.expo?.extra?.eas?.projectId ?? "",
      },
    },
  },
};
