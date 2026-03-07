# Demo Flow: Captain Blanket and the Midnight Brother

This document walks through the complete Rainstorms user journey using the built-in demo project. Use it to understand the product, test the pipeline, or show the app to someone new.

> **No account or API key required.** Click "Try Demo Project" on the home screen to start.

---

## The Story

**Title:** Captain Blanket and the Midnight Brother
**Hook:** When darkness falls, one brave big brother discovers that the greatest superpower is love.
**Ages:** 3–8 · **Pages:** 10 · **Tone:** Cozy, adventurous, bedtime calm

---

## Step 1 — Home Screen

Open the app at `http://localhost:8081` (or the deployed URL).

You will see:
- The Rainstorms logo and tagline: *"Where Stories Pour Down"*
- A **"New Story"** button to start your own project
- A **"Try Demo Project"** button to load the pre-built example
- A card previewing the Captain Blanket story

**Action:** Click **"Try Demo Project"**

The app loads the complete demo from the backend (`GET /api/demo`) and navigates to the Story Blueprint screen.

---

## Step 2 — Story Blueprint

The Blueprint screen shows the AI-generated story structure:

| Field | Value |
|-------|-------|
| Title | Captain Blanket and the Midnight Brother |
| Hook | When darkness falls, one brave big brother discovers that the greatest superpower is love. |
| Summary | Oliver discovers his old baby blanket transforms into a magical cape… |
| Theme | The power of love and protection between siblings |
| Age Range | 3–8 years |
| Page Count | 10 |

Below the metadata, a **Page-by-Page Outline** shows all 10 beats, each numbered and editable.

**Actions available:**
- ✏️ Edit the title inline
- 🔄 Regenerate the title or full outline (requires API key)
- ✅ **"Accept Blueprint"** — advances to the Character Forge

---

## Step 3 — Character Forge

The Character Forge displays all four characters with their full profiles:

| Character | Role | Key Trait |
|-----------|------|-----------|
| Oliver (Captain Blanket) | Main | Love makes the cape glow |
| Baby Max | Supporting | Innocent smile lights dark rooms |
| Shadow Monsters | Minor | Shrink when exposed to love |
| The Nightmare King | Minor | Melts into starlight when defeated |

Each character card shows personality, appearance, and special trait — all editable.

**Actions available:**
- ✏️ Edit any character field directly
- ➕ Add a new character
- 🗑️ Remove a character
- ➡️ **"Continue to Page Builder"** — advances to the next step

---

## Step 4 — Story Memory

Story Memory is the consistency engine. It is automatically generated from the characters and blueprint.

It tracks:

| Section | Content |
|---------|---------|
| Characters | Quick-reference summaries for all characters |
| Relationships | Oliver is Max's protective big brother |
| Settings | Oliver's bedroom; the nursery with Max's crib |
| Events | Key plot points as they are confirmed |
| Tone Notes | Cozy, brave, not scary — sleepy adventure feel |
| Style Guide | 2–5 sentences per page, simple vivid language, onomatopoeia welcome |

This data is injected into every AI generation prompt so the story stays consistent across all 10 pages.

**Access:** Tap the Story Memory icon in the Page Builder header (🧠).

---

## Step 5 — Page Builder

The Page Builder is where the story comes to life. All 10 pages are pre-filled in the demo.

**Page 1 example:**

> Oliver snuggled deep in his cozy bed, but sleep wouldn't come. From the nursery next door, he heard a tiny whimper. Baby Max was fussing again. Oliver reached for his old baby blanket — the soft, silver-blue one that always made him feel brave.

Each page includes:
- **Story Beat** — the outline beat for this page (read-only reference)
- **Page Text** — the full prose (editable)
- **Emotional Beat** — mood descriptor (*"gentle concern, comfort"*)
- **Illustration Prompt** — detailed scene description for an artist or image model

**Improve This Page modifiers (per page):**

| Button | Effect |
|--------|--------|
| Make funnier | Adds playful language and humor |
| Make cozier | Adds sensory comfort details |
| Add dialogue | Inserts character conversation |
| Simplify | Shorter sentences, simpler words |
| More emotional | Deeper feelings, touching moments |

**Navigation:** Use the page number tabs at the top (1–10) or Previous/Next buttons at the bottom.

---

## Step 6 — Export

The Export screen offers four formats:

| Format | Description |
|--------|-------------|
| 📄 Story PDF | Formatted picture-book layout with title page and all 10 pages |
| 🎨 Prompts PDF | All illustration prompts as an art-director reference sheet |
| 📝 Plain Text | Raw story text — useful for copy-paste into other tools |
| 📦 JSON | Complete project export matching the Rainstorms data schema |

**Action:** Click any export button to download.

The story PDF is ready to share with an illustrator or send to print.

---

## The Full Loop

```
Home
  └── Try Demo Project
        └── Story Blueprint   (view title, hook, 10-page outline)
              └── Accept Blueprint
                    └── Character Forge  (view 4 characters)
                          └── Continue
                                └── Page Builder  (read / edit 10 pages)
                                      └── Export  (PDF / text / JSON)
```

Total time to walk through the demo: **~3 minutes**.

---

## What This Proves

Running through the Captain Blanket demo confirms:

1. ✅ The backend `GET /api/demo` endpoint returns a complete project
2. ✅ The Story Blueprint renders correctly with all metadata
3. ✅ Character Forge displays and allows editing all character fields
4. ✅ Story Memory is populated and accessible
5. ✅ Page Builder shows all 10 pages with text and illustration prompts
6. ✅ "Improve This Page" modifiers are present (require API key to execute)
7. ✅ Export generates valid PDF/text/JSON output

---

## Source Files

| File | Description |
|------|-------------|
| [`demo/captain_blanket_demo.json`](../demo/captain_blanket_demo.json) | Full structured export of this story |
| [`demo/captain_blanket_outline.md`](../demo/captain_blanket_outline.md) | Story outline and character profiles |
| [`demo/captain_blanket_pages.md`](../demo/captain_blanket_pages.md) | All 10 pages with illustration prompts |
| [`backend/server.py`](../backend/server.py) | Demo seed endpoint: `POST /api/demo/seed` |

---

*See [STORY_ENGINE.md](STORY_ENGINE.md) for how the generation pipeline works under the hood.*
