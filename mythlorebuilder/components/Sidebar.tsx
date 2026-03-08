"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const baseItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "⬡" },
];

function UniverseNav({ universeId }: { universeId?: string }) {
  const pathname = usePathname();

  if (!universeId) return null;

  const items: NavItem[] = [
    { href: `/universes/${universeId}`, label: "Universe", icon: "🌌" },
    { href: `/universes/${universeId}/characters`, label: "Characters", icon: "⚔️" },
    { href: `/universes/${universeId}/factions`, label: "Factions", icon: "🏛️" },
    { href: `/universes/${universeId}/locations`, label: "Locations", icon: "🗺️" },
    { href: `/universes/${universeId}/timeline`, label: "Timeline", icon: "📜" },
    { href: `/universes/${universeId}/arcs`, label: "Story Arcs", icon: "🎭" },
    { href: `/universes/${universeId}/conflicts`, label: "Canon Conflicts", icon: "⚠️" },
  ];

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">
        Universe
      </p>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              active
                ? "bg-purple-900/60 text-purple-200 font-medium"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export default function Sidebar({ universeId }: { universeId?: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-slate-800 bg-[#0d0f1a] flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 pt-6 pb-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">🌐</span>
          <div>
            <p className="text-sm font-bold text-slate-100 leading-tight">MythLoreBuilder</p>
            <p className="text-[10px] text-slate-500 leading-tight">Story Bible Engine</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
        {baseItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-indigo-900/60 text-indigo-200 font-medium"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <UniverseNav universeId={universeId} />
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 leading-snug">
          Powered by LoreEngine
          <br />
          <span className="text-slate-700">Rainstorms Integration Active</span>
        </p>
      </div>
    </aside>
  );
}
