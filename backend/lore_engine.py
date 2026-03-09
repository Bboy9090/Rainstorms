"""
LoreEngine — canonical memory layer shared by MythLoreBuilder and Rainstorms.

Responsibilities:
  1. Store lore objects (universes, characters, factions, locations, etc.)
  2. Build canon memory packets consumed by AI prompts
  3. Generate lore using AI (Universe Engine, Character/Faction/Arc generators)
  4. Validate contradictions (Canon Validation)
  5. Provide story context to Rainstorms via /api/universes/{id}/story-context
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime
import uuid
import json
import logging
import os

logger = logging.getLogger(__name__)

lore_router = APIRouter(prefix="/api/universes", tags=["LoreEngine"])
meta_router = APIRouter(prefix="/api/lore", tags=["LoreEngine"])

# ── will be injected from server.py ───────────────────────────────────────────
_db = None
_llm_fn = None


def init_lore_engine(db, llm_fn):
    global _db, _llm_fn
    _db = db
    _llm_fn = llm_fn


def _saga_architect_base_url() -> str:
    return os.environ.get("SAGA_ARCHITECT_BASE_URL", "").rstrip("/")


def _db_ref():
    if _db is None:
        raise RuntimeError("LoreEngine has not been initialised")
    return _db


# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class Universe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    genre: str = ""
    tone: str = ""
    concept: str = ""
    technology_level: str = ""
    magic_system: str = ""
    era: str = ""
    core_theme: str = ""
    world_overview: str = ""
    creation_myth: str = ""
    current_conflict: str = ""
    prophecy_hooks: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UniverseCreate(BaseModel):
    name: str
    genre: str = ""
    tone: str = ""
    concept: str = ""
    technology_level: str = ""
    magic_system: str = ""
    era: str = ""
    core_theme: str = ""


class UniverseGenerateRequest(BaseModel):
    genre: str
    tone: str
    concept: str
    era: str = ""
    technology_level: str = ""
    magic_system: str = ""
    core_theme: str = ""


class LoreCharacter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    universe_id: str
    name: str
    title: str = ""
    role: str = ""
    motivations: str = ""
    fears: str = ""
    powers: str = ""
    weaknesses: str = ""
    faction_id: Optional[str] = None
    relationships: List[Dict[str, Any]] = []
    arc_potential: str = ""
    status: str = "alive"
    appearance: str = ""
    speech_style: str = ""
    canon_status: str = "canon"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LoreCharacterCreate(BaseModel):
    name: str
    title: str = ""
    role: str = ""
    motivations: str = ""
    fears: str = ""
    powers: str = ""
    weaknesses: str = ""
    faction_id: Optional[str] = None
    relationships: List[Dict[str, Any]] = []
    arc_potential: str = ""
    status: str = "alive"
    appearance: str = ""
    speech_style: str = ""
    canon_status: str = "canon"


class Faction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    universe_id: str
    name: str
    type: str = ""
    ideology: str = ""
    leader: str = ""
    resources: str = ""
    territory: str = ""
    allies: List[str] = []
    enemies: List[str] = []
    internal_conflict: str = ""
    objective: str = ""
    symbol: str = ""
    canon_status: str = "canon"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FactionCreate(BaseModel):
    name: str
    type: str = ""
    ideology: str = ""
    leader: str = ""
    resources: str = ""
    territory: str = ""
    allies: List[str] = []
    enemies: List[str] = []
    internal_conflict: str = ""
    objective: str = ""
    symbol: str = ""
    canon_status: str = "canon"


class LoreLocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    universe_id: str
    name: str
    type: str = ""
    region: str = ""
    description: str = ""
    strategic_value: str = ""
    mythic_importance: str = ""
    controlling_faction: str = ""
    canon_status: str = "canon"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LoreLocationCreate(BaseModel):
    name: str
    type: str = ""
    region: str = ""
    description: str = ""
    strategic_value: str = ""
    mythic_importance: str = ""
    controlling_faction: str = ""
    canon_status: str = "canon"


class TimelineEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    universe_id: str
    title: str
    era_marker: str = ""
    summary: str = ""
    affected_characters: List[str] = []
    affected_factions: List[str] = []
    affected_locations: List[str] = []
    consequences: str = ""
    hidden_truths: str = ""
    canon_status: str = "canon"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TimelineEventCreate(BaseModel):
    title: str
    era_marker: str = ""
    summary: str = ""
    affected_characters: List[str] = []
    affected_factions: List[str] = []
    affected_locations: List[str] = []
    consequences: str = ""
    hidden_truths: str = ""
    canon_status: str = "canon"


class StoryArc(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    universe_id: str
    title: str
    type: str = ""
    summary: str = ""
    start_point: str = ""
    end_point: str = ""
    characters: List[str] = []
    factions: List[str] = []
    themes: List[str] = []
    turning_points: List[str] = []
    canon_status: str = "canon"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StoryArcCreate(BaseModel):
    title: str
    type: str = ""
    summary: str = ""
    start_point: str = ""
    end_point: str = ""
    characters: List[str] = []
    factions: List[str] = []
    themes: List[str] = []
    turning_points: List[str] = []
    canon_status: str = "canon"


class LoreRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    universe_id: str
    rule_type: str = ""  # magic, technology, creature, physical, cultural
    rule: str
    consequence: str = ""
    canon_status: str = "canon"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LoreRuleCreate(BaseModel):
    rule_type: str = ""
    rule: str
    consequence: str = ""
    canon_status: str = "canon"


class CanonConflict(BaseModel):
    severity: str  # warning | conflict | critical_conflict
    category: str  # timeline | character | faction | magic | duplicate
    description: str
    entities: List[str] = []


class CharacterGenerateRequest(BaseModel):
    role: str  # hero, villain, mentor, antihero, rival, guardian


class FactionGenerateRequest(BaseModel):
    faction_type: str  # empire, guild, religious_order, rebellion, secret_society, alien_race, corporation


class StoryArcGenerateRequest(BaseModel):
    arc_type: str  # trilogy_arc, season_arc, villain_arc, hero_transformation, civil_war, apocalyptic


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _clean_json(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        parts = cleaned.split("```")
        cleaned = parts[1] if len(parts) > 1 else cleaned
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    return cleaned.strip()


async def _build_canon_memory(universe_id: str) -> dict:
    """Build a canon memory packet for a universe."""
    db = _db_ref()
    universe = await db.lore_universes.find_one({"id": universe_id})
    if not universe:
        raise HTTPException(status_code=404, detail="Universe not found")

    characters = await db.lore_characters.find({"universe_id": universe_id}).to_list(50)
    factions = await db.lore_factions.find({"universe_id": universe_id}).to_list(50)
    locations = await db.lore_locations.find({"universe_id": universe_id}).to_list(50)
    rules = await db.lore_rules.find({"universe_id": universe_id}).to_list(50)
    events = await db.lore_timeline_events.find({"universe_id": universe_id}).sort("era_marker", 1).to_list(50)

    return {
        "universe": {
            "name": universe["name"],
            "genre": universe.get("genre", ""),
            "tone": universe.get("tone", ""),
            "world_overview": universe.get("world_overview", ""),
            "magic_system": universe.get("magic_system", ""),
            "technology_level": universe.get("technology_level", ""),
            "current_conflict": universe.get("current_conflict", ""),
        },
        "factions": [
            {"name": f["name"], "type": f.get("type", ""), "ideology": f.get("ideology", ""), "territory": f.get("territory", "")}
            for f in factions
        ],
        "characters": [
            {"name": c["name"], "role": c.get("role", ""), "status": c.get("status", ""), "faction": c.get("faction_id", "")}
            for c in characters
        ],
        "world_rules": [
            {"type": r.get("rule_type", ""), "rule": r["rule"]}
            for r in rules
        ],
        "timeline": [
            {"title": e["title"], "era": e.get("era_marker", ""), "summary": e.get("summary", "")}
            for e in events
        ],
    }


def _memory_to_prompt_text(memory: dict) -> str:
    u = memory["universe"]
    lines = [
        f"UNIVERSE: {u['name']} ({u['genre']}, {u['tone']})",
        f"OVERVIEW: {u['world_overview']}",
    ]
    if u.get("magic_system"):
        lines.append(f"MAGIC: {u['magic_system']}")
    if u.get("current_conflict"):
        lines.append(f"CURRENT CONFLICT: {u['current_conflict']}")
    if memory["world_rules"]:
        lines.append("WORLD RULES: " + "; ".join(r["rule"] for r in memory["world_rules"]))
    if memory["factions"]:
        lines.append("FACTIONS: " + ", ".join(f["name"] for f in memory["factions"]))
    if memory["characters"]:
        lines.append("KEY CHARACTERS: " + ", ".join(f"{c['name']} ({c['role']})" for c in memory["characters"]))
    if memory["timeline"]:
        lines.append("TIMELINE HIGHLIGHTS: " + "; ".join(e["title"] for e in memory["timeline"][:5]))
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════════════════
# UNIVERSE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("", response_model=List[Universe])
async def list_universes():
    saga_url = _saga_architect_base_url()
    if saga_url:
        remote_url = f"{saga_url}/api/universes"
        logger.info("Fetching universe list from SagaArchitect: %s", remote_url)
        try:
            async with httpx.AsyncClient(timeout=10.0) as http:
                resp = await http.get(remote_url)
            if resp.status_code == 200:
                data = resp.json()
                # SagaArchitect may return a list directly or a dict with "universes" key
                if isinstance(data, list):
                    universes_raw = data
                elif isinstance(data, dict) and "universes" in data:
                    universes_raw = data["universes"]
                else:
                    logger.warning(
                        "Unexpected SagaArchitect universe list shape (expected list or {universes:[]}): %s",
                        type(data).__name__,
                    )
                    universes_raw = []
                logger.info("Received %d universes from SagaArchitect", len(universes_raw))
                return universes_raw
            else:
                logger.warning("SagaArchitect universe list returned %s; falling back to local DB", resp.status_code)
        except httpx.RequestError as exc:
            logger.warning("Could not reach SagaArchitect (%s): %s; falling back to local DB", remote_url, exc)

    db = _db_ref()
    docs = await db.lore_universes.find().sort("created_at", -1).to_list(100)
    return [Universe(**d) for d in docs]


@lore_router.post("", response_model=Universe)
async def create_universe(data: UniverseCreate):
    db = _db_ref()
    universe = Universe(**data.dict())
    await db.lore_universes.insert_one(universe.dict())
    return universe


@lore_router.get("/{universe_id}", response_model=Universe)
async def get_universe(universe_id: str):
    db = _db_ref()
    doc = await db.lore_universes.find_one({"id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Universe not found")
    return Universe(**doc)


@lore_router.put("/{universe_id}", response_model=Universe)
async def update_universe(universe_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_universes.update_one({"id": universe_id}, {"$set": updates})
    doc = await db.lore_universes.find_one({"id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Universe not found")
    return Universe(**doc)


@lore_router.delete("/{universe_id}")
async def delete_universe(universe_id: str):
    db = _db_ref()
    for coll in ["lore_characters", "lore_factions", "lore_locations",
                 "lore_timeline_events", "lore_story_arcs", "lore_rules"]:
        await getattr(db, coll).delete_many({"universe_id": universe_id})
    await db.lore_universes.delete_one({"id": universe_id})
    return {"message": "Universe and all related lore deleted"}


# ── Universe Engine AI Generation ─────────────────────────────────────────────

@lore_router.post("/{universe_id}/generate")
async def generate_universe(universe_id: str, req: UniverseGenerateRequest):
    """
    Run the Universe Engine — auto-generate a complete fictional universe
    from user-supplied genre/tone/concept inputs.
    """
    db = _db_ref()

    _system = (
        "You are an expert worldbuilder and story-bible creator. "
        "You generate rich, internally consistent fictional universes. "
        "Always respond with valid JSON only, no extra text."
    )

    prompt = f"""Generate a complete fictional universe with the following parameters:

