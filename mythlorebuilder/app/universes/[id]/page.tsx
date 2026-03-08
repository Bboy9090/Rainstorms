"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { Card, Button, Spinner, Badge, SectionHeader, Input, Textarea, Select } from "@/components/ui";
import { api, Universe } from "@/lib/api";

const GENERATE_FIELDS = [
  { key: "genre", label: "Genre", placeholder: "Dark Fantasy, Sci-Fi, Gothic Horror…" },
  { key: "tone", label: "Tone", placeholder: "Epic & tragic, Hopeful & mythic…" },
  { key: "concept", label: "World Concept", placeholder: "A world where the sky is perpetually veiled in ash…" },
  { key: "era", label: "Era", placeholder: "The Third Ashfall, Post-Collapse Year 800…" },
  { key: "technology_level", label: "Technology Level", placeholder: "Medieval-industrial, Post-apocalyptic…" },
  { key: "magic_system", label: "Magic System", placeholder: "Storm magic erases memories…" },
  { key: "core_theme", label: "Core Theme", placeholder: "The cost of power and the grief of forgetting…" },
];

export default function UniversePage() {
  const { id } = useParams<{ id: string }>();
  const [universe, setUniverse] = useState<Universe | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"overview" | "generate">("overview");
  const [form, setForm] = useState<Partial<Universe>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    try {
      const u = await api.universes.get(id);
      setUniverse(u);
      setForm(u);
    } catch {
      setError("Failed to load universe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const u = await api.universes.update(id, form);
      setUniverse(u);
      setSuccess("Saved!");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const u = await api.universes.generate(id, form);
      setUniverse(u);
      setForm(u);
      setTab("overview");
      setSuccess("Universe generated!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return (
    <div className="flex min-h-screen">
      <Sidebar universeId={id} />
      <main className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </main>
    </div>
  );

  if (!universe) return (
    <div className="flex min-h-screen">
      <Sidebar universeId={id} />
      <main className="flex-1 flex items-center justify-center text-slate-500">Universe not found</main>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar universeId={id} />
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent border-b border-slate-800 px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{universe.name}</h1>
              <div className="flex gap-2 mt-2">
                {universe.genre && <Badge>{universe.genre}</Badge>}
                {universe.era && <Badge variant="default">{universe.era}</Badge>}
                {universe.tone && <Badge variant="default">{universe.tone}</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setTab(tab === "generate" ? "overview" : "generate")}
              >
                {tab === "generate" ? "← Back" : "⚡ Universe Engine"}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size="sm" /> : "Save"}
              </Button>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {success && <p className="mt-3 text-sm text-emerald-400">{success}</p>}
        </div>

        <div className="px-8 py-8 max-w-4xl">
          {tab === "generate" ? (
            // Universe Engine
            <div>
              <SectionHeader
                title="Universe Engine"
                subtitle="Fill in the details below and let AI generate your complete universe — factions, locations, characters, timeline events, and world rules."
              />
              <div className="grid grid-cols-2 gap-4">
                {GENERATE_FIELDS.map((f) => (
                  <Input
                    key={f.key}
                    label={f.label}
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.key] ?? ""}
                    onChange={(v) => setField(f.key, v)}
                    className={f.key === "concept" ? "col-span-2" : ""}
                  />
                ))}
              </div>
              <Button
                className="mt-6"
                size="lg"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Spinner size="sm" />
                    Generating universe…
                  </>
                ) : (
                  "⚡ Generate Full Universe"
                )}
              </Button>
              {generating && (
                <p className="mt-3 text-sm text-slate-500">
                  AI is generating factions, locations, characters, timeline events, and world rules…
                </p>
              )}
            </div>
          ) : (
            // Overview
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Name" value={form.name ?? ""} onChange={(v) => setField("name", v)} required />
                <Input label="Genre" value={form.genre ?? ""} onChange={(v) => setField("genre", v)} placeholder="Dark Fantasy, Sci-Fi…" />
                <Input label="Tone" value={form.tone ?? ""} onChange={(v) => setField("tone", v)} placeholder="Epic, tragic, mythic…" />
                <Input label="Era" value={form.era ?? ""} onChange={(v) => setField("era", v)} placeholder="The Third Ashfall…" />
                <Input label="Technology Level" value={form.technology_level ?? ""} onChange={(v) => setField("technology_level", v)} />
                <Input label="Core Theme" value={form.core_theme ?? ""} onChange={(v) => setField("core_theme", v)} />
              </div>

              <Textarea label="Magic System" value={form.magic_system ?? ""} onChange={(v) => setField("magic_system", v)} rows={2} />
              <Textarea label="World Concept" value={form.concept ?? ""} onChange={(v) => setField("concept", v)} rows={2} />
              <Textarea label="World Overview" value={form.world_overview ?? ""} onChange={(v) => setField("world_overview", v)} rows={4} />
              <Textarea label="Creation Myth" value={form.creation_myth ?? ""} onChange={(v) => setField("creation_myth", v)} rows={3} />
              <Textarea label="Current Conflict" value={form.current_conflict ?? ""} onChange={(v) => setField("current_conflict", v)} rows={3} />
              <Textarea label="Prophecy Hooks" value={form.prophecy_hooks ?? ""} onChange={(v) => setField("prophecy_hooks", v)} rows={2} />

              <div className="pt-2">
                <Button onClick={handleSave} disabled={saving} size="lg">
                  {saving ? <Spinner size="sm" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
