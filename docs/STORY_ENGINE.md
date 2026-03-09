# Rainstorms Story Engine

## Overview

The Story Engine is the AI-powered core of Rainstorms. It generates consistent, age-appropriate children's book content through a series of specialized prompts.

## Architecture

```
Idea → Blueprint → Characters → Pages → Illustration Prompts
         ↓
    Story Memory (consistency tracking)
```

## Generation Stages

### 1. Blueprint Generation

**Input:**
- Original story idea
- Tone (cozy, funny, adventurous, emotional, bedtime calm)
- Age range (3-5, 4-6, 5-8)
- Page count (8, 10, 12)

**Output:**
- Title
- One-line hook
- Summary (2-3 sentences)
- Theme
- Character list (names + roles)
- Page-by-page outline

### 2. Character Generation

**Input:**
- Story blueprint

**Output (per character):**
- Name
- Role (main/supporting/minor)
- Personality description
- Visual appearance (detailed for illustrators)
- Special trait
- Notes for consistency

### 3. Page Text Generation

**Input:**
- Project context (title, summary, tone)
- Character cards
- Page outline beat
- Story Memory

**Output:**
- Page text (2-5 sentences, picture book style)
- Emotional beat (mood descriptor)

### 4. Illustration Prompt Generation

**Input:**
- Page text
- Character appearances
- Tone
- Character visual tags

**Output:**
- Detailed scene description
- Character poses/expressions
- Lighting and mood
- Style: "soft watercolor children's book illustration, warm cinematic lighting, expressive characters, bedtime-friendly palette"

## Story Memory (Consistency Engine)

The Story Memory panel tracks:

| Element | Purpose |
|---------|----------|
| Characters | Quick reference for names and key traits |
| Relationships | How characters relate to each other |
| Settings | Key locations in the story |
| Events | Important plot points that happened |
| Tone Notes | Mood and atmosphere guidelines |
| Style Guide | Writing consistency rules |

This data is automatically injected into generation prompts to maintain consistency.

## "Improve This Page" Feature

Quick modifiers for refining generated text:

| Modifier | Effect |
|----------|--------|
| Make funnier | Adds playful language, sound words, humor |
| Make cozier | Adds sensory comfort details |
| Add dialogue | Inserts character conversations |
| Simplify | Shorter sentences, simpler words |
| More emotional | Deeper feelings, touching moments |

## API Endpoints

```
POST /api/generate/blueprint
POST /api/generate/characters
POST /api/generate/page-text
POST /api/generate/illustration-prompt
POST /api/generate/improve-page
POST /api/generate/title

GET  /api/projects/{id}/story-memory
PUT  /api/projects/{id}/story-memory
POST /api/projects/{id}/story-memory/generate
```

## Best Practices

1. **Always generate Story Memory** after creating characters
2. **Use Improve modifiers** instead of full regeneration
3. **Edit character appearances** before generating illustration prompts
4. **Save frequently** — autosave handles most cases but manual save ensures nothing is lost

---

*The Story Engine is powered by OpenAI GPT-4.1 (default) or Google Gemini 2.0 Flash — configured via `LLM_PROVIDER` in `backend/.env`.*