GENRE: {req.genre}
TONE: {req.tone}
CONCEPT: {req.concept}
ERA: {req.era or 'unspecified'}
TECHNOLOGY LEVEL: {req.technology_level or 'unspecified'}
MAGIC SYSTEM: {req.magic_system or 'none'}
CORE THEME: {req.core_theme or 'unspecified'}

Return a JSON object with these fields:
{{
  "world_overview": "3-4 sentences describing the world",
  "creation_myth": "The origin story of this universe (2-3 sentences)",
  "current_conflict": "The central conflict driving current events (2-3 sentences)",
  "prophecy_hooks": "1-2 prophetic hooks that could drive future stories",
  "timeline": [
    {{"era": "Era name", "title": "Event title", "summary": "Short summary", "consequences": "Impact on world"}}
  ],
  "factions": [
    {{"name": "Faction name", "type": "empire/guild/etc", "ideology": "Core belief", "territory": "Where they operate", "objective": "What they want", "internal_conflict": "Internal tensions"}}
  ],
  "locations": [
    {{"name": "Location name", "type": "city/region/etc", "description": "Vivid description", "strategic_value": "Why it matters", "mythic_importance": "Legendary significance"}}
  ],
  "characters": [
    {{"name": "Character name", "title": "Their title/rank", "role": "hero/villain/mentor/etc", "motivations": "What drives them", "powers": "Abilities or skills", "appearance": "Visual description", "arc_potential": "Their story potential"}}
  ],
  "world_rules": [
    {{"rule_type": "magic/technology/cultural/physical", "rule": "The rule itself", "consequence": "What happens if broken"}}
  ]
}}

