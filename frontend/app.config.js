/**
 * Expo app config — ensures EXPO_PUBLIC_BACKEND_URL flows into the bundle at build time.
 *
 * Required for Vercel deployment: set EXPO_PUBLIC_BACKEND_URL in Vercel → Project →
 * Settings → Environment Variables (e.g. https://your-backend.railway.app).
 *
 * Local dev: use frontend/.env with EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
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
