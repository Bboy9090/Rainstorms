# Rainstorms ↔ LoreEngine Integration Guide

> **Who this is for:** The Rainstorms engineering team integrating with MythLoreBuilder's LoreEngine backend.

---

## Overview

LoreEngine is the canonical memory layer shared by MythLoreBuilder and Rainstorms.

Rainstorms uses LoreEngine to generate stories that are **consistent with an existing universe** — correct factions, living characters, world rules, timeline context.

The integration is a two-step flow:

1. **Fetch** story context for a universe from LoreEngine.
2. **Inject** that context into Rainstorms' AI story-generation prompt.

---

## Base URL

```
https://<your-lore-engine-host>
```

During local development the FastAPI server runs on `http://localhost:8001`.

Configure the URL in Rainstorms' environment:

```bash
LORE_ENGINE_BASE_URL=https://<your-lore-engine-host>
```

---

## CORS

All `/api/*` routes on the LoreEngine server include the following CORS headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

Browser-based requests from Rainstorms are therefore permitted without any proxy.

---

## Receiving a Universe from SagaArchitect

### `POST /api/lore/sync`

SagaArchitect's **Sync to Rainstorms** button calls this endpoint.  It sends the complete universe — factions, characters, locations, timeline, story arcs, and lore rules — in a single request.

The endpoint **upserts** every entity: if an entity's `id` already exists in the database it is updated; otherwise a new document is created.  The `universe_id` on every child entity is always overridden to the incoming universe's `id`, so linkage is correct even when SagaArchitect's internal IDs differ from Rainstorms'.

#### Request body

```json
{
  "universe": {
    "id": "abc123",
    "name": "The Ashen Veil",
    "genre": "Dark Fantasy",
    "tone": "Epic, tragic, mythic",
    "concept": "A world veiled in silver ash after the gods burned out…",
    "technology_level": "Medieval-industrial",
    "magic_system": "Storm magic erases memories proportional to power used.",
    "era": "The Third Ashfall",
    "core_theme": "The cost of power and the grief of forgetting",
    "world_overview": "…",
    "creation_myth": "…",
    "current_conflict": "…",
    "prophecy_hooks": "…"
  },
  "factions": [
    {
      "id": "f1",
      "name": "Covenant of Embers",
      "type": "religious_order",
      "ideology": "The Hearth Pillars are sacred relics.",
      "leader": "Arch-Keeper Vael",
      "territory": "Emberveil Monasteries",
      "allies": [],
      "enemies": ["Ashen Throne"],
      "canon_status": "canon"
    }
  ],
  "characters": [
    {
      "id": "c1",
      "name": "Solen Ashveil",
      "role": "hero",
      "status": "alive",
      "faction_id": "f1",
      "motivations": "Protect the people; find who he was before the forgetting.",
      "canon_status": "canon"
    }
  ],
  "locations": [ … ],
  "timeline":  [ … ],
  "story_arcs": [ … ],
  "lore_rules": [ … ]
}
```

> **Field mapping** — SagaArchitect's `src/lib/rainstorms.ts` translates SagaArchitect's internal field names to Rainstorms' schema before posting, so field names in the request body already match the Rainstorms models.

#### Response `200 OK`

```json
{
  "success": true,
  "universe_id": "abc123",
  "universe": "created",
  "created": { "factions": 3, "characters": 3, "locations": 4, "lore_rules": 5 },
  "updated": {},
  "total_entities": 15
}
```

A subsequent sync of the same universe returns `"universe": "updated"` and entity counts in `"updated"` instead of `"created"`.

---

## Primary Integration Endpoint

### `GET /api/universes/{id}/story-context`

Returns a condensed, story-ready context packet for the specified universe.  All entities returned are `canon_status = "canon"` only.

#### Path Parameters

| Parameter | Type   | Description        |
|-----------|--------|--------------------|
| `id`      | string | LoreEngine universe ID |

#### Response `200 OK`

```json
{
  "universe_id": "string",
  "universe_name": "The Ashen Veil",
  "universe_tone": "Epic, tragic, mythic",
  "world_overview": "A world draped in perpetual silver ash…",
  "current_conflict": "Three factions converge on the last Hearth Pillar…",
  "world_rules": [
    {
      "rule_type": "magic",
      "rule": "Storm magic erases personal memories proportional to power used.",
      "consequence": "A Storm Mage who casts too much eventually forgets who they are."
    }
  ],
  "relevant_characters": [
    {
      "name": "Solen Ashveil",
      "title": "The Forgetting Knight",
      "role": "hero",
      "appearance": "Tall, silver-haired…",
      "motivations": "Protect the people; find who he was before the forgetting.",
      "status": "alive"
    }
  ],
  "relevant_factions": [
    {
      "name": "Covenant of Embers",
      "ideology": "The Hearth Pillars are sacred relics and must be shared equally.",
      "territory": "Emberveil Monasteries scattered across all regions"
    }
  ],
  "relevant_locations": [
    {
      "name": "The Sunken Spire",
      "type": "ancient ruin",
      "description": "A massive obsidian tower half-submerged in petrified ash…"
    }
  ],
  "timeline_context": [
    {
      "era": "Year 0 — Before Reckoning",
      "title": "The God-War",
      "summary": "The gods unite against the Void in a cataclysmic battle that consumes them all."
    }
  ]
}
```

