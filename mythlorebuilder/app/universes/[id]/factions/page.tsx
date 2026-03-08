"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Card, Button, Spinner, Badge, SectionHeader, Input, Textarea, Select, EmptyState,
} from "@/components/ui";
import { api, Faction } from "@/lib/api";

const FACTION_TYPES = [
  { value: "empire", label: "Empire" },
  { value: "guild", label: "Guild" },
  { value: "religious_order", label: "Religious Order" },
  { value: "rebellion", label: "Rebellion" },
  { value: "secret_society", label: "Secret Society" },
  { value: "alien_race", label: "Alien Race" },
  { value: "corporation", label: "Corporation" },
  { value: "tribe", label: "Tribe" },
  { value: "monarchy", label: "Monarchy" },
];

function FactionCard({
  faction,
  onEdit,
  onDelete,
}: {
  faction: Faction;
  onEdit: (f: Faction) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-100">{faction.name}</p>
          {faction.leader && (
            <p className="text-xs text-slate-500">Led by {faction.leader}</p>
          )}
        </div>
        <Badge>{faction.type}</Badge>
      </div>
      {faction.ideology && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">
          <span className="text-slate-500">Ideology: </span>{faction.ideology}
        </p>
      )}
      {faction.territory && (
        <p className="text-xs text-slate-400 line-clamp-1">
          <span className="text-slate-500">Territory: </span>{faction.territory}
        </p>
      )}
      {(faction.allies.length > 0 || faction.enemies.length > 0) && (
        <div className="flex gap-3 mt-2">
          {faction.allies.length > 0 && (
            <p className="text-xs text-emerald-500">
              ✓ Allies: {faction.allies.join(", ")}
            </p>
          )}
          {faction.enemies.length > 0 && (
            <p className="text-xs text-red-400">
              ✗ Enemies: {faction.enemies.join(", ")}
            </p>
          )}
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={() => onEdit(faction)}>Edit</Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(faction.id)}>Delete</Button>
      </div>
    </Card>
  );
}

function FactionForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<Faction>;
  onSave: (d: Partial<Faction>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Faction>>(initial);
  const f = (k: keyof Faction) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card className="border-indigo-800/40 mb-6">
      <p className="font-semibold text-slate-200 mb-4">
        {initial.id ? "Edit Faction" : "New Faction"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name" value={form.name ?? ""} onChange={f("name")} required />
        <Select
          label="Type"
          value={form.type ?? "empire"}
          onChange={f("type")}
          options={FACTION_TYPES}
        />
        <Input label="Leader" value={form.leader ?? ""} onChange={f("leader")} placeholder="Name & title" />
        <Input label="Symbol" value={form.symbol ?? ""} onChange={f("symbol")} placeholder="Emblem description" />
        <Textarea label="Ideology" value={form.ideology ?? ""} onChange={f("ideology")} rows={2} />
        <Textarea label="Objective" value={form.objective ?? ""} onChange={f("objective")} rows={2} />
        <Textarea label="Territory" value={form.territory ?? ""} onChange={f("territory")} rows={2} />
        <Textarea label="Resources" value={form.resources ?? ""} onChange={f("resources")} rows={2} />
        <Textarea label="Internal Conflict" value={form.internal_conflict ?? ""} onChange={f("internal_conflict")} rows={2} className="col-span-2" />
      </div>
      <div className="flex gap-2 mt-4">
        <Button onClick={() => onSave(form)} disabled={saving}>
          {saving ? <Spinner size="sm" /> : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

export default function FactionsPage() {
  const { id: universeId } = useParams<{ id: string }>();
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<Faction> | null>(null);
  const [genType, setGenType] = useState("empire");
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setFactions(await api.factions.list(universeId));
    } catch {
      setError("Failed to load factions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [universeId]);

  async function handleSave(data: Partial<Faction>) {
    setSaving(true);
    setError("");
    try {
      if (data.id) {
        await api.factions.update(universeId, data.id, data);
      } else {
        await api.factions.create(universeId, data);
      }
      setEditTarget(null);
      await load();
    } catch {
      setError("Failed to save faction.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(factionId: string) {
    if (!confirm("Delete this faction?")) return;
    await api.factions.delete(universeId, factionId);
    await load();
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      await api.factions.generate(universeId, genType);
      setShowGenPanel(false);
      await load();
    } catch {
      setError("AI generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar universeId={universeId} />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <SectionHeader
          title="Factions"
          subtitle={`${factions.length} faction${factions.length !== 1 ? "s" : ""} in this universe`}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowGenPanel(!showGenPanel)}>
                ✨ AI Generate
              </Button>
              <Button onClick={() => setEditTarget({})}>+ Add Faction</Button>
            </div>
          }
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        {showGenPanel && (
          <Card className="mb-6 border-purple-800/40">
            <p className="font-medium text-slate-200 mb-3">
              Generate an AI faction that fits the existing lore
            </p>
            <div className="flex items-end gap-3">
              <Select
                label="Faction Type"
                value={genType}
                onChange={setGenType}
                options={FACTION_TYPES}
                className="w-56"
              />
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <><Spinner size="sm" /> Generating…</> : "Generate"}
              </Button>
              <Button variant="ghost" onClick={() => setShowGenPanel(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {editTarget !== null && (
          <FactionForm
            initial={editTarget}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
            saving={saving}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : factions.length === 0 ? (
          <EmptyState
            icon="🏛️"
            title="No factions yet"
            description="Add factions manually or use AI generation."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {factions.map((f) => (
              <FactionCard
                key={f.id}
                faction={f}
                onEdit={setEditTarget}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
