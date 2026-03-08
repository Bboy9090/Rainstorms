"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { Card, Button, Spinner, Badge, EmptyState } from "@/components/ui";
import { api, Universe } from "@/lib/api";

export default function DashboardPage() {
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.universes.list();
      setUniverses(data);
    } catch {
      setError("Failed to load universes. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.universes.create({ name: newName.trim() });
      setNewName("");
      setShowCreate(false);
      await load();
    } catch {
      setError("Failed to create universe.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSeedDemo() {
    setSeeding(true);
    try {
      await api.demo.seed();
      await load();
    } catch {
      setError("Failed to seed demo universe.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-transparent border-b border-slate-800 px-8 py-12">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,60,180,0.15),_transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl">🌐</span>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                MythLoreBuilder
              </h1>
            </div>
            <p className="text-slate-400 text-lg max-w-xl">
              Your Story Bible Engine — build worlds, generate characters, maintain canon.
              Powered by <span className="text-purple-400 font-medium">LoreEngine</span>.
            </p>
          </div>
        </div>

        <div className="px-8 py-8 max-w-5xl">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Universes", value: universes.length, icon: "🌌" },
              { label: "Total Lore Objects", value: "∞", icon: "📚" },
              { label: "Rainstorms Integration", value: "Active", icon: "☁️" },
            ].map((stat) => (
              <Card key={stat.label} className="flex items-center gap-4">
                <span className="text-3xl">{stat.icon}</span>
                <div>
                  <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mb-6">
            <Button onClick={() => setShowCreate(true)}>
              + New Universe
            </Button>
            <Button variant="secondary" onClick={handleSeedDemo} disabled={seeding}>
              {seeding ? <Spinner size="sm" /> : "🌑 Load Demo Universe"}
            </Button>
          </div>

          {showCreate && (
            <Card className="mb-6 border-indigo-800/40">
              <p className="text-sm font-medium text-slate-300 mb-3">Name your universe</p>
              <div className="flex gap-3">
                <input
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. The Ashen Veil, Starbound Remnant…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  autoFocus
                />
                <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? <Spinner size="sm" /> : "Create"}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800/40 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Universe list */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : universes.length === 0 ? (
            <EmptyState
              icon="🌌"
              title="No universes yet"
              description="Create your first fictional universe or load the demo to get started."
              action={
                <Button onClick={() => setShowCreate(true)}>+ New Universe</Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {universes.map((u) => (
                <Link key={u.id} href={`/universes/${u.id}`}>
                  <Card className="hover:border-indigo-700/60 hover:bg-slate-800/60 transition-all cursor-pointer group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                          {u.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {u.genre && <Badge>{u.genre}</Badge>}
                          {u.era && <Badge variant="default">{u.era}</Badge>}
                        </div>
                        {u.world_overview && (
                          <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                            {u.world_overview}
                          </p>
                        )}
                      </div>
                      <span className="text-slate-600 group-hover:text-indigo-400 text-lg shrink-0 mt-0.5">→</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