---

## Listing Available Universes

### `GET /api/universes`

Returns all universes.  Use this to let a Rainstorms user select which universe to draw from.

```json
[
  {
    "id": "abc123",
    "name": "The Ashen Veil",
    "genre": "Dark Fantasy",
    "tone": "Epic, tragic, mythic",
    "world_overview": "…",
    "created_at": "2026-01-01T00:00:00"
  }
]
```

---

## How Rainstorms Should Use the Context

### Recommended prompt injection pattern

```javascript
// 1. Fetch lore context from LoreEngine
const res = await fetch(`${LORE_ENGINE_BASE_URL}/api/universes/${universeId}/story-context`);
const loreContext = await res.json();

// 2. Build a lore-aware system prompt
const systemPrompt = buildLorePrompt(loreContext);

// 3. Generate the story
const story = await generateStory({ systemPrompt, userIdea });
```

### `buildLorePrompt(context)` — example implementation

```javascript
function buildLorePrompt(ctx) {
  const rules = ctx.world_rules.map(r => `• ${r.rule}`).join('\n');
  const characters = ctx.relevant_characters
    .filter(c => c.status === 'alive')
    .map(c => `• ${c.name} (${c.role}): ${c.motivations}`)
    .join('\n');
  const factions = ctx.relevant_factions
    .map(f => `• ${f.name}: ${f.ideology}`)
    .join('\n');
  const timeline = ctx.timeline_context
    .map(e => `• [${e.era}] ${e.title}: ${e.summary}`)
    .join('\n');

  return `
You are generating a story set in ${ctx.universe_name}.

UNIVERSE TONE: ${ctx.universe_tone}
WORLD OVERVIEW: ${ctx.world_overview}
CURRENT CONFLICT: ${ctx.current_conflict}

WORLD RULES (AI must respect these):
${rules}

KEY LIVING CHARACTERS:
${characters}

FACTIONS:
${factions}

TIMELINE CONTEXT:
${timeline}

Generate a story that is consistent with all of the above.
Do not contradict world rules. Do not use dead characters as active participants.
`.trim();
}
```

---

## Export Canon Format (CanonBlockInput)

When a creator clicks **Export Canon** in MythLoreBuilder, they download a JSON file in `CanonBlockInput` format.

This is the **raw, unprocessed** payload — full objects for every lore entity.  It is **not** the condensed `StoryContext` response.

Use `CanonBlockInput` when you need to:
- Store the full universe lore locally in Rainstorms
- POST to a compatible lore-engine endpoint (e.g. SagaArchitect's `/api/lore-engine/canon-block`)
- Compose custom prompts using fields not available in the condensed `StoryContext`

```typescript
interface CanonBlockInput {
  universe: Universe;          // Full universe object (all fields incl. concept, creation_myth, etc.)
  characters: LoreCharacter[]; // Full character objects
  factions: Faction[];         // Full faction objects (incl. allies, enemies, internal_conflict)
  locations: LoreLocation[];   // Full location objects
  timeline: TimelineEvent[];   // Full timeline event objects
  lore_rules: LoreRule[];      // Full lore rule objects
  story_arcs: StoryArc[];      // Full story arc objects
}
```

> **Why not send StoryContext back to the API?**  
> `StoryContext` is already processed and filtered. Sending it back to the API would lose fields (`concept`, full faction structure, hidden truths, etc.). Always export and re-POST `CanonBlockInput`.

---

## Demo Universe

The **Ashen Veil** demo universe is pre-seeded in LoreEngine.

```bash
# Seed the demo universe
POST /api/lore/seed-demo

# Fetch the complete demo data (CanonBlockInput format)
GET /api/lore/demo-universe
```

The demo universe includes:
- 3 factions (The Ashen Throne, Covenant of Embers, The Hollow Prophets)
- 4 locations (The Sunken Spire, Vael City, The Ashfall Coast, The Ironfeld Plains)
- 3 characters (Solen Ashveil, Empress Vael Duskmore, Lira Flameheld)
- 5 world rules (storm magic memory loss, ash-veil crop failure, etc.)
- 5 timeline events (The God-War → Present Crisis)
- 1 story arc (The Sunken Spire War trilogy)

---

## Error Responses

| Status | Meaning |
|--------|---------|
| `404`  | Universe not found |
| `500`  | Server error (usually AI generation failure) |

---

## Quick Reference

| What you need | Endpoint |
|---|---|
| Receive full universe from SagaArchitect | `POST /api/lore/sync` |
| List universes for a picker | `GET /api/universes` |
| Story context for AI prompt | `GET /api/universes/{id}/story-context` |
| Full raw lore (CanonBlockInput) | Download via **Export Canon** in MythLoreBuilder, or `GET /api/lore/demo-universe` for the demo |
| Check lore for contradictions | `POST /api/universes/{id}/validate` |
| Canon memory packet | `GET /api/universes/{id}/canon-memory` |
