"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Card, Button, Spinner, Badge, SectionHeader, Input, Textarea, Select, EmptyState,
} from "@/components/ui";
import { api, LoreLocation } from "@/lib/api";

const LOCATION_TYPES = [
  { value: "city", label: "City" },
  { value: "capital", label: "Capital" },
  { value: "region", label: "Region" },
  { value: "ancient ruin", label: "Ancient Ruin" },
  { value: "fortress", label: "Fortress" },
  { value: "wilderness", label: "Wilderness" },
  { value: "portal", label: "Portal / Gateway" },
  { value: "sacred site", label: "Sacred Site" },
  { value: "dungeon", label: "Dungeon" },
  { value: "other", label: "Other" },
];

function LocationCard({
  location,
  onEdit,
  onDelete,
}: {
  location: LoreLocation;
  onEdit: (l: LoreLocation) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-semibold text-slate-100">{location.name}</p>
          {location.region && <p className="text-xs text-slate-500">{location.region}</p>}
        </div>
        <Badge>{location.type || "location"}</Badge>
      </div>
      {location.description && (
        <p className="text-xs text-slate-400 mb-2 line-clamp-2">{location.description}</p>
      )}
      {location.controlling_faction && (
        <p className="text-xs text-slate-500">
          🏛️ Controlled by: <span className="text-slate-300">{location.controlling_faction}</span>
        </p>
      )}
      {location.mythic_importance && (
        <p className="text-xs text-purple-400 mt-1 line-clamp-1">✦ {location.mythic_importance}</p>
      )}
      <div className="flex gap-2 mt-3">
        <Button variant="secondary" size="sm" onClick={() => onEdit(location)}>Edit</Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(location.id)}>Delete</Button>
      </div>
    </Card>
  );
}

function LocationForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<LoreLocation>;
  onSave: (d: Partial<LoreLocation>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<LoreLocation>>(initial);
  const f = (k: keyof LoreLocation) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card className="border-indigo-800/40 mb-6">
      <p className="font-semibold text-slate-200 mb-4">
        {initial.id ? "Edit Location" : "New Location"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name" value={form.name ?? ""} onChange={f("name")} required />
        <Select
          label="Type"
          value={form.type ?? "city"}
          onChange={f("type")}
          options={LOCATION_TYPES}
        />
        <Input label="Region" value={form.region ?? ""} onChange={f("region")} />
        <Input label="Controlling Faction" value={form.controlling_faction ?? ""} onChange={f("controlling_faction")} />
        <Textarea label="Description" value={form.description ?? ""} onChange={f("description")} rows={3} className="col-span-2" />
        <Textarea label="Strategic Value" value={form.strategic_value ?? ""} onChange={f("strategic_value")} rows={2} />
        <Textarea label="Mythic Importance" value={form.mythic_importance ?? ""} onChange={f("mythic_importance")} rows={2} />
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

export default function LocationsPage() {
  const { id: universeId } = useParams<{ id: string }>();
  const [locations, setLocations] = useState<LoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<LoreLocation> | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setLocations(await api.locations.list(universeId));
    } catch {
      setError("Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [universeId]);

  async function handleSave(data: Partial<LoreLocation>) {
    setSaving(true);
    setError("");
    try {
      if (data.id) {
        await api.locations.update(universeId, data.id, data);
      } else {
        await api.locations.create(universeId, data);
      }
      setEditTarget(null);
      await load();
    } catch {
      setError("Failed to save location.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(locId: string) {
    if (!confirm("Delete this location?")) return;
    await api.locations.delete(universeId, locId);
    await load();
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar universeId={universeId} />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <SectionHeader
          title="Locations"
          subtitle={`${locations.length} location${locations.length !== 1 ? "s" : ""} in this universe`}
          action={<Button onClick={() => setEditTarget({})}>+ Add Location</Button>}
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        {editTarget !== null && (
          <LocationForm
            initial={editTarget}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
            saving={saving}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : locations.length === 0 ? (
          <EmptyState
            icon="🗺️"
            title="No locations yet"
            description="Add locations to build your world's geography. Use the Universe Engine to auto-generate them."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((l) => (
              <LocationCard
                key={l.id}
                location={l}
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
