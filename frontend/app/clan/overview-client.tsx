"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { clearLoginCookies, getUsernameCookie } from "@/lib/cookies";
import { useTimeFormat, formatTime, formatDate } from "@/lib/time-format-context";

type ClanMember = {
  username: string;
  displayName: string;
  role: string;
  registered: boolean;
  regions: string[] | null;
  softRegions: string[];
  noteText: string | null;
  availabilityStartUtc: string | null;
  availabilityEndUtc: string | null;
  availabilitySourceOffsetMinutes: number | null;
  points: number;
};

type ClanOverviewResponse = {
  group: {
    name: string;
    memberCount: number;
  };
  members: ClanMember[];
};

type ClanOverviewClientProps = {
  clan: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

const REGION_IMAGES: Record<string, string> = {
  karamja: "https://oldschool.runescape.wiki/images/Karamja_Area_Badge.png",
  misthalin: "https://oldschool.runescape.wiki/images/Misthalin_Area_Badge.png",
  asgarnia: "https://oldschool.runescape.wiki/images/Asgarnia_Area_Badge.png?4ec29",
  desert: "https://oldschool.runescape.wiki/images/Desert_Area_Badge.png?2a1e3",
  fremennik: "https://oldschool.runescape.wiki/images/Fremennik_Area_Badge.png?f8338",
  kandarin: "https://oldschool.runescape.wiki/images/Kandarin_Area_Badge.png?f8338",
  morytania: "https://oldschool.runescape.wiki/images/Morytania_Area_Badge.png?2a1e3",
  tirannwn: "https://oldschool.runescape.wiki/images/Tirannwn_Area_Badge.png?4b9ee",
  wilderness: "https://oldschool.runescape.wiki/images/Wilderness_Area_Badge.png?2a1e3",
  kourend: "https://oldschool.runescape.wiki/images/Kourend_Area_Badge.png?1f79a",
};

const REGION_LABELS: Record<string, string> = {
  karamja: "Karamja",
  misthalin: "Misthalin",
  asgarnia: "Asgarnia",
  desert: "Desert",
  fremennik: "Fremennik",
  kandarin: "Kandarin",
  morytania: "Morytania",
  tirannwn: "Tirannwn",
  wilderness: "Wilderness",
  kourend: "Kourend",
};

const formatLocalDateLabel = (startUtc: string | null): string | null => {
  if (!startUtc) {
    return null;
  }
  return formatDate(new Date(startUtc));
};

const decoratePlayerName = (username: string, displayName: string): string => {
  if (username.toLowerCase() === "kazalaosrs") {
    return `♿ ${displayName}`;
  }
  if (
    username.toLowerCase() === "asiangrinder" ||
    displayName.toLowerCase() === "asiangrinder"
  ) {
    return `⛵ ${displayName}`;
  }
  return displayName;
};

// Flip HH:MM between AM and PM
const toggleAmPm = (hhmm: string, newAmPm: "AM" | "PM"): string => {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  if (newAmPm === "PM" && h < 12) h += 12;
  if (newAmPm === "AM" && h >= 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${mStr}`;
};

const getAmPm = (hhmm: string): "AM" | "PM" => {
  if (!hhmm) return "AM";
  return parseInt(hhmm.split(":")[0], 10) < 12 ? "AM" : "PM";
};

export default function ClanOverviewClient({ clan }: ClanOverviewClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState(clan);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [refreshOnCooldown, setRefreshOnCooldown] = useState<boolean>(false);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [isUpdatingPicks, setIsUpdatingPicks] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showPicksEditor, setShowPicksEditor] = useState(false);
  const [picksWarning, setPicksWarning] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [pickDraft, setPickDraft] = useState<Record<string, "hard" | "soft">>({
    karamja: "hard",
    misthalin: "hard",
  });
  const [availabilityYear, setAvailabilityYear] = useState(() => new Date().getFullYear());
  const [availabilityMonth, setAvailabilityMonth] = useState("");
  const [availabilityDay, setAvailabilityDay] = useState("");
  const [availabilityStartLocal, setAvailabilityStartLocal] = useState("");
  const { timeFormat } = useTimeFormat();

  useEffect(() => {
    setCurrentUsername(getUsernameCookie() ?? null);
  }, []);

  const refreshPoints = async (username: string, clanName: string, setCooldown = true) => {
    if (setCooldown) {
      setRefreshOnCooldown(true);
      setTimeout(() => setRefreshOnCooldown(false), 30_000);
    }
    try {
      const response = await fetch(`${API_BASE}/players/refresh-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, clan: clanName }),
      });
      const payload = (await response.json()) as { points?: number };
      const newPoints = payload.points ?? 0;
      setMembers((prev) =>
        prev.map((m) =>
          m.username.toLowerCase() === username.toLowerCase() ? { ...m, points: newPoints } : m,
        ),
      );
    } catch {
      // silently fail — keep existing points
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/groups/picks?name=${encodeURIComponent(clan)}`);
        const payload = (await response.json()) as ClanOverviewResponse | { error?: string };

        if (!response.ok || !("members" in payload)) {
          if (!cancelled) {
            setError((payload as { error?: string }).error ?? "Failed to load clan overview.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setGroupName(payload.group.name);
          setMembers(payload.members);
          setLoading(false);
          // Auto-refresh own player's points on load (no cooldown)
          const selfUsername = getUsernameCookie();
          if (selfUsername) {
            void refreshPoints(selfUsername, payload.group.name, false);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Network error while loading clan overview.");
          setLoading(false);
        }
      }
    };

    void loadOverview();

    return () => {
      cancelled = true;
    };
  }, [clan]);

  const registeredCount = useMemo(
    () => members.filter((member) => member.registered).length,
    [members],
  );

  const [filterRegion, setFilterRegion] = useState<string | null>(null);

  const formatLocalTime = (date: Date): string => {
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    return `${hour}:${minute}`;
  };

  const displayedMembers = useMemo(() => {
    let list = [...members];
    // Registered first
    list.sort((a, b) => {
      if (a.registered === b.registered) return 0;
      return a.registered ? -1 : 1;
    });
    // Apply region filter
    if (filterRegion) {
      list = list.filter(
        (m) => m.regions?.map((r) => r.toLowerCase()).includes(filterRegion),
      );
    }
    return list;
  }, [members, filterRegion]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearLoginCookies();
      router.push("/");
    }
  };

  const me = useMemo(() => {
    if (!currentUsername) {
      return null;
    }
    return members.find((m) => m.username.toLowerCase() === currentUsername.toLowerCase()) ?? null;
  }, [members, currentUsername]);

  useEffect(() => {
    if (!me) {
      return;
    }
    setNoteDraft(me.noteText ?? "");
    const draft: Record<string, "hard" | "soft"> = {
      karamja: "hard",
      misthalin: "hard",
    };
    const softSet = new Set((me.softRegions ?? []).map((r) => r.toLowerCase()));
    (me.regions ?? []).forEach((region) => {
      const regionId = region.toLowerCase();
      draft[regionId] = softSet.has(regionId) ? "soft" : "hard";
    });
    setPickDraft(draft);
    if (me.availabilityStartUtc) {
      const start = new Date(me.availabilityStartUtc);
      setAvailabilityYear(start.getFullYear());
      setAvailabilityMonth(String(start.getMonth() + 1).padStart(2, "0"));
      setAvailabilityDay(String(start.getDate()).padStart(2, "0"));
      setAvailabilityStartLocal(formatLocalTime(start));
    } else {
      const now = new Date();
      setAvailabilityYear(now.getFullYear());
      setAvailabilityMonth("");
      setAvailabilityDay("");
      setAvailabilityStartLocal("");
    }
  }, [me]);

  const handleUpdateNote = async () => {
    if (!currentUsername) {
      return;
    }

    const trimmedNote = noteDraft.trim();
    if (!trimmedNote) {
      setError("Note is required.");
      return;
    }

    let availabilityStartUtc: string | undefined;
    let availabilitySourceOffsetMinutes: number | undefined;

    if (availabilityMonth && availabilityDay && availabilityStartLocal) {
      const startLocalDate = new Date(
        `${availabilityYear}-${availabilityMonth}-${availabilityDay}T${availabilityStartLocal}:00`,
      );

      if (Number.isNaN(startLocalDate.getTime())) {
        setError("Invalid date or time.");
        return;
      }

      availabilityStartUtc = startLocalDate.toISOString();
      availabilitySourceOffsetMinutes = -startLocalDate.getTimezoneOffset();
    }

    setIsUpdatingNote(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/groups/picks/note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          clan: groupName,
          username: currentUsername,
          noteText: trimmedNote,
          ...(availabilityStartUtc !== undefined && { availabilityStartUtc }),
          ...(availabilitySourceOffsetMinutes !== undefined && { availabilitySourceOffsetMinutes }),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update note.");
        setIsUpdatingNote(false);
        return;
      }

      // Requested behavior: stay on page and refresh after update
      window.location.reload();
    } catch {
      setError("Network error while updating note.");
      setIsUpdatingNote(false);
    }
  };

  const selectedPickCount = useMemo(() => Object.keys(pickDraft).length, [pickDraft]);
  const unlockedPickCount = useMemo(
    () =>
      Object.keys(pickDraft).filter((id) => id !== "karamja" && id !== "misthalin").length,
    [pickDraft],
  );

  const togglePickDraft = (regionId: string) => {
    if (regionId === "karamja" || regionId === "misthalin" || isUpdatingPicks) {
      return;
    }

    const current = pickDraft[regionId];

    if (!current) {
      if (selectedPickCount >= 5) {
        setPicksWarning("You can only select 5 total regions.");
        return;
      }
      setPickDraft((prev) => ({ ...prev, [regionId]: "hard" }));
      setPicksWarning(null);
      return;
    }

    if (current === "hard") {
      setPickDraft((prev) => ({ ...prev, [regionId]: "soft" }));
      setPicksWarning(null);
      return;
    }

    setPickDraft((prev) => {
      const next = { ...prev };
      delete next[regionId];
      return next;
    });
    setPicksWarning(null);
  };

  const handleUpdatePicks = async () => {
    if (!currentUsername) {
      return;
    }

    if (selectedPickCount > 5) {
      setError("You cannot have more than 5 regions selected.");
      return;
    }


    const regions = Object.keys(pickDraft);
    const softRegions = Object.entries(pickDraft)
      .filter(([, type]) => type === "soft")
      .map(([id]) => id);

    setIsUpdatingPicks(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/groups/picks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          clan: groupName,
          username: currentUsername,
          regions,
          softRegions,
          noteText: noteDraft.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Failed to update picks.");
        setIsUpdatingPicks(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Network error while updating picks.");
      setIsUpdatingPicks(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl border border-forest/20 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-vscode-border dark:bg-vscode-surface sm:p-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.28em] text-forest/80 dark:text-slate-400">
              Clan Overview
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-forest dark:text-slate-100 sm:text-4xl">
              {groupName}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-300 dark:border dark:border-vscode-border dark:bg-vscode-input dark:text-slate-100 dark:hover:bg-vscode-raised disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loggingOut ? "Logging out..." : "Log Out"}
          </button>
        </div>

        {loading ? <p className="mt-3 text-sm text-slate-700 dark:text-slate-400">Loading members...</p> : null}
        {error ? <p className="mt-3 text-sm font-semibold text-ember dark:text-red-300">{error}</p> : null}

        {/* Debug panel — remove once login is working */}
        <details className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs dark:border-yellow-700 dark:bg-yellow-900/20">
          <summary className="cursor-pointer font-semibold text-yellow-700 dark:text-yellow-300">Debug info (click to expand)</summary>
          <ul className="mt-2 space-y-1 text-yellow-800 dark:text-yellow-200">
            <li><strong>loading:</strong> {String(loading)}</li>
            <li><strong>error:</strong> {error ?? "none"}</li>
            <li><strong>currentUsername (localStorage):</strong> {currentUsername ?? "null — not found"}</li>
            <li><strong>members loaded:</strong> {members.length}</li>
            <li><strong>me found in members:</strong> {me ? "yes" : "no"}</li>
            <li><strong>localStorage username:</strong> {typeof window !== "undefined" ? (window.localStorage.getItem("username") ?? "(none)") : "SSR"}</li>
            <li><strong>localStorage clan:</strong> {typeof window !== "undefined" ? (window.localStorage.getItem("clan") ?? "(none)") : "SSR"}</li>
          </ul>
        </details>

        {!loading && !error && !currentUsername ? (
          <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-600 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">You are not logged in — your profile card is hidden.</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">No username found in localStorage. Please log in again.</p>
            <a href="/" className="mt-3 inline-block rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500 dark:bg-amber-600 dark:hover:bg-amber-500">
              Go to Login
            </a>
          </div>
        ) : null}

        {!loading && !error && currentUsername ? (() => {
          const softSet = new Set(me?.softRegions ?? []);
          return (
            <div className="mt-6 rounded-2xl border-2 border-forest/40 bg-forest/5 p-5 shadow-sm dark:border-vscode-border dark:bg-vscode-surface">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-forest/60 dark:text-slate-400">My League Profile</p>
                  <div className="mt-0.5 flex items-center gap-3">
                    <p className="font-display text-lg font-bold text-forest dark:text-slate-200">{currentUsername}</p>
                    <span className="rounded-md bg-forest/10 px-2 py-0.5 text-sm font-semibold text-forest dark:bg-vscode-input dark:text-slate-200">
                      {(me?.points ?? 0).toLocaleString()} pts
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPicksEditor((prev) => !prev)}
                    className="rounded-lg border border-forest/30 bg-white px-3 py-1.5 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white dark:border-vscode-border dark:bg-vscode-raised dark:text-slate-200 dark:hover:bg-vscode-input"
                  >
                    {showPicksEditor ? "Close Picks" : "Edit Picks"}
                  </button>
                  <button
                    onClick={() => setShowNoteEditor((prev) => !prev)}
                    className="rounded-lg border border-forest/30 bg-white px-3 py-1.5 text-sm font-semibold text-forest transition hover:bg-forest hover:text-white dark:border-vscode-border dark:bg-vscode-raised dark:text-slate-200 dark:hover:bg-vscode-input"
                  >
                    {showNoteEditor ? "Close Note" : "Edit Note"}
                  </button>
                </div>
              </div>

              {/* Picks + Note side-by-side on larger screens */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {/* Picks section */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-vscode-border dark:bg-vscode-raised">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Region Picks</p>
                  {me?.regions && me.regions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {me.regions.map((region) => {
                        const isSoft = softSet.has(region);
                        return (
                          <div
                            key={region}
                            title={`${REGION_LABELS[region] ?? region}${isSoft ? " (soft)" : ""}`}
                            className={`flex flex-col items-center rounded-lg border-2 px-2 py-1 ${
                              isSoft
                                ? "border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-900/20"
                                : "border-green-600 bg-green-50 dark:border-green-500 dark:bg-green-900/20"
                            }`}
                          >
                            <img
                              src={REGION_IMAGES[region]}
                              alt={REGION_LABELS[region] ?? region}
                              className="h-10 w-10 object-contain"
                              loading="lazy"
                            />
                            <span className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                              {REGION_LABELS[region] ?? region}
                            </span>
                            {isSoft && (
                              <span className="text-xs font-semibold text-orange-500 dark:text-orange-300">soft</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">No picks registered yet.</p>
                  )}
                </div>

                {/* Note + availability section */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-vscode-border dark:bg-vscode-raised">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Note</p>
                  {me?.noteText ? (
                    <p className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{me.noteText}</p>
                  ) : (
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">No note posted yet.</p>
                  )}
                  {me?.availabilityStartUtc ? (
                    <div className="mt-3 border-t border-slate-100 pt-2 dark:border-vscode-sep">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Start Time</p>
                      <p
                        title="This time is shown in your local time zone."
                        className="mt-0.5 cursor-help text-sm font-semibold text-slate-700 underline decoration-dotted decoration-slate-400 dark:text-slate-200 dark:decoration-vscode-border"
                      >
                        {formatTime(new Date(me.availabilityStartUtc), timeFormat)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatLocalDateLabel(me.availabilityStartUtc)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs italic text-slate-400 dark:text-slate-500">No time set.</p>
                  )}
                </div>
              </div>

              {showNoteEditor ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 dark:border-vscode-border dark:bg-vscode-raised">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Update note &amp; Start Time <span className="text-red-500 dark:text-red-300">*</span>
                  </p>

                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      required
                      maxLength={300}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200 dark:placeholder-slate-500"
                      placeholder="I want to raid in Morytania"
                    />

                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Start date &amp; time (optional)</p>
                    </div>
                    <div className="mt-1 grid gap-2 sm:grid-cols-3">
                      {timeFormat === "24h" ? (
                        // 24h: Day → Month order
                        <>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Day
                            </label>
                            <select
                              value={availabilityDay}
                              onChange={(event) => setAvailabilityDay(event.target.value)}
                              required
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                            >
                              <option value="">--</option>
                              {Array.from({ length: 31 }, (_, idx) => {
                                const value = String(idx + 1).padStart(2, "0");
                                return <option key={value} value={value}>{value}</option>;
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Month
                            </label>
                            <select
                              value={availabilityMonth}
                              onChange={(event) => setAvailabilityMonth(event.target.value)}
                              required
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                            >
                              <option value="">--</option>
                              {Array.from({ length: 12 }, (_, idx) => {
                                const value = String(idx + 1).padStart(2, "0");
                                return <option key={value} value={value}>{value}</option>;
                              })}
                            </select>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Start Time
                              </label>
                              {(availabilityMonth || availabilityDay || availabilityStartLocal) && (
                                <button
                                  type="button"
                                  onClick={() => { setAvailabilityMonth(""); setAvailabilityDay(""); setAvailabilityStartLocal(""); }}
                                  className="text-xs font-semibold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Clear time
                                </button>
                              )}
                            </div>
                            <input
                              type="time"
                              value={availabilityStartLocal}
                              onChange={(event) => setAvailabilityStartLocal(event.target.value)}
                              required
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                            />
                          </div>
                        </>
                      ) : (
                        // 12h: Month → Day, type=time + AM/PM dropdown
                        <>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Month
                            </label>
                            <select
                              value={availabilityMonth}
                              onChange={(event) => setAvailabilityMonth(event.target.value)}
                              required
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                            >
                              <option value="">--</option>
                              {Array.from({ length: 12 }, (_, idx) => {
                                const value = String(idx + 1).padStart(2, "0");
                                return <option key={value} value={value}>{value}</option>;
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Day
                            </label>
                            <select
                              value={availabilityDay}
                              onChange={(event) => setAvailabilityDay(event.target.value)}
                              required
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                            >
                              <option value="">--</option>
                              {Array.from({ length: 31 }, (_, idx) => {
                                const value = String(idx + 1).padStart(2, "0");
                                return <option key={value} value={value}>{value}</option>;
                              })}
                            </select>
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Start Time
                              </label>
                              {(availabilityMonth || availabilityDay || availabilityStartLocal) && (
                                <button
                                  type="button"
                                  onClick={() => { setAvailabilityMonth(""); setAvailabilityDay(""); setAvailabilityStartLocal(""); }}
                                  className="text-xs font-semibold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                >
                                  Clear time
                                </button>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <input
                                type="time"
                                value={availabilityStartLocal}
                                onChange={(event) => setAvailabilityStartLocal(event.target.value)}
                                required
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                              />
                              <select
                                value={getAmPm(availabilityStartLocal)}
                                onChange={(e) => setAvailabilityStartLocal(toggleAmPm(availabilityStartLocal, e.target.value as "AM" | "PM"))}
                                className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-forest focus:ring-2 focus:ring-forest/20 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200"
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdateNote}
                      disabled={isUpdatingNote}
                      className="mt-3 rounded-lg border border-forest/30 bg-forest px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isUpdatingNote ? "Updating..." : "Update Note"}
                    </button>
                  </div>
                ) : null}

                {showPicksEditor ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-vscode-border dark:bg-vscode-raised">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Update picks (green=hard, orange=soft)
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selected: {selectedPickCount}/5 (max 5)</p>
                    {picksWarning ? (
                      <p className="mt-1 text-xs font-semibold text-red-500 dark:text-red-300">{picksWarning}</p>
                    ) : null}

                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {Object.entries(REGION_LABELS).map(([regionId, label]) => {
                        const pickType = pickDraft[regionId];
                        const isLocked = regionId === "karamja" || regionId === "misthalin";
                        const cardClass =
                          pickType === "hard"
                            ? "border-green-600 bg-green-50 dark:border-green-500/60 dark:bg-green-900/25"
                            : pickType === "soft"
                              ? "border-orange-400 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-900/25"
                              : "border-slate-300 bg-white dark:border-vscode-border dark:bg-vscode-raised";

                        return (
                          <button
                            key={regionId}
                            type="button"
                            onClick={() => togglePickDraft(regionId)}
                            className={`rounded-lg border-2 p-2 text-left transition ${cardClass} ${
                              isLocked ? "cursor-not-allowed" : "hover:scale-[1.01]"
                            }`}
                            disabled={isUpdatingPicks}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                              {isLocked ? (
                                <span className="rounded bg-green-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                  locked
                                </span>
                              ) : null}
                            </div>
                            <img
                              src={REGION_IMAGES[regionId]}
                              alt={label}
                              className="mx-auto mt-2 h-9 w-9 object-contain"
                              loading="lazy"
                            />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleUpdatePicks}
                      disabled={isUpdatingPicks}
                      className="mt-3 rounded-lg border border-forest/30 bg-forest px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isUpdatingPicks ? "Updating..." : "Update Picks"}
                    </button>
                  </div>
                ) : null}
            </div>
          );
        })() : null}

        {!loading && !error ? (
          <>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-400">Registered picks: {registeredCount}/{members.length}</p>

            {/* Region filter */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Filter by region:</span>
              <button
                onClick={() => setFilterRegion(null)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filterRegion === null
                    ? "bg-forest text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-vscode-raised dark:text-slate-400 dark:hover:bg-vscode-input"
                }`}
              >
                All
              </button>
              {Object.entries(REGION_LABELS).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFilterRegion(filterRegion === id ? null : id)}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition ${
                    filterRegion === id
                      ? "bg-forest text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-vscode-raised dark:text-slate-400 dark:hover:bg-vscode-input"
                  }`}
                >
                  <img src={REGION_IMAGES[id]} alt={label} className="h-4 w-4 object-contain" />
                  {label}
                </button>
              ))}
            </div>

            {filterRegion && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                Showing {displayedMembers.length} player{displayedMembers.length !== 1 ? "s" : ""} with {REGION_LABELS[filterRegion]}
              </p>
            )}

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-vscode-border">
              <table className="w-full border-collapse bg-white text-left text-sm dark:bg-vscode-surface">
                <thead>
                  <tr className="bg-slate-100 dark:bg-vscode-raised">
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Player</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Points</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Region Picks</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">Note &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMembers.map((member) => {
                    const softSet = new Set(member.softRegions ?? []);

                    return (
                      <tr key={member.username} className="border-t border-slate-200 dark:border-vscode-sep">
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={refreshOnCooldown}
                              title={refreshOnCooldown ? "Refresh on cooldown (30s)" : "Refresh points"}
                              onClick={() => void refreshPoints(member.username, groupName)}
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition ${
                                refreshOnCooldown
                                  ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-vscode-raised dark:text-slate-600"
                                  : "bg-forest/10 text-forest hover:bg-forest hover:text-white dark:bg-vscode-raised dark:text-slate-400 dark:hover:bg-forest dark:hover:text-white"
                              }`}
                            >
                              ↻
                            </button>
                            {decoratePlayerName(member.username, member.displayName)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {member.points ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {member.regions && member.regions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {member.regions.map((region) => {
                                const isSoft = softSet.has(region);
                                return (
                                  <div
                                    key={region}
                                    title={`${REGION_LABELS[region] ?? region}${isSoft ? " (soft)" : ""}`}
                                    className={`flex flex-col items-center rounded-lg border-2 px-1.5 py-1 ${
                                      isSoft
                                      ? "border-orange-400 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-900/25"
                                      : "border-green-600 bg-green-50 dark:border-green-500/60 dark:bg-green-900/25"
                                  }`}
                                >
                                  <img
                                    src={REGION_IMAGES[region]}
                                    alt={REGION_LABELS[region] ?? region}
                                    className="h-8 w-8 object-contain"
                                    loading="lazy"
                                  />
                                  <span className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                                      {REGION_LABELS[region] ?? region}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic dark:text-slate-500">unregistered</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {member.noteText ? (
                            <p className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-200">{member.noteText}</p>
                          ) : (
                            <p className="text-xs italic text-slate-400 dark:text-slate-500">No note</p>
                          )}

                          {member.availabilityStartUtc ? (
                            <div className="mt-1">
                              <p
                                title="This time is shown in your local time zone."
                                className="cursor-help text-xs text-slate-700 underline decoration-dotted decoration-slate-400 dark:text-slate-200 dark:decoration-vscode-border"
                              >
                                {formatTime(new Date(member.availabilityStartUtc), timeFormat)}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {formatLocalDateLabel(member.availabilityStartUtc)}
                              </p>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
