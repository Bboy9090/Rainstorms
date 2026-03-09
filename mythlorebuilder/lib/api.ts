/**
 * MythLoreBuilder API client — talks to the LoreEngine FastAPI backend.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8001";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Universe {
  id: string;
  name: string;
  genre: string;
  tone: string;
  concept: string;
  technology_level: string;
  magic_system: string;
  era: string;
  core_theme: string;
  world_overview: string;
  creation_myth: string;
  current_conflict: string;
  prophecy_hooks: string;
  created_at: string;
  updated_at: string;
}

export interface LoreCharacter {
  id: string;
  universe_id: string;
  name: string;
  title: string;
  role: string;
  motivations: string;
  fears: string;
  powers: string;
  weaknesses: string;
  faction_id: string | null;
  relationships: Record<string, unknown>[];
  arc_potential: string;
  status: string;
  appearance: string;
  speech_style: string;
  canon_status: string;
  created_at: string;
  updated_at: string;
}

export interface Faction {
  id: string;
  universe_id: string;
  name: string;
  type: string;
  ideology: string;
  leader: string;
  resources: string;
  territory: string;
  allies: string[];
  enemies: string[];
  internal_conflict: string;
  objective: string;
  symbol: string;
  canon_status: string;
  created_at: string;
  updated_at: string;
}

export interface LoreLocation {
  id: string;
  universe_id: string;
  name: string;
  type: string;
  region: string;
  description: string;
  strategic_value: string;
  mythic_importance: string;
  controlling_faction: string;
  canon_status: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;
  universe_id: string;
  title: string;
  era_marker: string;
  summary: string;
  affected_characters: string[];
  affected_factions: string[];
  affected_locations: string[];
  consequences: string;
  hidden_truths: string;
  canon_status: string;
  created_at: string;
  updated_at: string;
}

export interface StoryArc {
  id: string;
  universe_id: string;
  title: string;
  type: string;
  summary: string;
  start_point: string;
  end_point: string;
  characters: string[];
  factions: string[];
  themes: string[];
  turning_points: string[];
  canon_status: string;
  created_at: string;
  updated_at: string;
}

export interface LoreRule {
  id: string;
  universe_id: string;
  rule_type: string;
  rule: string;
  consequence: string;
  canon_status: string;
  created_at: string;
  updated_at: string;
}

export interface CanonConflict {
  severity: string;
  category: string;
  description: string;
  entities: string[];
}

export interface CanonValidationResult {
  universe_id: string;
  conflict_count: number;
  conflicts: CanonConflict[];
}

export interface CanonMemory {
  universe: {
    name: string;
    genre: string;
    tone: string;
    world_overview: string;
    magic_system: string;
    technology_level: string;
    current_conflict: string;
  };
  factions: { name: string; type: string; ideology: string; territory: string }[];
  characters: { name: string; role: string; status: string; faction: string }[];
  world_rules: { type: string; rule: string }[];
  timeline: { title: string; era: string; summary: string }[];
}

/**
 * StoryContext — the condensed/processed response returned by
 * GET /api/universes/{id}/story-context.
 *
 * This is what Rainstorms receives and injects directly into AI story-generation
 * prompts.  It is intentionally compact (only canon-status="canon" objects,
 * minimal fields per entity).
 */
export interface StoryContext {
  universe_id: string;
  universe_name: string;
  universe_tone: string;
  world_overview: string;
  current_conflict: string;
  world_rules: { rule_type: string; rule: string; consequence: string }[];
  relevant_characters: {
    name: string;
    title: string;
    role: string;
    appearance: string;
    motivations: string;
    status: string;
  }[];
  relevant_factions: { name: string; ideology: string; territory: string }[];
  relevant_locations: { name: string; type: string; description: string }[];
  timeline_context: { era: string; title: string; summary: string }[];
}

/**
 * CanonBlockInput — the raw, unprocessed lore payload.
 *
 * This is the format exported by MythLoreBuilder's "Export Canon" button and the
 * format Rainstorms (or any external tool) should send when it needs to embed full
 * lore data into its own workflow.
 *
 * It contains the FULL objects for every lore entity (not just the condensed
 * story-context fields), so Rainstorms can pick exactly the fields it needs.
 *
 * Shape matches the GET /api/lore/demo-universe response and is the input
 * format for POST /api/lore-engine/canon-block (SagaArchitect compatibility).
 */
export interface CanonBlockInput {
  universe: Universe;
  characters: LoreCharacter[];
  factions: Faction[];
  locations: LoreLocation[];
  timeline: TimelineEvent[];
  lore_rules: LoreRule[];
  story_arcs: StoryArc[];
}

// ── Universe API ──────────────────────────────────────────────────────────────