Make 3 factions, 4 locations, 3 characters, and 4-6 world rules.
Ensure everything references the genre, tone, and concept.
Return ONLY the JSON, no other text."""

    raw = await _llm_fn(_system, prompt)

    try:
        data = json.loads(_clean_json(raw))
    except json.JSONDecodeError as e:
        logger.error(f"Universe generation JSON parse error: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")

    # Persist generated content into the universe and related collections
    updates = {
        "genre": req.genre,
        "tone": req.tone,
        "concept": req.concept,
        "era": req.era,
        "technology_level": req.technology_level,
        "magic_system": req.magic_system,
        "core_theme": req.core_theme,
        "world_overview": data.get("world_overview", ""),
        "creation_myth": data.get("creation_myth", ""),
        "current_conflict": data.get("current_conflict", ""),
        "prophecy_hooks": data.get("prophecy_hooks", ""),
        "updated_at": datetime.utcnow(),
    }
    await db.lore_universes.update_one({"id": universe_id}, {"$set": updates})

    for faction_data in data.get("factions", []):
        faction = Faction(universe_id=universe_id, **{
            k: faction_data.get(k, "")
            for k in ["name", "type", "ideology", "territory", "objective", "internal_conflict"]
        })
        await db.lore_factions.insert_one(faction.dict())

    for loc_data in data.get("locations", []):
        loc = LoreLocation(universe_id=universe_id, **{
            k: loc_data.get(k, "")
            for k in ["name", "type", "description", "strategic_value", "mythic_importance"]
        })
        await db.lore_locations.insert_one(loc.dict())

    for char_data in data.get("characters", []):
        char = LoreCharacter(universe_id=universe_id, **{
            k: char_data.get(k, "")
            for k in ["name", "title", "role", "motivations", "powers", "appearance", "arc_potential"]
        })
        await db.lore_characters.insert_one(char.dict())

    for rule_data in data.get("world_rules", []):
        rule = LoreRule(
            universe_id=universe_id,
            rule_type=rule_data.get("rule_type", ""),
            rule=rule_data.get("rule", ""),
            consequence=rule_data.get("consequence", ""),
        )
        await db.lore_rules.insert_one(rule.dict())

    for idx, ev_data in enumerate(data.get("timeline", [])):
        event = TimelineEvent(
            universe_id=universe_id,
            title=ev_data.get("title", f"Event {idx + 1}"),
            era_marker=ev_data.get("era", ""),
            summary=ev_data.get("summary", ""),
            consequences=ev_data.get("consequences", ""),
        )
        await db.lore_timeline_events.insert_one(event.dict())

    updated = await db.lore_universes.find_one({"id": universe_id})
    return Universe(**updated)


# ── Canon Memory ──────────────────────────────────────────────────────────────

@lore_router.get("/{universe_id}/canon-memory")
async def get_canon_memory(universe_id: str):
    """Return the canon memory packet for a universe."""
    return await _build_canon_memory(universe_id)


# ── Canon Validation ──────────────────────────────────────────────────────────

@lore_router.post("/{universe_id}/validate")
async def validate_canon(universe_id: str):
    """
    Detect canon contradictions such as dead characters appearing later,
    faction territory conflicts, magic rule violations, and duplicate entries.
    """
    db = _db_ref()
    universe = await db.lore_universes.find_one({"id": universe_id})
    if not universe:
        raise HTTPException(status_code=404, detail="Universe not found")

    conflicts: List[CanonConflict] = []

    characters = await db.lore_characters.find({"universe_id": universe_id}).to_list(100)
    factions = await db.lore_factions.find({"universe_id": universe_id}).to_list(100)
    events = await db.lore_timeline_events.find({"universe_id": universe_id}).to_list(100)
    rules = await db.lore_rules.find({"universe_id": universe_id}).to_list(100)

    # Duplicate character names
    char_names = [c["name"].strip().lower() for c in characters]
    seen_chars: set = set()
    for name in char_names:
        if name in seen_chars:
            conflicts.append(CanonConflict(
                severity="conflict",
                category="duplicate",
                description=f"Duplicate character name detected: '{name}'",
                entities=[name],
            ))
        seen_chars.add(name)

    # Duplicate faction names
    faction_names = [f["name"].strip().lower() for f in factions]
    seen_factions: set = set()
    for name in faction_names:
        if name in seen_factions:
            conflicts.append(CanonConflict(
                severity="conflict",
                category="duplicate",
                description=f"Duplicate faction name detected: '{name}'",
                entities=[name],
            ))
        seen_factions.add(name)

    # Dead characters referenced in later timeline events
    dead_characters = {c["name"].strip().lower() for c in characters if c.get("status") == "dead"}
    for event in events:
        for affected in event.get("affected_characters", []):
            if affected.strip().lower() in dead_characters:
                conflicts.append(CanonConflict(
                    severity="critical_conflict",
                    category="character",
                    description=(
                        f"Dead character '{affected}' is referenced in timeline event "
                        f"'{event['title']}'. This is a canon contradiction."
                    ),
                    entities=[affected, event["title"]],
                ))

    # Characters referencing non-existent factions
    faction_ids = {f["id"] for f in factions}
    for char in characters:
        fid = char.get("faction_id")
        if fid and fid not in faction_ids:
            conflicts.append(CanonConflict(
                severity="warning",
                category="faction",
                description=(
                    f"Character '{char['name']}' references faction ID '{fid}' "
                    "which no longer exists."
                ),
                entities=[char["name"]],
            ))

    # Empty world rules (flag as warnings so builders know to fill them in)
    for rule in rules:
        if not rule.get("rule", "").strip():
            conflicts.append(CanonConflict(
                severity="warning",
                category="magic",
                description="A world rule entry has an empty rule description.",
                entities=[rule["id"]],
            ))

    return {
        "universe_id": universe_id,
        "conflict_count": len(conflicts),
        "conflicts": [c.dict() for c in conflicts],
    }


# ── Rainstorms Integration ─────────────────────────────────────────────────────

@lore_router.get("/{universe_id}/story-context")
async def get_story_context(universe_id: str):
    """
    Rainstorms integration endpoint.
    Returns universe tone, world rules, relevant characters, factions,
    locations, and timeline context so Rainstorms can generate consistent stories.
    """
    db = _db_ref()
    universe = await db.lore_universes.find_one({"id": universe_id})
    if not universe:
        raise HTTPException(status_code=404, detail="Universe not found")

    characters = await db.lore_characters.find({"universe_id": universe_id, "canon_status": "canon"}).to_list(50)
    factions = await db.lore_factions.find({"universe_id": universe_id, "canon_status": "canon"}).to_list(50)
    locations = await db.lore_locations.find({"universe_id": universe_id, "canon_status": "canon"}).to_list(50)
    rules = await db.lore_rules.find({"universe_id": universe_id, "canon_status": "canon"}).to_list(50)
    events = await db.lore_timeline_events.find({"universe_id": universe_id, "canon_status": "canon"}).sort("era_marker", 1).to_list(30)

    return {
        "universe_id": universe_id,
        "universe_name": universe["name"],
        "universe_tone": universe.get("tone", ""),
        "world_overview": universe.get("world_overview", ""),
        "current_conflict": universe.get("current_conflict", ""),
        "world_rules": [
            {"rule_type": r.get("rule_type", ""), "rule": r["rule"], "consequence": r.get("consequence", "")}
            for r in rules
        ],
        "relevant_characters": [
            {
                "name": c["name"],
                "title": c.get("title", ""),
                "role": c.get("role", ""),
                "appearance": c.get("appearance", ""),
                "motivations": c.get("motivations", ""),
                "status": c.get("status", "alive"),
            }
            for c in characters
        ],
        "relevant_factions": [
            {"name": f["name"], "ideology": f.get("ideology", ""), "territory": f.get("territory", "")}
            for f in factions
        ],
        "relevant_locations": [
            {"name": l["name"], "type": l.get("type", ""), "description": l.get("description", "")}
            for l in locations
        ],
        "timeline_context": [
            {"era": e.get("era_marker", ""), "title": e["title"], "summary": e.get("summary", "")}
            for e in events
        ],
    }


# ── Character Generator ───────────────────────────────────────────────────────

@lore_router.post("/{universe_id}/generate-character", response_model=LoreCharacter)
async def generate_character(universe_id: str, req: CharacterGenerateRequest):
    db = _db_ref()
    memory = await _build_canon_memory(universe_id)
    context = _memory_to_prompt_text(memory)

    _system = (
        "You are a story-bible character designer. "
        "Generate characters that fit existing lore without contradictions. "
        "Respond with valid JSON only."
    )

    prompt = f"""Generate a {req.role} character for this universe:

