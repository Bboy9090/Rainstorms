/**
 * Expo app config — production-ready.
 * EXPO_PUBLIC_BACKEND_URL: set in Vercel env or frontend/.env for local.
 */
const appJson = require("./app.json");

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo?.extra,
      EXPO_PUBLIC_BACKEND_URL:
        process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8001",
    },
  },
};