export const api = {
  universes: {
    list: () => request<Universe[]>("/api/universes"),
    get: (id: string) => request<Universe>(`/api/universes/${id}`),
    create: (data: Partial<Universe>) =>
      request<Universe>("/api/universes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Universe>) =>
      request<Universe>(`/api/universes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/universes/${id}`, { method: "DELETE" }),
    generate: (id: string, data: Partial<Universe>) =>
      request<Universe>(`/api/universes/${id}/generate`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    canonMemory: (id: string) => request<CanonMemory>(`/api/universes/${id}/canon-memory`),
    validate: (id: string) =>
      request<CanonValidationResult>(`/api/universes/${id}/validate`, { method: "POST" }),
    storyContext: (id: string) => request<StoryContext>(`/api/universes/${id}/story-context`),
  },

  characters: {
    list: (universeId: string) =>
      request<LoreCharacter[]>(`/api/universes/${universeId}/characters`),
    get: (universeId: string, id: string) =>
      request<LoreCharacter>(`/api/universes/${universeId}/characters/${id}`),
    create: (universeId: string, data: Partial<LoreCharacter>) =>
      request<LoreCharacter>(`/api/universes/${universeId}/characters`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (universeId: string, id: string, data: Partial<LoreCharacter>) =>
      request<LoreCharacter>(`/api/universes/${universeId}/characters/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (universeId: string, id: string) =>
      request<{ message: string }>(`/api/universes/${universeId}/characters/${id}`, {
        method: "DELETE",
      }),
    generate: (universeId: string, role: string) =>
      request<LoreCharacter>(`/api/universes/${universeId}/generate-character`, {
        method: "POST",
        body: JSON.stringify({ role }),
      }),
  },

  factions: {
    list: (universeId: string) =>
      request<Faction[]>(`/api/universes/${universeId}/factions`),
    create: (universeId: string, data: Partial<Faction>) =>
      request<Faction>(`/api/universes/${universeId}/factions`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (universeId: string, id: string, data: Partial<Faction>) =>
      request<Faction>(`/api/universes/${universeId}/factions/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (universeId: string, id: string) =>
      request<{ message: string }>(`/api/universes/${universeId}/factions/${id}`, {
        method: "DELETE",
      }),
    generate: (universeId: string, faction_type: string) =>
      request<Faction>(`/api/universes/${universeId}/generate-faction`, {
        method: "POST",
        body: JSON.stringify({ faction_type }),
      }),
  },

  locations: {
    list: (universeId: string) =>
      request<LoreLocation[]>(`/api/universes/${universeId}/locations`),
    create: (universeId: string, data: Partial<LoreLocation>) =>
      request<LoreLocation>(`/api/universes/${universeId}/locations`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (universeId: string, id: string, data: Partial<LoreLocation>) =>
      request<LoreLocation>(`/api/universes/${universeId}/locations/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (universeId: string, id: string) =>
      request<{ message: string }>(`/api/universes/${universeId}/locations/${id}`, {
        method: "DELETE",
      }),
  },

  timeline: {
    list: (universeId: string) =>
      request<TimelineEvent[]>(`/api/universes/${universeId}/timeline`),
    create: (universeId: string, data: Partial<TimelineEvent>) =>
      request<TimelineEvent>(`/api/universes/${universeId}/timeline`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (universeId: string, id: string, data: Partial<TimelineEvent>) =>
      request<TimelineEvent>(`/api/universes/${universeId}/timeline/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (universeId: string, id: string) =>
      request<{ message: string }>(`/api/universes/${universeId}/timeline/${id}`, {
        method: "DELETE",
      }),
  },

  arcs: {
    list: (universeId: string) =>
      request<StoryArc[]>(`/api/universes/${universeId}/arcs`),
    create: (universeId: string, data: Partial<StoryArc>) =>
      request<StoryArc>(`/api/universes/${universeId}/arcs`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (universeId: string, id: string, data: Partial<StoryArc>) =>
      request<StoryArc>(`/api/universes/${universeId}/arcs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (universeId: string, id: string) =>
      request<{ message: string }>(`/api/universes/${universeId}/arcs/${id}`, {
        method: "DELETE",
      }),
    generate: (universeId: string, arc_type: string) =>
      request<StoryArc>(`/api/universes/${universeId}/generate-arc`, {
        method: "POST",
        body: JSON.stringify({ arc_type }),
      }),
  },

  rules: {
    list: (universeId: string) =>
      request<LoreRule[]>(`/api/universes/${universeId}/rules`),
    create: (universeId: string, data: Partial<LoreRule>) =>
      request<LoreRule>(`/api/universes/${universeId}/rules`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (universeId: string, id: string, data: Partial<LoreRule>) =>
      request<LoreRule>(`/api/universes/${universeId}/rules/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (universeId: string, id: string) =>
      request<{ message: string }>(`/api/universes/${universeId}/rules/${id}`, {
        method: "DELETE",
      }),
  },

  demo: {
    seed: () =>
      request<{ message: string; universe_id: string }>("/api/lore/seed-demo", {
        method: "POST",
      }),
    get: () =>
      request<{
        universe: Universe;
        characters: LoreCharacter[];
        factions: Faction[];
        locations: LoreLocation[];
        rules: LoreRule[];
        timeline: TimelineEvent[];
        arcs: StoryArc[];
      }>("/api/lore/demo-universe"),
  },
};

/**
 * fetchAllLore — assemble a CanonBlockInput for a given universe.
 *
 * Fetches the universe object plus all related lore arrays in parallel and
 * returns the raw CanonBlockInput.  This is what the Export Canon button
 * downloads and what Rainstorms (or any integration partner) should POST to
 * the LoreEngine's canon-block endpoint rather than the condensed StoryContext.
 *
 * Why raw and not the StoryContext output?
 *   • StoryContext is already processed/filtered (only canon-status="canon",
 *     minimal fields).  Sending it back to the API would lose data.
 *   • CanonBlockInput contains the full objects so the receiving system can
 *     choose which fields it needs without data loss.
 */
export async function fetchAllLore(universeId: string): Promise<CanonBlockInput> {
  const [universe, characters, factions, locations, timeline, lore_rules, story_arcs] =
    await Promise.all([
      api.universes.get(universeId),
      api.characters.list(universeId),
      api.factions.list(universeId),
      api.locations.list(universeId),
      api.timeline.list(universeId),
      api.rules.list(universeId),
      api.arcs.list(universeId),
    ]);

  return { universe, characters, factions, locations, timeline, lore_rules, story_arcs };
}
