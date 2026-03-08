"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Card, Button, Spinner, Badge, SectionHeader, Input, Textarea, EmptyState,
} from "@/components/ui";
import { api, TimelineEvent } from "@/lib/api";

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: TimelineEvent;
  onEdit: (e: TimelineEvent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
        <div className="w-px flex-1 bg-slate-800" />
      </div>
      <Card className="flex-1 mb-4 hover:border-slate-700 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="font-semibold text-slate-100">{event.title}</p>
            {event.era_marker && (
              <Badge variant="default">{event.era_marker}</Badge>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => onEdit(event)}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(event.id)}>Delete</Button>
          </div>
        </div>
        {event.summary && (
          <p className="text-sm text-slate-400 mb-2">{event.summary}</p>
        )}
        {event.consequences && (
          <p className="text-xs text-amber-400 mb-1">
            ⚡ Consequences: {event.consequences}
          </p>
        )}
        {event.hidden_truths && (
          <p className="text-xs text-purple-400">
            🔮 Hidden truth: {event.hidden_truths}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-2">
          {event.affected_characters.map((c) => (
            <span key={c} className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/40 text-indigo-300">
              ⚔️ {c}
            </span>
          ))}
          {event.affected_factions.map((f) => (
            <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              🏛️ {f}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EventForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<TimelineEvent>;
  onSave: (d: Partial<TimelineEvent>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<TimelineEvent>>(initial);
  const f = (k: keyof TimelineEvent) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function listField(
    k: keyof TimelineEvent,
    v: string
  ) {
    setForm((p) => ({
      ...p,
      [k]: v.split(",").map((s) => s.trim()).filter(Boolean),
    }));
  }

  const listValue = (k: keyof TimelineEvent) =>
    ((form[k] as string[]) ?? []).join(", ");

  return (
    <Card className="border-indigo-800/40 mb-6">
      <p className="font-semibold text-slate-200 mb-4">
        {initial.id ? "Edit Event" : "New Timeline Event"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Title" value={form.title ?? ""} onChange={f("title")} required />
        <Input label="Era Marker" value={form.era_marker ?? ""} onChange={f("era_marker")} placeholder="Year 800, First Age…" />
        <Textarea label="Summary" value={form.summary ?? ""} onChange={f("summary")} rows={3} className="col-span-2" />
        <Textarea label="Consequences" value={form.consequences ?? ""} onChange={f("consequences")} rows={2} />
        <Textarea label="Hidden Truths" value={form.hidden_truths ?? ""} onChange={f("hidden_truths")} rows={2} />
        <Input
          label="Affected Characters (comma-separated)"
          value={listValue("affected_characters")}
          onChange={(v) => listField("affected_characters", v)}
          className="col-span-2"
        />
        <Input
          label="Affected Factions (comma-separated)"
          value={listValue("affected_factions")}
          onChange={(v) => listField("affected_factions", v)}
        />
        <Input
          label="Affected Locations (comma-separated)"
          value={listValue("affected_locations")}
          onChange={(v) => listField("affected_locations", v)}
        />
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

export default function TimelinePage() {
  const { id: universeId } = useParams<{ id: string }>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<TimelineEvent> | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setEvents(await api.timeline.list(universeId));
    } catch {
      setError("Failed to load timeline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [universeId]);

  async function handleSave(data: Partial<TimelineEvent>) {
    setSaving(true);
    setError("");
    try {
      if (data.id) {
        await api.timeline.update(universeId, data.id, data);
      } else {
        await api.timeline.create(universeId, data);
      }
      setEditTarget(null);
      await load();
    } catch {
      setError("Failed to save event.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(eventId: string) {
    if (!confirm("Delete this timeline event?")) return;
    await api.timeline.delete(universeId, eventId);
    await load();
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar universeId={universeId} />
      <main className="flex-1 overflow-y-auto px-8 py-8">
        <SectionHeader
          title="Timeline"
          subtitle={`${events.length} event${events.length !== 1 ? "s" : ""} in canonical history`}
          action={<Button onClick={() => setEditTarget({})}>+ Add Event</Button>}
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-sm">
            {error}
          </div>
        )}

        {editTarget !== null && (
          <EventForm
            initial={editTarget}
            onSave={handleSave}
            onCancel={() => setEditTarget(null)}
            saving={saving}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : events.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No timeline events yet"
            description="Add events to build your world's history. The Universe Engine auto-generates a timeline."
          />
        ) : (
          <div className="max-w-2xl">
            {events.map((e) => (
              <EventCard
                key={e.id}
                event={e}
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
