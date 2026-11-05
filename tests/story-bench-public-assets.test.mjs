import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const root = path.resolve(process.cwd(), "frontend");
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
const expo = app.expo;

test("Expo public assets use Story Bench names", () => {
  assert.equal(expo.icon, "./assets/images/story-bench-icon.png");
  assert.equal(expo.android.adaptiveIcon.foregroundImage, "./assets/images/story-bench-adaptive-icon.png");
  const splash = expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === "expo-splash-screen");
  assert.equal(splash[1].image, "./assets/images/story-bench-splash.png");
});

test("transitional Story Bench aliases preserve current source bytes", () => {
  const names = [
    "story-bench-icon.png",
    "story-bench-adaptive-icon.png",
    "story-bench-splash.png",
  ];
  const hashes = names.map((name) =>
    fs.readFileSync(path.join(root, "assets/images", name)).toString("base64"),
  );
  assert.equal(new Set(hashes).size, 1);
});
