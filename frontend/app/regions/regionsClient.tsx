"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type RegionCard = {
  id: string;
  name: string;
  imageUrl: string;
  locked?: boolean;
};

type RegionsClientProps = {
  clan: string;
  username: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

const REGION_CARDS: RegionCard[] = [
  {
    id: "karamja",
    name: "Karamja",
    imageUrl: "https://oldschool.runescape.wiki/images/Karamja_Area_Badge.png",
    locked: true,
  },
  {
    id: "varlamore",
    name: "Varlamore",
    imageUrl: "https://oldschool.runescape.wiki/images/Varlamore_Area_Badge.png?2e60e",
    locked: true,
  },
  {
    id: "asgarnia",
    name: "Asgarnia",
    imageUrl: "https://oldschool.runescape.wiki/images/Asgarnia_Area_Badge.png?4ec29",
  },
  {
    id: "desert",
    name: "Desert",
    imageUrl: "https://oldschool.runescape.wiki/images/Desert_Area_Badge.png?2a1e3",
  },
  {
    id: "fremennik",
    name: "Fremennik",
    imageUrl: "https://oldschool.runescape.wiki/images/Fremennik_Area_Badge.png?f8338",
  },
  {
    id: "kandarin",
    name: "Kandarin",
    imageUrl: "https://oldschool.runescape.wiki/images/Kandarin_Area_Badge.png?f8338",
  },
  {
    id: "morytania",
    name: "Morytania",
    imageUrl: "https://oldschool.runescape.wiki/images/Morytania_Area_Badge.png?2a1e3",
  },
  {
    id: "tirannwn",
    name: "Tirannwn",
    imageUrl: "https://oldschool.runescape.wiki/images/Tirannwn_Area_Badge.png?4b9ee",
  },
  {
    id: "wilderness",
    name: "Wilderness",
    imageUrl: "https://oldschool.runescape.wiki/images/Wilderness_Area_Badge.png?2a1e3",
  },
  {
    id: "kourend",
    name: "Kourend",
    imageUrl: "https://oldschool.runescape.wiki/images/Kourend_Area_Badge.png?1f79a",
  },
];

export default function RegionsClient({ clan, username }: RegionsClientProps) {
  const router = useRouter();
  // pickType: "hard" = green, "soft" = orange, undefined = not selected
  const [pickType, setPickType] = useState<Record<string, "hard" | "soft">>({
    karamja: "hard",
    varlamore: "hard",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading your picks...");
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing picks on mount
  useEffect(() => {
    const loadExistingPicks = async () => {
      try {
        const response = await fetch(`${API_BASE}/groups/picks?name=${encodeURIComponent(clan)}`);
        const payload = (await response.json()) as {
          members?: Array<{
            username: string;
            regions: string[] | null;
            softRegions: string[];
          }>;
        };

        if (response.ok && payload.members) {
          const userEntry = payload.members.find(
            (m) => m.username.toLowerCase() === username.toLowerCase(),
          );

          if (userEntry && userEntry.regions && userEntry.regions.length > 0) {
            const softSet = new Set((userEntry.softRegions ?? []).map((r) => r.toLowerCase()));
            const picks: Record<string, "hard" | "soft"> = {};
            userEntry.regions.forEach((region) => {
              picks[region.toLowerCase()] = softSet.has(region.toLowerCase()) ? "soft" : "hard";
            });
            setPickType(picks);
            setIsFirstTime(false);
            setStatusMessage("Your picks loaded. Click to cycle: green → orange (soft) → unselected.");
          } else {
            setIsFirstTime(true);
            setStatusMessage("Pick 3 extra regions. Click once for hard pick (green), twice for soft pick (orange).");
          }
        } else {
          setIsFirstTime(true);
          setStatusMessage("Pick 3 extra regions. Click once for hard pick (green), twice for soft pick (orange).");
        }
      } catch {
        setIsFirstTime(true);
        setStatusMessage("Pick 3 extra regions. Click once for hard pick (green), twice for soft pick (orange).");
      } finally {
        setIsLoading(false);
      }
    };

    void loadExistingPicks();
  }, [clan, username]);

  const totalSelected = useMemo(
    () => Object.keys(pickType).length,
    [pickType],
  );

  const unlockedSelectedCount = useMemo(
    () => REGION_CARDS.filter((r) => !r.locked && Boolean(pickType[r.id])).length,
    [pickType],
  );

  const selectedRegions = useMemo(
    () => REGION_CARDS.filter((r) => pickType[r.id]).map((r) => r.id),
    [pickType],
  );

  const softRegions = useMemo(
    () => REGION_CARDS.filter((r) => pickType[r.id] === "soft").map((r) => r.id),
    [pickType],
  );

  const canSaveAndContinue = unlockedSelectedCount === 3 && !isSaving && !hasSaved;

  const toggleRegion = (region: RegionCard) => {
    if (region.locked || isSaving || hasSaved || isLoading) return;

    const current = pickType[region.id];

    if (!current) {
      // unselected → hard
      if (totalSelected >= 5) {
        setStatusMessage("You already have 5 regions selected.");
        return;
      }
      setPickType((prev) => ({ ...prev, [region.id]: "hard" }));
    } else if (current === "hard") {
      // hard → soft
      setPickType((prev) => ({ ...prev, [region.id]: "soft" }));
    } else {
      // soft → unselected
      setPickType((prev) => {
        const next = { ...prev };
        delete next[region.id];
        return next;
      });
    }

    setStatusMessage("Pick 3 extra regions. Green = hard pick, Orange = soft pick.");
  };

  const handleSaveAndContinue = async () => {
    if (unlockedSelectedCount !== 3 || isSaving || hasSaved) return;

    setIsSaving(true);
    setStatusMessage("Saving your picks...");

    try {
      const response = await fetch(`${API_BASE}/groups/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clan,
          username,
          regions: selectedRegions,
          softRegions,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setStatusMessage(payload.error ?? "Could not save region picks.");
        setIsSaving(false);
        return;
      }

      setHasSaved(true);
      setStatusMessage("Saved! Redirecting to clan overview...");
      router.push(`/clan?clan=${encodeURIComponent(clan)}`);
    } catch {
      setStatusMessage("Network error while saving picks.");
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-10 sm:px-8">
      <section className="rounded-3xl border border-forest/20 bg-white/80 p-6 shadow-xl backdrop-blur-md dark:border-vscode-border dark:bg-vscode-surface sm:p-10">
        <p className="font-display text-xs uppercase tracking-[0.28em] text-forest/80 dark:text-slate-400">
          {isFirstTime ? "First Registration" : "Region Selection"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-forest dark:text-slate-100 sm:text-4xl">
          Welcome {username}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Clan: {clan}</p>
        {!isLoading && (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Selected regions: {totalSelected}/5</p>
            <div className="mt-1 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Hard pick
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-full bg-orange-400" /> Soft pick
              </span>
            </div>
          </>
        )}
        <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{statusMessage}</p>

        {!isLoading && (
          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={!canSaveAndContinue}
            className="mt-4 rounded-xl bg-forest px-4 py-2 font-semibold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isFirstTime ? "Register Picks" : "Update Picks"}
          </button>
        )}



        {isLoading ? (
          <div className="mt-8 py-12 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading your region data...</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {REGION_CARDS.map((region) => {
              const pick = pickType[region.id];
              const isLocked = Boolean(region.locked);

              const borderClass =
                pick === "hard"
                  ? "border-green-600 bg-green-50 dark:border-green-500/60 dark:bg-green-900/25"
                  : pick === "soft"
                    ? "border-orange-400 bg-orange-50 dark:border-orange-500/60 dark:bg-orange-900/25"
                    : "border-slate-300 bg-white dark:border-vscode-border dark:bg-vscode-raised";

              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${borderClass} ${
                    isLocked ? "cursor-not-allowed" : "hover:scale-[1.02]"
                  }`}
                  disabled={isSaving || hasSaved}
                  aria-label={`${region.name} - ${pick ?? "not selected"}. ${isLocked ? "Locked" : "Click to cycle."}`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                      {region.name}
                    </h2>
                    {isLocked ? (
                      <span className="rounded-full bg-green-700 px-2 py-0.5 text-xs font-semibold text-white">
                        Locked
                      </span>
                    ) : pick === "soft" ? (
                      <span className="rounded-full bg-orange-400 px-2 py-0.5 text-xs font-semibold text-white">
                        Soft
                      </span>
                    ) : null}
                  </div>
                  <img
                    src={region.imageUrl}
                    alt={`${region.name} badge`}
                    className="mx-auto mt-3 h-16 w-16 object-contain"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
