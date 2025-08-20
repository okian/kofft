import React, { useEffect, useState, useMemo } from "react";
import {
  getStats,
  resetStats,
  flushDatabase,
  UsageStatsSummary,
} from "@/shared/utils/usageStats";
import { directToast } from "@/shared/utils/toast";

// Minimal statistics display used inside the Settings panel. It intentionally
// keeps rendering logic lightweight to avoid blocking the main thread. Large
// tables are paginated to avoid DOM thrashing.

interface StatisticsPanelProps {
  className?: string;
}

// Hard limit for rows rendered at once. This prevents the UI from locking up
// with extremely large libraries.
const PAGE_SIZE = 1000;

export function StatisticsPanel({ className }: StatisticsPanelProps) {
  const [stats, setStats] = useState<UsageStatsSummary | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const s = await getStats();
    setStats(s);
  };

  const filteredTracks = useMemo(() => {
    if (!stats) return [];
    return stats.tracks
      .filter(
        (t) => !search || t.title?.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => b.playCount - a.playCount);
  }, [stats, search]);

  const paginated = filteredTracks.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE,
  );

  const exportJSON = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usage-stats.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!stats) return;
    const header = "id,title,artist,album,genre,plays,duration,lastPlayed\n";
    const rows = stats.tracks
      .map((t) =>
        [
          t.id,
          t.title ?? "",
          t.artist ?? "",
          t.album ?? "",
          t.genre ?? "",
          t.playCount,
          t.totalDuration,
          t.lastPlayed,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usage-stats.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = async () => {
    if (!window.confirm("Reset usage statistics?")) return;
    await resetStats();
    await refresh();
    directToast("Statistics reset");
  };

  const handleFlush = async () => {
    if (!window.confirm("Flush ALL application data? This is irreversible."))
      return;
    await flushDatabase();
    await refresh();
    directToast("Database flushed");
  };

  if (!stats) {
    return <div className={className}>Loading statistics...</div>;
  }

  return (
    <div className={className}>
      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="panel p-2">Songs: {stats.totalSongs}</div>
        <div className="panel p-2">Artists: {stats.totalArtists}</div>
        <div className="panel p-2">Albums: {stats.totalAlbums}</div>
        <div className="panel p-2">Genres: {stats.totalGenres}</div>
        <div className="panel p-2">Total Plays: {stats.totalPlays}</div>
        <div className="panel p-2">
          Total Time: {stats.totalPlayTime.toFixed(1)}s
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <input
          className="input flex-1"
          placeholder="Search songs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn" onClick={exportJSON}>
          JSON
        </button>
        <button className="btn" onClick={exportCSV}>
          CSV
        </button>
        <button className="btn" onClick={handleReset}>
          Reset Statistics
        </button>
        <button className="btn" onClick={handleFlush}>
          Flush Database
        </button>
      </div>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left">Title</th>
            <th className="text-left">Plays</th>
            <th className="text-left">Duration</th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((t) => (
            <tr key={t.id}>
              <td>{t.title ?? t.id}</td>
              <td>{t.playCount}</td>
              <td>{t.totalDuration.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {filteredTracks.length > PAGE_SIZE && (
        <div className="flex justify-between mt-2 text-sm">
          <button
            className="btn"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span>
            Page {page + 1} / {Math.ceil(filteredTracks.length / PAGE_SIZE)}
          </span>
          <button
            className="btn"
            disabled={(page + 1) * PAGE_SIZE >= filteredTracks.length}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
