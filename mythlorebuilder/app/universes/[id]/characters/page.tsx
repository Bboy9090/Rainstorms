"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Card, Button, Spinner, Badge, SectionHeader, Input, Textarea, Select, EmptyState,
} from "@/components/ui";
import { api, LoreCharacter } from "@/lib/api";

const ROLES = [
  { value: "hero", label: "Hero" },
  { value: "villain", label: "Villain" },
  { value: "mentor", label: "Mentor" },
  { value: "antihero", label: "Antihero" },
  { value: "rival", label: "Rival" },
  { value: "guardian", label: "Guardian" },
  { value: "trickster", label: "Trickster" },
  { value: "ally", label: "Ally" },
];

const STATUS_COLORS: Record<string, "canon" | "warning" | "conflict" | "default"> = {
  alive: "canon",
  dead: "conflict",
  missing: "warning",
  unknown: "default",
};

function CharacterCard({
  char,
  onEdit,
  onDelete,
}: {
  char: LoreCharacter;
  onEdit: (c: LoreCharacter) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-semibold text-slate-100">{char.name}</p>
          {char.title && <p className="text-xs text-slate-500 italic">{char.title}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <Badge variant={STATUS_COLORS[char.status] ?? "default"}>{char.status}</Badge>
          <Badge>{char.role}</Badge>
        </div>
      </div>
      {char.motivations && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">
          <span className="text-slate-500">Motivations: </span>{char.motivations}
        </p>
      )}
      {char.powers && (
        <p className="text-xs text-slate-400 line-clamp-1">
          <span className="text-slate-500">Powers: </span>{char.powers}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={() => onEdit(char)}>Edit</Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(char.id)}>Delete</Button>
      </div>
    </Card>
  );
}

function CharacterForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<LoreCharacter>;
  onSave: (data: Partial<LoreCharacter>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<LoreCharacter>>(initial);
  const f = (k: keyof LoreCharacter) => (v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card className="border-indigo-800/40 mb-6">
      <p className="font-semibold text-slate-200 mb-4">
        {initial.id ? "Edit Character" : "New Character"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name" value={form.name ?? ""} onChange={f("name")} required />
        <Input label="Title / Rank" value={form.title ?? ""} onChange={f("title")} />
        <Select
          label="Role"
          value={form.role ?? "hero"}
          onChange={f("role")}
          options={ROLES}
        />
        <Select
          label="Status"
          value={form.status ?? "alive"}
          onChange={f("status")}
          options={[
            { value: "alive", label: "Alive" },
            { value: "dead", label: "Dead" },
            { value: "missing", label: "Missing" },
            { value: "unknown", label: "Unknown" },
          ]}
        />
        <Textarea label="Motivations" value={form.motivations ?? ""} onChange={f("motivations")} rows={2} />
        <Textarea label="Fears" value={form.fears ?? ""} onChange={f("fears")} rows={2} />
        <Textarea label="Powers" value={form.powers ?? ""} onChange={f("powers")} rows={2} />
        <Textarea label="Weaknesses" value={form.weaknesses ?? ""} onChange={f("weaknesses")} rows={2} />
        <Textarea label="Appearance" value={form.appearance ?? ""} onChange={f("appearance")} rows={2} className="col-span-2" />
        <Textarea label="Speech Style" value={form.speech_style ?? ""} onChange={f("speech_style")} rows={2} />
        <Textarea label="Arc Potential" value={form.arc_potential ?? ""} onChange={f("arc_potential")} rows={2} />
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

export default function CharactersPage() {
  const { id: universeId } = useParams<{ id: string }>();
  const [characters, setCharacters] = useState<LoreCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<LoreCharacter> | null>(null);
  const [genRole, setGenRole] = useState("hero");
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setCharacters(await api.characters.list(universeId));
    } catch {
      setError("Failed to load characters.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [universeId]);

  async function handleSave(data: Partial<LoreCharacter>) {
    setSaving(true);
    setError("");
    try {
      if (data.id) {
        await api.characters.update(universeId, data.id, data);
      } else {
        await api.characters.create(universeId, data);
      }
      setEditTarget(null);
      await load();
    } catch {
      setError("Failed to save character.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(charId: string) {
    if (!confirm("Delete this character?")) return;
    await api.characters.delete(universeId, charId);
    await load();
  }

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      await api.characters.generate(universeId, genRole);
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
          title="Characters"
          subtitle={`${characters.length} character${characters.length !== 1 ? "s" : ""} in this universe`}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowGenPanel(!showGenPanel)}>
                ✨ AI Generate
              </Button>
              <Button onClick={() => setEditTarget({})}>+ Add Character</Button>
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
              Generate an AI character that fits the existing lore
            </p>
            <div className="flex items-end gap-3">
              <Select
                label="Character Role"
                value={genRole}
                onChange={setGenRole}
                options={ROLES}
                className="w-48"
              />
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <><Spinner size="sm" /> Generating…</> : "Generate"}
              </Button>
              <Button variant="ghost" onClick={() => setShowGenPanel(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {editTarget !== null && (
          <CharacterForm
            initial={editTarget}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
            saving={saving}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : characters.length === 0 ? (
          <EmptyState
            icon="⚔️"
            title="No characters yet"
            description="Add characters manually or use AI generation to create characters that fit your universe."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                char={c}
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
