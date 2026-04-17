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

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

// App-store-required public privacy policy URL. Falls back to the placeholder
// so EAS builds don't fail when EXPO_PUBLIC_BACKEND_URL hasn't been set yet.
const PRIVACY_POLICY_URL = BACKEND_URL
  ? `${BACKEND_URL.replace(/\/$/, "")}/privacy`
  : "https://rainstorms.app/privacy";

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    privacyPolicyUrl: PRIVACY_POLICY_URL,
    extra: {
      ...appJson.expo?.extra,
      EXPO_PUBLIC_BACKEND_URL: BACKEND_URL,
      privacyPolicyUrl: PRIVACY_POLICY_URL,
      eas: {
        projectId: process.env.EAS_PROJECT_ID ?? appJson.expo?.extra?.eas?.projectId ?? "",
      },
    },
  },
};
