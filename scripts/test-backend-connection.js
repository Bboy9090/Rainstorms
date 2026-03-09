#!/usr/bin/env node
/**
 * Test backend connection — used to verify frontend→backend connectivity.
 * Usage: node scripts/test-backend-connection.js [BACKEND_URL]
 * Example: node scripts/test-backend-connection.js https://rainstorms-api.up.railway.app
 */

const https = require("https");
const http = require("http");

const url = process.argv[2] || "https://rainstorms-api.up.railway.app";
const base = url.replace(/\/$/, "");
const healthUrl = `${base}/api/health`;

const client = base.startsWith("https") ? https : http;

console.log(`Testing backend: ${healthUrl}\n`);

const req = client.get(healthUrl, { timeout: 10000 }, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const status = res.statusCode;
    if (status === 200) {
      try {
        const json = JSON.parse(data);
        if (json.status === "healthy") {
          console.log("✅ Backend is reachable and healthy");
          console.log(`   Response: ${JSON.stringify(json)}`);
          process.exit(0);
        }
      } catch (e) {}
    }
    console.log(`❌ Backend returned ${status}`);
    console.log(`   Response: ${data.slice(0, 200)}${data.length > 200 ? "..." : ""}`);
    process.exit(1);
  });
});

req.on("error", (err) => {
  console.log(`❌ Connection failed: ${err.message}`);
  if (err.code === "ENOTFOUND") {
    console.log("   Hint: Check that the backend URL is correct and the service is deployed.");
  }
  process.exit(1);
});

req.on("timeout", () => {
  req.destroy();
  console.log("❌ Request timed out");
  process.exit(1);
});
