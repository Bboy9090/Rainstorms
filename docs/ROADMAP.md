# Rainstorms Product Roadmap

> This roadmap reflects the current state of the product and where it is heading. It is a living document — priorities may shift as we learn from users.

---

## Current State — v0.1.0 (Released)

The MVP is complete and shipped. The full story creation pipeline works end-to-end.

**What works today:**

- ✅ Idea Lab — story concept input with tone, age range, page count
- ✅ Story Blueprint — AI-generated title, hook, summary, theme, and page outline
- ✅ Character Forge — editable character cards with personality, appearance, special traits
- ✅ Story Memory — consistency engine injected into every generation prompt
- ✅ Page Builder — per-page text generation with "Improve This Page" modifiers
- ✅ Illustration Prompts — detailed scene descriptions for illustrators or image models
- ✅ Export — story PDF, illustration prompts PDF, plain text, JSON
- ✅ Demo Project — Captain Blanket pre-loaded, no account required
- ✅ Optional Auth — JWT accounts to save and manage projects
- ✅ Autosave — debounced saves to MongoDB on every edit

---

## Phase 2 — Story Experience (near-term)

**Goal:** Make the editing experience feel polished and trustworthy.

| Feature | Description | Priority |
|---------|-------------|----------|
| Book preview mode | Side-by-side layout: illustration panel + page text + navigation | High |
| Storybook preview | Read-through mode showing the finished book as pages | High |
| Series / sequel support | Link multiple projects into a series (Book 1, Book 2…) | Medium |
| Revision history | Per-page undo/redo for text edits | Medium |
| Word count + reading level | Per-page and total stats | Low |
| Sharing links | Share a read-only book preview via URL | Low |

---

## Phase 3 — Visual Books

**Goal:** Produce illustrated picture books, not just text drafts.

| Feature | Description | Priority |
|---------|-------------|----------|
| Illustration generation | Send prompts to an image API (DALL·E, Stable Diffusion); store results per page | High |
| Art style selector | Watercolor, soft cartoon, crayon, Pixar-style — locks style for all pages | High |
| Character consistency | Store character visual tags; inject into every image prompt | High |
| Cover generation | Generate a book cover from title + character descriptions | Medium |
| Regenerate illustration | Per-page button to try a different image | Medium |

---

## Phase 4 — Multimedia Export

**Goal:** Turn finished books into shareable videos for social media and classrooms.

| Feature | Description | Priority |
|---------|-------------|----------|
| Motion Story Export | Slideshow-style video: one image per page, slow zoom/pan effect | High |
| AI narration | Text-to-speech with voice presets (warm parent, playful kid, gentle bedtime) | High |
| Subtitles | Burned-in captions for muted viewing | Medium |
| Background music | Mood presets: magical, bedtime, adventure, silly, emotional | Medium |
| Vertical export (9:16) | For TikTok, YouTube Shorts, Instagram Reels | High |
| Landscape export (16:9) | For YouTube, classroom playback | Medium |
| Scene timing controls | Per-page duration: 3 / 5 / 8 / custom seconds | Low |

---

## Phase 5 — Classroom & Creator Tools

**Goal:** Serve teachers, young creators, and family storytellers.

| Feature | Description | Priority |
|---------|-------------|----------|
| Lesson-based templates | Story starters aligned to reading themes and curriculum | Medium |
| Teacher dashboard | Manage multiple student projects, assign prompts | Medium |
| Printable reading packs | Formatted for classroom reading with comprehension questions | Low |
| Kid creator mode | Simplified UI for young users (ages 7–12) | Medium |
| Collaborative editing | Real-time co-author mode | Low |

---

## Long-Term Vision

Rainstorms is the starting point for a larger creative platform. Once the book creation pipeline is proven and beloved, natural expansion paths include:

- **Rainstorms Studio** — motion comic and narrated video export as a standalone creator tool
- **Series Architect** — a saga management tool for longer fiction (chapter books, middle-grade series)
- **Publishing bridge** — direct connections to self-publishing platforms (KDP, Lulu, Blurb)

These are future products, not current scope. Rainstorms wins first by being **focused, warm, and usable** for children's books.

---

*Last updated: v0.1.0 · See [APP_VISION.md](APP_VISION.md) for the product philosophy.*
