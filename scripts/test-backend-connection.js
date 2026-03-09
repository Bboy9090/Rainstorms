#!/usr/bin/env node
/**
 * Test backend connection — verifies health and MongoDB connectivity.
 * Usage: node scripts/test-backend-connection.js [BACKEND_URL]
 * Example: node scripts/test-backend-connection.js https://backend-production-4938.up.railway.app
 */

const https = require("https");
const http = require("http");

const base = (process.argv[2] || "https://backend-production-4938.up.railway.app").replace(/\/$/, "");
const client = base.startsWith("https") ? https : http;

function fetch(path, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = client.get(`${base}${path}`, { timeout }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, json: null, raw: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function main() {
  console.log(`Testing backend: ${base}\n`);

  try {
    const health = await fetch("/api/health");
    if (health.status !== 200 || health.json?.status !== "healthy") {
      console.log(`❌ Health check failed: ${health.status}`);
      process.exit(1);
    }
    console.log("✅ Health: OK");
  } catch (e) {
    console.log(`❌ Health: ${e.message}`);
    process.exit(1);
  }

  try {
    const ready = await fetch("/api/ready", 15000);
    if (ready.status === 200 && ready.json?.mongo === "connected") {
      console.log("✅ MongoDB: connected");
    } else if (ready.status === 404) {
      console.log("⚠️  /api/ready not found (deploy latest backend to enable)");
    } else {
      console.log(`❌ MongoDB: not connected (${ready.status})`);
      if (ready.json?.detail?.hint) console.log(`   Hint: ${ready.json.detail.hint}`);
      process.exit(1);
    }
  } catch (e) {
    console.log(`⚠️  Ready check: ${e.message}`);
  }

  console.log("\n✅ Backend is fully operational.");
}

main();