{context}

Return JSON:
{{
  "name": "Character name",
  "title": "Their title or rank",
  "role": "{req.role}",
  "motivations": "What drives them (2-3 sentences)",
  "fears": "Their deepest fears",
  "powers": "Abilities or skills (consistent with world rules)",
  "weaknesses": "What limits them",
  "appearance": "Visual description (2-3 sentences)",
  "speech_style": "How they speak",
  "arc_potential": "Their story arc potential"
}}

Ensure the character fits the universe tone and respects world rules.
Return ONLY the JSON."""

    raw = await _llm_fn(_system, prompt)
    try:
        data = json.loads(_clean_json(raw))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")

    char = LoreCharacter(universe_id=universe_id, **{k: data.get(k, "") for k in [
        "name", "title", "role", "motivations", "fears", "powers",
        "weaknesses", "appearance", "speech_style", "arc_potential",
    ]})
    await db.lore_characters.insert_one(char.dict())
    return char


# ── Faction Generator ─────────────────────────────────────────────────────────

@lore_router.post("/{universe_id}/generate-faction", response_model=Faction)
async def generate_faction(universe_id: str, req: FactionGenerateRequest):
    db = _db_ref()
    memory = await _build_canon_memory(universe_id)
    context = _memory_to_prompt_text(memory)

    _system = (
        "You are a worldbuilder specialising in organisations and factions. "
        "Respond with valid JSON only."
    )

    existing_factions = ", ".join(f["name"] for f in memory["factions"]) or "none yet"

    prompt = f"""Generate a {req.faction_type} faction for this universe:

{context}

Existing factions: {existing_factions}

Return JSON:
{{
  "name": "Faction name",
  "type": "{req.faction_type}",
  "ideology": "Core belief or philosophy",
  "leader": "Current leader name and title",
  "resources": "What they control or possess",
  "territory": "Where they operate",
  "allies": ["Allied faction names"],
  "enemies": ["Enemy faction names"],
  "internal_conflict": "Tensions within the faction",
  "objective": "What they are trying to achieve",
  "symbol": "Their emblem or symbol description"
}}

Ensure the faction fits the universe and does not duplicate existing factions.
Return ONLY the JSON."""

    raw = await _llm_fn(_system, prompt)
    try:
        data = json.loads(_clean_json(raw))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")

    faction = Faction(
        universe_id=universe_id,
        name=data.get("name", ""),
        type=data.get("type", req.faction_type),
        ideology=data.get("ideology", ""),
        leader=data.get("leader", ""),
        resources=data.get("resources", ""),
        territory=data.get("territory", ""),
        allies=data.get("allies", []),
        enemies=data.get("enemies", []),
        internal_conflict=data.get("internal_conflict", ""),
        objective=data.get("objective", ""),
        symbol=data.get("symbol", ""),
    )
    await db.lore_factions.insert_one(faction.dict())
    return faction


# ── Story Arc Generator ───────────────────────────────────────────────────────

@lore_router.post("/{universe_id}/generate-arc", response_model=StoryArc)
async def generate_arc(universe_id: str, req: StoryArcGenerateRequest):
    db = _db_ref()
    memory = await _build_canon_memory(universe_id)
    context = _memory_to_prompt_text(memory)

    _system = (
        "You are a narrative designer specialising in story arcs for fictional universes. "
        "Respond with valid JSON only."
    )

    char_list = ", ".join(c["name"] for c in memory["characters"]) or "none defined"
    faction_list = ", ".join(f["name"] for f in memory["factions"]) or "none defined"

    prompt = f"""Generate a {req.arc_type} story arc for this universe:

{context}

Available characters: {char_list}
Available factions: {faction_list}

Return JSON:
{{
  "title": "Arc title",
  "type": "{req.arc_type}",
  "summary": "3-4 sentence overview of the arc",
  "start_point": "How the arc begins",
  "end_point": "How the arc could end",
  "characters": ["Character names involved"],
  "factions": ["Faction names involved"],
  "themes": ["Core themes"],
  "turning_points": ["Key turning point 1", "Key turning point 2", "Key turning point 3"]
}}

