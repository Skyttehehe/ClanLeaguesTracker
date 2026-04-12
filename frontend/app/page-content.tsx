"use client";

import * as Label from "@radix-ui/react-label";
import { Transition } from "@headlessui/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import {
  getClanCookie,
  getUsernameCookie,
  setLoginCookies,
  clearLoginCookies,
  isLoggedIn,
} from "@/lib/cookies";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export default function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clan, setClan] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("Fill in both fields to log in.");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  const buttonLabel = useMemo(() => (loading ? "Logging in..." : "Log In"), [loading]);

  // Check for existing login on mount
  useEffect(() => {
    setMounted(true);
    // Pre-fill clan from URL param
    const clanParam = searchParams.get("clan");
    if (clanParam) setClan(clanParam);
    if (isLoggedIn()) {
      const savedClan = getClanCookie();
      const savedUsername = getUsernameCookie();
      if (savedClan && savedUsername) {
        setLoggedIn(true);
        // Auto-redirect to clan overview
        router.push(`/clan?clan=${encodeURIComponent(savedClan)}`);
      }
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedClan = clan.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!normalizedClan || !normalizedUsername) {
      setStatus("error");
      setResult("Please enter both clan and username.");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setResult("Logging in...");

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          clan: normalizedClan,
          username: normalizedUsername,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; clan?: string; error?: string };

      if (!response.ok || !payload.ok) {
        setStatus("error");
        setResult(payload.error ?? "Login failed. Please try again.");
        return;
      }

      if (payload.clan) {
        // Set login data and check if user already has picks
        setLoginCookies(payload.clan, normalizedUsername);
        setStatus("ok");
        setResult(`Logged in as ${normalizedUsername}. Checking your picks...`);
        setLoggedIn(true);

        // Check if the user already has regions registered
        let alreadyRegistered = false;
        try {
          const picksResponse = await fetch(`${API_BASE}/groups/picks?name=${encodeURIComponent(payload.clan)}`);
          const picksPayload = (await picksResponse.json()) as {
            members?: Array<{ username: string; registered: boolean; regions: string[] | null }>;
          };
          const me = picksPayload.members?.find(
            (m) => m.username.toLowerCase() === normalizedUsername,
          );
          alreadyRegistered = Boolean(me?.registered || (me?.regions && me.regions.length > 0));
        } catch {
          // If check fails, fall through to regions page
        }

        setResult(`Logged in as ${normalizedUsername}. Redirecting...`);

        setTimeout(() => {
          if (alreadyRegistered) {
            router.push(`/clan?clan=${encodeURIComponent(payload.clan!)}`);
          } else {
            router.push(
              `/regions?clan=${encodeURIComponent(payload.clan!)}&username=${encodeURIComponent(normalizedUsername)}`,
            );
          }
        }, 500);
      }
    } catch (error) {
      setStatus("error");
      setResult("Could not reach backend API.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearLoginCookies();
      setLoggedIn(false);
      setLoading(false);
      setResult("Logged out successfully.");
      setStatus("ok");
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-10 sm:px-8">
      <section className="w-full rounded-3xl border border-forest/20 bg-white/80 p-8 shadow-xl backdrop-blur-md dark:border-vscode-border dark:bg-vscode-surface sm:p-12">
        <p className="font-display text-xs uppercase tracking-[0.28em] text-forest/80 dark:text-slate-400">
          Clan Leagues Tracker
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-forest dark:text-slate-100 sm:text-4xl">
          {loggedIn ? "Welcome Back" : "Check Clan Membership"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {loggedIn
            ? "You are logged in. Your picks will be saved automatically."
            : "Enter your clan and username."}
        </p>

        {loggedIn ? (
          <div className="mt-8">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Logged in as: <strong>{getUsernameCookie() || "user"}</strong> in{" "}
              <strong>{getClanCookie() || "clan"}</strong>
            </p>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="mt-4 rounded-xl bg-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-300 dark:border dark:border-vscode-border dark:bg-vscode-input dark:text-slate-100 dark:hover:bg-vscode-raised disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Logging out..." : "Log Out"}
            </button>
          </div>
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
            <div>
              <Label.Root className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="clan">
                Clan
              </Label.Root>
              <input
                id="clan"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/25 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200 dark:placeholder-slate-500"
                value={clan}
                onChange={(event) => setClan(event.target.value)}
                placeholder=""
                required
              />
            </div>

            <div>
              <Label.Root className="text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="username">
                Username
              </Label.Root>
              <input
                id="username"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/25 dark:border-vscode-border dark:bg-vscode-input dark:text-slate-200 dark:placeholder-slate-500"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="skytte"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-xl bg-forest px-4 py-2 font-semibold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {buttonLabel}
            </button>
          </form>
        )}

        <Transition
          as={Fragment}
          show={true}
          appear={true}
          enter="transition duration-300"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
        >
          <p
            className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
              status === "ok"
                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300"
                : status === "error"
                  ? "border-ember/35 bg-red-50 text-ember dark:border-red-700 dark:bg-red-900/20 dark:text-red-300"
                  : "border-slate-300 bg-slate-50 text-slate-700 dark:border-vscode-border dark:bg-vscode-raised dark:text-slate-400"
            }`}
          >
            {result}
          </p>
        </Transition>
      </section>
    </main>
  );
}