Connect to existing timeline events and factions.
Return ONLY the JSON."""

    raw = await _llm_fn(_system, prompt)
    try:
        data = json.loads(_clean_json(raw))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON. Please try again.")

    arc = StoryArc(
        universe_id=universe_id,
        title=data.get("title", ""),
        type=data.get("type", req.arc_type),
        summary=data.get("summary", ""),
        start_point=data.get("start_point", ""),
        end_point=data.get("end_point", ""),
        characters=data.get("characters", []),
        factions=data.get("factions", []),
        themes=data.get("themes", []),
        turning_points=data.get("turning_points", []),
    )
    await db.lore_story_arcs.insert_one(arc.dict())
    return arc


# ══════════════════════════════════════════════════════════════════════════════
# CHARACTERS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("/{universe_id}/characters", response_model=List[LoreCharacter])
async def list_lore_characters(universe_id: str):
    db = _db_ref()
    docs = await db.lore_characters.find({"universe_id": universe_id}).to_list(100)
    return [LoreCharacter(**d) for d in docs]


@lore_router.post("/{universe_id}/characters", response_model=LoreCharacter)
async def create_lore_character(universe_id: str, data: LoreCharacterCreate):
    db = _db_ref()
    char = LoreCharacter(universe_id=universe_id, **data.dict())
    await db.lore_characters.insert_one(char.dict())
    return char


@lore_router.get("/{universe_id}/characters/{character_id}", response_model=LoreCharacter)
async def get_lore_character(universe_id: str, character_id: str):
    db = _db_ref()
    doc = await db.lore_characters.find_one({"id": character_id, "universe_id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Character not found")
    return LoreCharacter(**doc)


@lore_router.put("/{universe_id}/characters/{character_id}", response_model=LoreCharacter)
async def update_lore_character(universe_id: str, character_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_characters.update_one({"id": character_id, "universe_id": universe_id}, {"$set": updates})
    doc = await db.lore_characters.find_one({"id": character_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Character not found")
    return LoreCharacter(**doc)


@lore_router.delete("/{universe_id}/characters/{character_id}")
async def delete_lore_character(universe_id: str, character_id: str):
    db = _db_ref()
    await db.lore_characters.delete_one({"id": character_id, "universe_id": universe_id})
    return {"message": "Character deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# FACTIONS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("/{universe_id}/factions", response_model=List[Faction])
async def list_factions(universe_id: str):
    db = _db_ref()
    docs = await db.lore_factions.find({"universe_id": universe_id}).to_list(100)
    return [Faction(**d) for d in docs]


@lore_router.post("/{universe_id}/factions", response_model=Faction)
async def create_faction(universe_id: str, data: FactionCreate):
    db = _db_ref()
    faction = Faction(universe_id=universe_id, **data.dict())
    await db.lore_factions.insert_one(faction.dict())
    return faction


@lore_router.get("/{universe_id}/factions/{faction_id}", response_model=Faction)
async def get_faction(universe_id: str, faction_id: str):
    db = _db_ref()
    doc = await db.lore_factions.find_one({"id": faction_id, "universe_id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Faction not found")
    return Faction(**doc)


@lore_router.put("/{universe_id}/factions/{faction_id}", response_model=Faction)
async def update_faction(universe_id: str, faction_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_factions.update_one({"id": faction_id, "universe_id": universe_id}, {"$set": updates})
    doc = await db.lore_factions.find_one({"id": faction_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Faction not found")
    return Faction(**doc)


@lore_router.delete("/{universe_id}/factions/{faction_id}")
async def delete_faction(universe_id: str, faction_id: str):
    db = _db_ref()
    await db.lore_factions.delete_one({"id": faction_id, "universe_id": universe_id})
    return {"message": "Faction deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# LOCATIONS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("/{universe_id}/locations", response_model=List[LoreLocation])
async def list_locations(universe_id: str):
    db = _db_ref()
    docs = await db.lore_locations.find({"universe_id": universe_id}).to_list(100)
    return [LoreLocation(**d) for d in docs]


@lore_router.post("/{universe_id}/locations", response_model=LoreLocation)
async def create_location(universe_id: str, data: LoreLocationCreate):
    db = _db_ref()
    loc = LoreLocation(universe_id=universe_id, **data.dict())
    await db.lore_locations.insert_one(loc.dict())
    return loc


@lore_router.get("/{universe_id}/locations/{location_id}", response_model=LoreLocation)
async def get_location(universe_id: str, location_id: str):
    db = _db_ref()
    doc = await db.lore_locations.find_one({"id": location_id, "universe_id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")
    return LoreLocation(**doc)


@lore_router.put("/{universe_id}/locations/{location_id}", response_model=LoreLocation)
async def update_location(universe_id: str, location_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_locations.update_one({"id": location_id, "universe_id": universe_id}, {"$set": updates})
    doc = await db.lore_locations.find_one({"id": location_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")
    return LoreLocation(**doc)


@lore_router.delete("/{universe_id}/locations/{location_id}")
async def delete_location(universe_id: str, location_id: str):
    db = _db_ref()
    await db.lore_locations.delete_one({"id": location_id, "universe_id": universe_id})
    return {"message": "Location deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# TIMELINE EVENTS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("/{universe_id}/timeline", response_model=List[TimelineEvent])
async def list_timeline_events(universe_id: str):
    db = _db_ref()
    docs = await db.lore_timeline_events.find({"universe_id": universe_id}).sort("era_marker", 1).to_list(100)
    return [TimelineEvent(**d) for d in docs]


@lore_router.post("/{universe_id}/timeline", response_model=TimelineEvent)
async def create_timeline_event(universe_id: str, data: TimelineEventCreate):
    db = _db_ref()
    event = TimelineEvent(universe_id=universe_id, **data.dict())
    await db.lore_timeline_events.insert_one(event.dict())
    return event


@lore_router.get("/{universe_id}/timeline/{event_id}", response_model=TimelineEvent)
async def get_timeline_event(universe_id: str, event_id: str):
    db = _db_ref()
    doc = await db.lore_timeline_events.find_one({"id": event_id, "universe_id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    return TimelineEvent(**doc)


@lore_router.put("/{universe_id}/timeline/{event_id}", response_model=TimelineEvent)
async def update_timeline_event(universe_id: str, event_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_timeline_events.update_one({"id": event_id, "universe_id": universe_id}, {"$set": updates})
    doc = await db.lore_timeline_events.find_one({"id": event_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    return TimelineEvent(**doc)


@lore_router.delete("/{universe_id}/timeline/{event_id}")
async def delete_timeline_event(universe_id: str, event_id: str):
    db = _db_ref()
    await db.lore_timeline_events.delete_one({"id": event_id, "universe_id": universe_id})
    return {"message": "Timeline event deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# STORY ARCS CRUD
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("/{universe_id}/arcs", response_model=List[StoryArc])
async def list_story_arcs(universe_id: str):
    db = _db_ref()
    docs = await db.lore_story_arcs.find({"universe_id": universe_id}).to_list(100)
    return [StoryArc(**d) for d in docs]


@lore_router.post("/{universe_id}/arcs", response_model=StoryArc)
async def create_story_arc(universe_id: str, data: StoryArcCreate):
    db = _db_ref()
    arc = StoryArc(universe_id=universe_id, **data.dict())
    await db.lore_story_arcs.insert_one(arc.dict())
    return arc


@lore_router.get("/{universe_id}/arcs/{arc_id}", response_model=StoryArc)
async def get_story_arc(universe_id: str, arc_id: str):
    db = _db_ref()
    doc = await db.lore_story_arcs.find_one({"id": arc_id, "universe_id": universe_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story arc not found")
    return StoryArc(**doc)


@lore_router.put("/{universe_id}/arcs/{arc_id}", response_model=StoryArc)
async def update_story_arc(universe_id: str, arc_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_story_arcs.update_one({"id": arc_id, "universe_id": universe_id}, {"$set": updates})
    doc = await db.lore_story_arcs.find_one({"id": arc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Story arc not found")
    return StoryArc(**doc)


@lore_router.delete("/{universe_id}/arcs/{arc_id}")
async def delete_story_arc(universe_id: str, arc_id: str):
    db = _db_ref()
    await db.lore_story_arcs.delete_one({"id": arc_id, "universe_id": universe_id})
    return {"message": "Story arc deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# LORE RULES CRUD
# ══════════════════════════════════════════════════════════════════════════════

@lore_router.get("/{universe_id}/rules", response_model=List[LoreRule])
async def list_lore_rules(universe_id: str):
    db = _db_ref()
    docs = await db.lore_rules.find({"universe_id": universe_id}).to_list(100)
    return [LoreRule(**d) for d in docs]


@lore_router.post("/{universe_id}/rules", response_model=LoreRule)
async def create_lore_rule(universe_id: str, data: LoreRuleCreate):
    db = _db_ref()
    rule = LoreRule(universe_id=universe_id, **data.dict())
    await db.lore_rules.insert_one(rule.dict())
    return rule


@lore_router.put("/{universe_id}/rules/{rule_id}", response_model=LoreRule)
async def update_lore_rule(universe_id: str, rule_id: str, updates: dict):
    db = _db_ref()
    updates["updated_at"] = datetime.utcnow()
    await db.lore_rules.update_one({"id": rule_id, "universe_id": universe_id}, {"$set": updates})
    doc = await db.lore_rules.find_one({"id": rule_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Lore rule not found")
    return LoreRule(**doc)


@lore_router.delete("/{universe_id}/rules/{rule_id}")
async def delete_lore_rule(universe_id: str, rule_id: str):
    db = _db_ref()
    await db.lore_rules.delete_one({"id": rule_id, "universe_id": universe_id})
    return {"message": "Lore rule deleted"}


# ══════════════════════════════════════════════════════════════════════════════
# META — SAGAARCHITECT SYNC
# ══════════════════════════════════════════════════════════════════════════════

class SyncPayload(BaseModel):
    """
    Full-universe sync payload sent by SagaArchitect's 'Sync to Rainstorms' button.

    SagaArchitect maps its own field names to Rainstorms' schema before posting,
    so all incoming field names should match the Rainstorms models.  We accept
    raw dicts (rather than strict Pydantic models) to stay robust against minor
    schema differences or extra fields.

    Expected shape
    --------------
    {
      "universe":    { id, name, genre, tone, concept, … },
      "factions":    [ { id, name, type, ideology, … }, … ],
      "characters":  [ { id, name, role, status, … }, … ],
      "locations":   [ { id, name, type, description, … }, … ],
      "timeline":    [ { id, title, era_marker, summary, … }, … ],
      "story_arcs":  [ { id, title, type, summary, … }, … ],
      "lore_rules":  [ { id, rule_type, rule, consequence, … }, … ]
    }
    """
    universe: Dict[str, Any]
    factions: List[Dict[str, Any]] = []
    characters: List[Dict[str, Any]] = []
    locations: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []
    story_arcs: List[Dict[str, Any]] = []
    lore_rules: List[Dict[str, Any]] = []


@meta_router.post("/sync")
async def sync_from_sagaarchitect(payload: SyncPayload):
    """
    POST /api/lore/sync

    Accepts a full-universe sync from SagaArchitect (or any compatible tool)
    and upserts the universe plus all its lore entities into the database.

    * If an entity's ``id`` already exists it is updated; otherwise a new
      document is inserted.
    * ``universe_id`` is always set (or overridden) to the incoming universe's
      ``id``, ensuring all child entities are correctly linked even if
      SagaArchitect's internal universe_id differs.

    Returns a summary of what was created and updated.
    """
    db = _db_ref()
    now = datetime.utcnow().isoformat()

    # ── universe ──────────────────────────────────────────────────────────────
    universe_doc = dict(payload.universe)
    if not universe_doc.get("id"):
        universe_doc["id"] = str(uuid.uuid4())

    uid = universe_doc["id"]
    universe_doc["updated_at"] = now

    existing_universe = await db.lore_universes.find_one({"id": uid})
    if existing_universe:
        await db.lore_universes.update_one({"id": uid}, {"$set": universe_doc})
        universe_action = "updated"
    else:
        if not universe_doc.get("created_at"):
            universe_doc["created_at"] = now
        await db.lore_universes.insert_one(universe_doc)
        universe_action = "created"

    # ── entity collections ────────────────────────────────────────────────────
    collection_map = [
        ("lore_factions",        payload.factions,    "factions"),
        ("lore_characters",      payload.characters,  "characters"),
        ("lore_locations",       payload.locations,   "locations"),
        ("lore_timeline_events", payload.timeline,    "timeline"),
        ("lore_story_arcs",      payload.story_arcs,  "story_arcs"),
        ("lore_rules",           payload.lore_rules,  "lore_rules"),
    ]

    counts: Dict[str, Dict[str, int]] = {"created": {}, "updated": {}}

    for collection_name, entities, label in collection_map:
        created = 0
        updated = 0
        for entity in entities:
            doc = dict(entity)
            # Guarantee linkage to this universe
            doc["universe_id"] = uid
            doc["updated_at"] = now

            if not doc.get("id"):
                doc["id"] = str(uuid.uuid4())

            existing_doc = await db[collection_name].find_one({"id": doc["id"]})
            if existing_doc:
                await db[collection_name].update_one({"id": doc["id"]}, {"$set": doc})
                updated += 1
            else:
                if not doc.get("created_at"):
                    doc["created_at"] = now
                await db[collection_name].insert_one(doc)
                created += 1

        if created:
            counts["created"][label] = created
        if updated:
            counts["updated"][label] = updated

    return {
        "success": True,
        "universe_id": uid,
        "universe": universe_action,
        "created": counts["created"],
        "updated": counts["updated"],
        "total_entities": sum(len(e) for _, e, _ in collection_map),
    }


# ══════════════════════════════════════════════════════════════════════════════
# META — DEMO SEEDING
# ══════════════════════════════════════════════════════════════════════════════

@meta_router.post("/seed-demo")
async def seed_demo_universe():
    """Seed 'The Ashen Veil' demo universe."""
    db = _db_ref()

    existing = await db.lore_universes.find_one({"name": "The Ashen Veil"})
    if existing:
        return {"message": "Demo universe already exists", "universe_id": existing["id"]}

    universe = Universe(
        name="The Ashen Veil",
        genre="Dark Fantasy",
        tone="Epic, tragic, mythic",
        concept=(
            "A world where the sky is perpetually veiled in silver ash "
            "after the gods burned themselves out fighting a primordial Void. "
            "Civilisations cling to heat-sources called Hearth Pillars."
        ),
        technology_level="Medieval-industrial (steam powered by captured volcanic vents)",
        magic_system=(
            "Storm magic — wielders channel the residual energy of dead gods. "
            "Storm magic erases personal memories proportional to power used."
        ),
        era="The Third Ashfall — 800 years after the God-War",
        core_theme="The cost of power and the grief of forgetting",
        world_overview=(
            "The Ashen Veil is a world draped in perpetual silver ash, "
            "legacy of the God-War that ended the divine age eight centuries ago. "
            "Three great factions vie for control of the Hearth Pillars — "
            "the only sources of warmth in a dying world. "
            "Storm Mages are revered and feared; each spell they cast costs them a memory."
        ),
        creation_myth=(
            "In the First Age, the gods sang the world into existence. "
            "When the Void came to unmake creation, the gods sacrificed themselves "
            "in a cataclysmic firestorm. Their ashes became the Veil, "
            "and their spent divinity seeps through storms."
        ),
        current_conflict=(
            "The Covenant of Embers (guardians of the Hearth Pillars) "
            "is fracturing as the Ashen Throne (ruling empire) "
            "and the Hollow Prophets (a doomsday cult) both seek to control "
            "the last functional Pillar — the Sunken Spire."
        ),
        prophecy_hooks=(
            "A Storm Mage who forgets everything will remember one truth: "
            "the Void was not the enemy. "
            "The last Hearth Pillar holds the sleeping voice of the final god."
        ),
    )
    await db.lore_universes.insert_one(universe.dict())
    uid = universe.id

    # Factions
    factions_data = [
        Faction(
            universe_id=uid,
            name="The Ashen Throne",
            type="empire",
            ideology="Order through control of warmth. Only the strong deserve heat.",
            leader="Empress Vael Duskmore",
            resources="Armies, tax revenue, three minor Hearth Pillars",
            territory="The Central Reaches and the Ironfeld Plains",
            allies=["Ironfeld Merchant Guilds"],
            enemies=["Covenant of Embers", "Hollow Prophets"],
            internal_conflict="Succession crisis — the Empress is dying and has no heir",
            objective="Seize the Sunken Spire before rivals can",
            symbol="A silver crown surrounded by ash-flames",
        ),
        Faction(
            universe_id=uid,
            name="Covenant of Embers",
            type="religious_order",
            ideology="The Hearth Pillars are sacred relics of the gods and must be shared equally",
            leader="High Tender Oris Flameheld",
            resources="Ancient knowledge, Storm Mages, popular support",
            territory="Emberveil Monasteries scattered across all regions",
            allies=["Village communes", "independent Storm Mages"],
            enemies=["The Ashen Throne"],
            internal_conflict="Hard-line Tenders want to destroy the Pillars rather than let them be taken",
            objective="Protect the Sunken Spire and prove the gods' last message lies within",
            symbol="An open hand cradling a flame",
        ),
        Faction(
            universe_id=uid,
            name="The Hollow Prophets",
            type="secret_society",
            ideology="The Void was the true creator and the gods were tyrants — welcome the final dark",
            leader="The Unnamed Seer (identity unknown)",
            resources="Sabotage networks, corrupted Storm Mages, hidden tunnels",
            territory="Operates in every city's underbelly",
            allies=[],
            enemies=["Covenant of Embers", "The Ashen Throne"],
            internal_conflict="Splinter cells disagree on timeline — immediate apocalypse vs. slow preparation",
            objective="Destroy all Hearth Pillars and invite the Void back",
            symbol="A hollow circle with a single void-black dot at centre",
        ),
    ]
    for f in factions_data:
        await db.lore_factions.insert_one(f.dict())

    # Locations
    locations_data = [
        LoreLocation(
            universe_id=uid,
            name="The Sunken Spire",
            type="ancient ruin",
            region="The Ashfall Coast",
            description=(
                "A massive obsidian tower half-submerged in a sea of petrified ash. "
                "Its upper spires still glow with godfire. "
                "The last fully functional Hearth Pillar."
            ),
            strategic_value="Whoever controls it controls the warmth of the entire eastern seaboard",
            mythic_importance="Believed to contain the sleeping consciousness of Aethon, the final god",
            controlling_faction="Disputed",
        ),
        LoreLocation(
            universe_id=uid,
            name="Vael City",
            type="capital city",
            region="The Central Reaches",
            description=(
                "A sprawling city built in concentric rings around a Hearth Pillar. "
                "The inner rings are warm and wealthy; the outer rings freeze and starve."
            ),
            strategic_value="Political and military capital of the Ashen Throne",
            mythic_importance="Site of the first post-God-War human covenant",
            controlling_faction="The Ashen Throne",
        ),
        LoreLocation(
            universe_id=uid,
            name="The Ashfall Coast",
            type="region",
            region="Eastern seaboard",
            description=(
                "A desolate coastline where ash-fall is heaviest. "
                "Home to the Sunken Spire and nomadic ash-fisher tribes."
            ),
            strategic_value="Access to the Sunken Spire and ancient god-ruins",
            mythic_importance="Where the God-War ended — ash is deepest here",
            controlling_faction="Unclaimed",
        ),
        LoreLocation(
            universe_id=uid,
            name="The Ironfeld Plains",
            type="region",
            region="Western flatlands",
            description=(
                "Vast plains where volcanic steam vents power primitive industry. "
                "The Ashen Throne extracts wealth here through steam-works and mines."
            ),
            strategic_value="Industrial heartland — produces weapons and food",
            mythic_importance="Beneath the plains lies the tomb of the War-God Ferrus",
            controlling_faction="The Ashen Throne",
        ),
    ]
    for l in locations_data:
        await db.lore_locations.insert_one(l.dict())

    # Characters
    characters_data = [
        LoreCharacter(
            universe_id=uid,
            name="Solen Ashveil",
            title="The Forgetting Knight",
            role="hero",
            motivations="Protect the people who cannot protect themselves; find who he was before the forgetting",
            fears="That the memories he has lost included someone he loved",
            powers="Powerful Storm Magic — can summon lightning and ash-storms",
            weaknesses="Every major spell erases weeks of memory; he keeps a journal to remember",
            appearance=(
                "Tall, silver-haired (premature from magic use), pale grey eyes that glow faintly in storms. "
                "Wears black armour traced with ember-orange runes. A worn journal is always at his belt."
            ),
            speech_style="Measured, quiet, occasionally pauses mid-sentence as he searches lost words",
            arc_potential="Discover his erased past contains the key to saving the Sunken Spire",
            status="alive",
        ),
        LoreCharacter(
            universe_id=uid,
            name="Empress Vael Duskmore",
            title="The Ashen Empress",
            role="antagonist",
            motivations="Secure her legacy before she dies; ensure the empire outlasts her",
            fears="Being forgotten — her greatest terror mirrors what Storm Mages suffer",
            powers="Brilliant military strategist; political manipulation",
            weaknesses="Terminal illness; increasingly paranoid; no true allies",
            appearance=(
                "Regal and gaunt. Deep brown skin gone ashen around the edges. "
                "Always in imperial silver-and-black robes. Crown of braided ash-iron."
            ),
            speech_style="Formal, controlled, every word chosen — but sometimes slips into raw grief",
            arc_potential="Possible redemption if she chooses people over legacy in the final act",
            status="alive",
        ),
        LoreCharacter(
            universe_id=uid,
            name="Lira Flameheld",
            title="Tender-Apprentice",
            role="mentor",
            motivations="Uncover the truth inside the Sunken Spire; protect the last god's voice",
            fears="That the gods were not worth saving",
            powers="Deep scholarly knowledge of god-lore; minor flame-tending (non-destructive fire magic)",
            weaknesses="Physically fragile; overly trusting of ancient texts over living people",
            appearance=(
                "Small, compact, warm brown skin, perpetually ink-stained fingers. "
                "Ember-orange robes of the Covenant. Carries a lantern that never goes out."
            ),
            speech_style="Enthusiastic, fast-talking, quotes old texts mid-conversation",
            arc_potential="Must choose between the gods' last command and saving her friends",
            status="alive",
        ),
    ]
    for c in characters_data:
        await db.lore_characters.insert_one(c.dict())

    # Lore rules
    rules_data = [
        LoreRule(
            universe_id=uid,
            rule_type="magic",
            rule="Storm magic erases personal memories proportional to power used",
            consequence="A Storm Mage who casts too much eventually forgets who they are entirely",
        ),
        LoreRule(
            universe_id=uid,
            rule_type="physical",
            rule="The ash-veil blocks most sunlight — natural crops cannot grow without Hearth Pillar warmth",
            consequence="Civilisations that lose access to a Hearth Pillar collapse within a generation",
        ),
        LoreRule(
            universe_id=uid,
            rule_type="cultural",
            rule="Recording your own history (journaling, carving) is considered sacred — called 'memory-keeping'",
            consequence="Destroying another's records is the highest crime short of murder",
        ),
        LoreRule(
            universe_id=uid,
            rule_type="magic",
            rule="Void corruption spreads through despair — those who give up hope are vulnerable",
            consequence="Void-touched individuals slowly lose physical form and become hollow",
        ),
        LoreRule(
            universe_id=uid,
            rule_type="technology",
            rule="Steam-works require volcanic vent access — the Ashen Throne controls all registered vents",
            consequence="Independent industry is technically illegal without an Ashen Throne licence",
        ),
    ]
    for r in rules_data:
        await db.lore_rules.insert_one(r.dict())

    # Timeline events
    events_data = [
        TimelineEvent(
            universe_id=uid,
            title="The God-War",
            era_marker="Year 0 — Before Reckoning",
            summary="The gods unite against the Void in a cataclysmic battle that consumes them all",
            affected_characters=[],
            affected_factions=[],
            affected_locations=["The Ashfall Coast"],
            consequences="The gods are destroyed; the Ashen Veil is created; Storm magic becomes accessible to mortals",
            hidden_truths="The Void did not initiate the war — a faction of gods did, to claim sole dominion",
        ),
        TimelineEvent(
            universe_id=uid,
            title="The First Covenant",
            era_marker="Year 12 — Post-Reckoning",
            summary="Surviving human leaders gather at Vael City and sign the First Covenant, agreeing to share Hearth Pillars",
            affected_characters=[],
            affected_factions=["Covenant of Embers"],
            affected_locations=["Vael City"],
            consequences="The Covenant of Embers is founded to enforce sharing; relative peace for 200 years",
            hidden_truths="The First Covenant was signed under duress — one signatory planned to break it from day one",
        ),
        TimelineEvent(
            universe_id=uid,
            title="The Ashen Throne Rises",
            era_marker="Year 312 — Post-Reckoning",
            summary="A military general seizes three Hearth Pillars and declares the Ashen Throne",
            affected_characters=["Empress Vael Duskmore's ancestor"],
            affected_factions=["The Ashen Throne", "Covenant of Embers"],
            affected_locations=["Vael City", "The Ironfeld Plains"],
            consequences="Two centuries of cold war between the Throne and the Covenant",
            hidden_truths="The founding general was secretly storm-magic-addled and forgot he had a family he abandoned",
        ),
        TimelineEvent(
            universe_id=uid,
            title="The Hollow Prophets First Strike",
            era_marker="Year 780 — Post-Reckoning",
            summary="An unknown group destroys two minor Hearth Pillars, killing thousands",
            affected_characters=[],
            affected_factions=["The Hollow Prophets"],
            affected_locations=["The Ironfeld Plains"],
            consequences="The Hollow Prophets are revealed to exist; paranoia grips all factions",
            hidden_truths="The Unnamed Seer orchestrated this to force all factions toward the Sunken Spire",
        ),
        TimelineEvent(
            universe_id=uid,
            title="The Present Crisis",
            era_marker="Year 800 — Post-Reckoning (Current)",
            summary="The Empress is dying, the Covenant is fracturing, and the Hollow Prophets are moving toward the Sunken Spire",
            affected_characters=["Solen Ashveil", "Empress Vael Duskmore", "Lira Flameheld"],
            affected_factions=["The Ashen Throne", "Covenant of Embers", "The Hollow Prophets"],
            affected_locations=["The Sunken Spire"],
            consequences="All three factions converge — war is inevitable unless someone finds another way",
            hidden_truths="The Sunken Spire contains the last god's voice — and it has been waiting to be heard",
        ),
    ]
    for e in events_data:
        await db.lore_timeline_events.insert_one(e.dict())

    # Story arc
    arc = StoryArc(
        universe_id=uid,
        title="The Sunken Spire War",
        type="trilogy_arc",
        summary=(
            "Three factions converge on the last Hearth Pillar. "
            "A Storm Mage who has forgotten almost everything holds the key to the last god's message. "
            "The choice he makes will either save the world or invite the Void back."
        ),
        start_point="Solen Ashveil is hired as an escort to protect Lira on her pilgrimage to the Sunken Spire",
        end_point="Solen must cast the most powerful storm spell ever attempted — knowing he will forget everything — to awaken the last god",
        characters=["Solen Ashveil", "Empress Vael Duskmore", "Lira Flameheld"],
        factions=["Covenant of Embers", "The Ashen Throne", "The Hollow Prophets"],
        themes=["Memory and identity", "Sacrifice", "The cost of power", "What gods owe mortals"],
        turning_points=[
            "Solen discovers his journal reveals he once worked for the Ashen Throne",
            "The Empress offers to restore Solen's memories if he delivers the Spire to the Throne",
            "The Unnamed Seer is revealed to be someone Solen forgot",
            "Lira deciphers the last god's message — it is a warning, not a salvation",
        ],
    )
    await db.lore_story_arcs.insert_one(arc.dict())

    return {"message": "Demo universe 'The Ashen Veil' seeded successfully", "universe_id": uid}


@meta_router.get("/demo-universe")
async def get_demo_universe():
    """Return the Ashen Veil demo universe with all its lore."""
    db = _db_ref()
    doc = await db.lore_universes.find_one({"name": "The Ashen Veil"})
    if not doc:
        await seed_demo_universe()
        doc = await db.lore_universes.find_one({"name": "The Ashen Veil"})

    uid = doc["id"]
    characters = await db.lore_characters.find({"universe_id": uid}).to_list(50)
    factions = await db.lore_factions.find({"universe_id": uid}).to_list(50)
    locations = await db.lore_locations.find({"universe_id": uid}).to_list(50)
    rules = await db.lore_rules.find({"universe_id": uid}).to_list(50)
    events = await db.lore_timeline_events.find({"universe_id": uid}).sort("era_marker", 1).to_list(50)
    arcs = await db.lore_story_arcs.find({"universe_id": uid}).to_list(20)

    return {
        "universe": Universe(**doc),
        "characters": [LoreCharacter(**c) for c in characters],
        "factions": [Faction(**f) for f in factions],
        "locations": [LoreLocation(**l) for l in locations],
        "rules": [LoreRule(**r) for r in rules],
        "timeline": [TimelineEvent(**e) for e in events],
        "arcs": [StoryArc(**a) for a in arcs],
    }
