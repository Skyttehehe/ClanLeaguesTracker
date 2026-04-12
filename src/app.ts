import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import IORedis from "ioredis";
import rateLimit from "express-rate-limit";

const cookieParser = require("cookie-parser");

import { config } from "./config";
import { prisma } from "./lib/prisma";
import { enqueueClanSync } from "./queues/clanSyncQueue";
import {
  groupPicksQuerySchema,
  groupMembersQuerySchema,
  incomingPayloadSchema,
  playerSearchQuerySchema,
  saveRegionPicksSchema,
  updateNoteSchema,
  updatePointsSchema,
  refreshPlayerPointsSchema,
} from "./types";

type WomGroupDetails = {
  id: number;
  name: string;
  clanChat: string | null;
  memberCount: number;
  memberships: Array<{
    role: string;
    player: {
      id: number;
      username: string;
      displayName: string;
      type: string;
      status: string;
    };
  }>;
};

type StoredRegionSelection = {
  username: string;
  regions: unknown;
  softRegions: unknown;
  noteText: string | null;
  availabilityStartUtc: Date | null;
  availabilityEndUtc: Date | null;
  availabilitySourceOffsetMinutes: number | null;
  points: number;
};

const womFetchHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    "User-Agent": config.womUserAgent,
  };
  if (config.womApiKey) {
    headers["x-api-key"] = config.womApiKey;
  }
  return headers;
};

const getGroupDetailsByName = async (name: string): Promise<WomGroupDetails> => {
  const searchUrl = `${config.womBaseUrl}/groups?name=${encodeURIComponent(name)}`;
  const groupsResponse = await fetch(searchUrl, { headers: womFetchHeaders() });

  if (!groupsResponse.ok) {
    throw new Error(`GROUP_SEARCH_FAILED (HTTP ${groupsResponse.status})`);
  }

  const groupsBody = (await groupsResponse.json()) as Array<{
    id: number;
    name: string;
    clanChat: string | null;
  }>;

  const normalizedName = name.toLowerCase();
  const group =
    groupsBody.find(
      (entry) =>
        entry.name.toLowerCase() === normalizedName ||
        (entry.clanChat ?? "").toLowerCase() === normalizedName,
    ) ?? groupsBody[0];

  if (!group) {
    throw new Error("GROUP_NOT_FOUND");
  }

  const detailsUrl = `${config.womBaseUrl}/groups/${group.id}`;
  const detailsResponse = await fetch(detailsUrl, { headers: womFetchHeaders() });

  if (!detailsResponse.ok) {
    throw new Error(`GROUP_DETAILS_FAILED (HTTP ${detailsResponse.status})`);
  }

  const detailsBody = (await detailsResponse.json()) as WomGroupDetails;

  return detailsBody;
};

export const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = new Set([
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        config.frontendUrl,
        ...(config.corsOrigin ? config.corsOrigin.split(",").map((o) => o.trim()) : []),
      ]);

      if (!origin || allowed.has(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: '${origin}'. Allowed: ${[...allowed].join(", ")}`);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests. Try again later.",
      limit: config.rateLimitMaxRequests,
      windowMs: config.rateLimitWindowMs,
    },
  }),
);

app.get("/", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/health/deps", async (_req, res) => {
  const checks = {
    postgres: false,
    redis: false,
  };

  try {
    if (prisma) {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = true;
    }
  } catch {
    checks.postgres = false;
  }

  try {
    const redis = new IORedis(config.redisUrl, { lazyConnect: true });
    await redis.connect();
    const pong = await redis.ping();
    await redis.quit();
    checks.redis = pong === "PONG";
  } catch {
    checks.redis = false;
  }

  return res.status(200).json({ ok: true, checks });
});

app.post("/auth/login", async (req: Request, res: Response) => {
  const { clan, username } = req.body;

  if (!clan || typeof clan !== "string" || !username || typeof username !== "string") {
    return res.status(400).json({
      error: "Missing or invalid clan or username",
    });
  }

  const normalizedClan = clan.trim();
  const normalizedUsername = username.trim().toLowerCase();

  if (!normalizedClan || !normalizedUsername) {
    return res.status(400).json({
      error: "Clan and username cannot be empty",
    });
  }

  try {
    // Validate clan exists and user is a member
    const groupDetails = await getGroupDetailsByName(normalizedClan);
    const isMember = groupDetails.memberships.some(
      (membership) => membership.player.username.toLowerCase() === normalizedUsername,
    );

    if (!isMember) {
      return res.status(401).json({
        error: "User is not a member of this clan",
      });
    }

    // Set cookies (valid for 30 days)
    res.cookie("clan", groupDetails.name, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.cookie("username", normalizedUsername, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(200).json({
      ok: true,
      clan: groupDetails.name,
      username: normalizedUsername,
    });
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return res.status(404).json({
        error: "Clan not found",
      });
    }

    return res.status(500).json({
      error: "Failed to authenticate",
    });
  }
});

app.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie("clan");
  res.clearCookie("username");
  return res.status(200).json({ ok: true });
});

app.get("/auth/session", (req: Request, res: Response) => {
  const clan = (req.cookies as Record<string, string>).clan;
  const username = (req.cookies as Record<string, string>).username;

  if (!clan || !username) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    clan,
    username,
  });
});

app.get("/players/search", async (req: Request, res: Response) => {
  const parsedQuery = playerSearchQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid query params",
      details: parsedQuery.error.flatten(),
    });
  }

  const { username } = parsedQuery.data;
  const endpoint = `${config.womBaseUrl}/players/search?username=${encodeURIComponent(username)}`;

  try {
    const response = await fetch(endpoint, { headers: womFetchHeaders() });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Failed to fetch player search from Wise Old Man",
        upstream: body,
      });
    }

    return res.status(200).json({
      baseUrl: config.womBaseUrl,
      username,
      results: body,
    });
  } catch (error) {
    console.error("WOM player search error:", error);
    return res.status(502).json({
      error: "Could not reach Wise Old Man API",
    });
  }
});

app.get("/groups/members", async (req: Request, res: Response) => {
  const parsedQuery = groupMembersQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid query params",
      details: parsedQuery.error.flatten(),
    });
  }

  const { name } = parsedQuery.data;

  try {
    const detailsBody = await getGroupDetailsByName(name);

    const members = (detailsBody.memberships ?? []).map((membership) => ({
      role: membership.role,
      playerId: membership.player.id,
      username: membership.player.username,
      displayName: membership.player.displayName,
      type: membership.player.type,
      status: membership.player.status,
    }));

    return res.status(200).json({
      group: {
        id: detailsBody.id,
        name: detailsBody.name,
        clanChat: detailsBody.clanChat,
        memberCount: detailsBody.memberCount,
      },
      members,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return res.status(404).json({ error: "Group not found", query: name });
    }

    console.error("WOM group members error:", error);
    return res.status(502).json({
      error: "Could not reach Wise Old Man API",
    });
  }
});

app.post("/groups/picks", async (req: Request, res: Response) => {
  const parsedBody = saveRegionPicksSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid picks payload",
      details: parsedBody.error.flatten(),
    });
  }

  const normalizedRegions = parsedBody.data.regions.map((region) => region.toLowerCase());
  const uniqueRegions = Array.from(new Set(normalizedRegions));
  const extraUnlockedCount = uniqueRegions.filter(
    (region) => region !== "karamja" && region !== "misthalin",
  ).length;

  if (uniqueRegions.length < 2 || uniqueRegions.length > 5) {
    return res.status(400).json({
      error: "You must have between 2 and 5 regions selected (locked regions count toward the total)",
    });
  }

  const clanKey = parsedBody.data.clan.trim().toLowerCase();
  const usernameKey = parsedBody.data.username.trim().toLowerCase();

  if (!prisma) {
    return res.status(503).json({
      error: "Database is offline. Run with Docker (npm run dev) or set up PostgreSQL locally and run npm run prisma:migrate",
    });
  }

  const softRegions = (parsedBody.data.softRegions ?? [])
    .map((r) => r.toLowerCase())
    .filter((r) => uniqueRegions.includes(r));
  const noteText = parsedBody.data.noteText?.trim() ? parsedBody.data.noteText.trim() : null;
  const availabilityStartUtc = parsedBody.data.availabilityStartUtc
    ? new Date(parsedBody.data.availabilityStartUtc)
    : null;
  const availabilityEndUtc = parsedBody.data.availabilityEndUtc
    ? new Date(parsedBody.data.availabilityEndUtc)
    : null;
  const availabilitySourceOffsetMinutes =
    parsedBody.data.availabilitySourceOffsetMinutes ?? null;

  try {
    const saved = await prisma.regionSelection.upsert({
      where: {
        clanName_username: {
          clanName: clanKey,
          username: usernameKey,
        },
      },
      update: {
        regions: uniqueRegions,
        softRegions,
        noteText,
        availabilityStartUtc,
        availabilityEndUtc,
        availabilitySourceOffsetMinutes,
        displayClanName: parsedBody.data.clan.trim(),
        displayUsername: parsedBody.data.username.trim(),
      },
      create: {
        clanName: clanKey,
        username: usernameKey,
        displayClanName: parsedBody.data.clan.trim(),
        displayUsername: parsedBody.data.username.trim(),
        regions: uniqueRegions,
        softRegions,
        noteText,
        availabilityStartUtc,
        availabilityEndUtc,
        availabilitySourceOffsetMinutes,
      },
    });

    return res.status(200).json({
      saved: true,
      username: saved.displayUsername,
      clan: saved.displayClanName,
      regions: uniqueRegions,
      softRegions,
      noteText,
      availabilityStartUtc: availabilityStartUtc?.toISOString() ?? null,
      availabilityEndUtc: availabilityEndUtc?.toISOString() ?? null,
      availabilitySourceOffsetMinutes,
    });
  } catch (error) {
    console.error("Save picks error:", error);

    if (error instanceof Error && error.name === "PrismaClientInitializationError") {
      return res.status(503).json({
        error: "Database is offline right now. Start PostgreSQL and try saving again.",
      });
    }

    return res.status(500).json({
      error: "Failed to save region picks",
    });
  }
});

app.post("/groups/picks/note", async (req: Request, res: Response) => {
  const parsedBody = updateNoteSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid note payload",
      details: parsedBody.error.flatten(),
    });
  }

  if (!prisma) {
    return res.status(503).json({
      error: "Database is offline.",
    });
  }

  const clanKey = parsedBody.data.clan.trim().toLowerCase();
  const usernameKey = parsedBody.data.username.trim().toLowerCase();
  const noteText = parsedBody.data.noteText?.trim() ? parsedBody.data.noteText.trim() : null;
  const availabilityStartUtc = parsedBody.data.availabilityStartUtc
    ? new Date(parsedBody.data.availabilityStartUtc)
    : null;
  const availabilityEndUtc = parsedBody.data.availabilityEndUtc
    ? new Date(parsedBody.data.availabilityEndUtc)
    : null;
  const availabilitySourceOffsetMinutes =
    parsedBody.data.availabilitySourceOffsetMinutes ?? null;

  try {
    const updated = await prisma.regionSelection.update({
      where: {
        clanName_username: {
          clanName: clanKey,
          username: usernameKey,
        },
      },
      data: {
        noteText,
        availabilityStartUtc,
        availabilityEndUtc,
        availabilitySourceOffsetMinutes,
      },
      select: {
        displayClanName: true,
        displayUsername: true,
        noteText: true,
      },
    });

    return res.status(200).json({
      updated: true,
      clan: updated.displayClanName,
      username: updated.displayUsername,
      noteText: updated.noteText,
      availabilityStartUtc: availabilityStartUtc?.toISOString() ?? null,
      availabilityEndUtc: availabilityEndUtc?.toISOString() ?? null,
      availabilitySourceOffsetMinutes,
    });
  } catch (error) {
    console.error("Update note error:", error);
    return res.status(500).json({
      error: "Failed to update note",
    });
  }
});

app.post("/players/refresh-points", async (req: Request, res: Response) => {
  const parsedBody = refreshPlayerPointsSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({ error: "Invalid payload", details: parsedBody.error.flatten() });
  }

  const { username, clan } = parsedBody.data;
  const usernameKey = username.trim().toLowerCase();
  const clanKey = clan.trim().toLowerCase();

  let points = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WOMClient } = require("@wise-old-man/utils") as { WOMClient: new (opts: { baseAPIUrl: string }) => { players: { getPlayerDetails: (name: string) => Promise<unknown> } } };
    const client = new WOMClient({ baseAPIUrl: "https://api.wiseoldman.net/league" });
    const playerDetails = await client.players.getPlayerDetails(usernameKey) as Record<string, unknown>;
    const latestSnapshot = playerDetails?.latestSnapshot as Record<string, unknown> | undefined;
    const data = latestSnapshot?.data as Record<string, unknown> | undefined;
    const skills = data?.skills as Record<string, unknown> | undefined;
    const overall = skills?.overall as Record<string, unknown> | undefined;
    const exp = overall?.experience;
    if (typeof exp === "number") {
      points = exp;
    }
  } catch {
    // Endpoint not live yet — fall back to 0
    points = 0;
  }

  if (prisma) {
    try {
      await prisma.regionSelection.updateMany({
        where: { clanName: clanKey, username: usernameKey },
        data: { points },
      });
    } catch {
      // DB write failed — still return value
    }
  }

  return res.status(200).json({ points });
});

app.post("/groups/picks/points", async (req: Request, res: Response) => {
  const parsedBody = updatePointsSchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid points payload",
      details: parsedBody.error.flatten(),
    });
  }

  if (!prisma) {
    return res.status(503).json({ error: "Database is offline." });
  }

  const { clan, updates } = parsedBody.data;
  const clanKey = clan.trim().toLowerCase();

  try {
    await prisma.$transaction(
      updates.map(({ username, points }) =>
        prisma!.regionSelection.updateMany({
          where: { clanName: clanKey, username: username.trim().toLowerCase() },
          data: { points },
        }),
      ),
    );

    return res.status(200).json({ updated: true, count: updates.length });
  } catch (error) {
    console.error("Update points error:", error);
    return res.status(500).json({ error: "Failed to update points" });
  }
});

app.get("/groups/picks", async (req: Request, res: Response) => {
  const parsedQuery = groupPicksQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid query params",
      details: parsedQuery.error.flatten(),
    });
  }

  const { name } = parsedQuery.data;
  const clanKey = name.trim().toLowerCase();

  try {
    const detailsBody = await getGroupDetailsByName(name);

    // Fetch selections from database if available
    let selections: StoredRegionSelection[] = [];
    if (prisma) {
      selections = (await prisma.regionSelection.findMany({
        where: {
          clanName: clanKey,
        },
        select: {
          username: true,
          regions: true,
          softRegions: true,
          noteText: true,
          availabilityStartUtc: true,
          availabilityEndUtc: true,
          availabilitySourceOffsetMinutes: true,
          points: true,
        },
      })) as StoredRegionSelection[];
    }

    const selectionsByUsername = new Map(
      selections.map((selection) => [selection.username.toLowerCase(), selection]),
    );

    const members = (detailsBody.memberships ?? []).map((membership) => {
      const usernameKey = membership.player.username.toLowerCase();
      const selection = selectionsByUsername.get(usernameKey);
      const rawRegions = selection?.regions;
      const parsedRegions = Array.isArray(rawRegions)
        ? rawRegions.filter((region: unknown): region is string => typeof region === "string")
        : null;
      const rawSoftRegions = selection?.softRegions;
      const parsedSoftRegions = Array.isArray(rawSoftRegions)
        ? rawSoftRegions.filter((region: unknown): region is string => typeof region === "string")
        : [];

      return {
        username: membership.player.username,
        displayName: membership.player.displayName,
        role: membership.role,
        registered: Boolean(selection),
        regions: parsedRegions,
        softRegions: parsedSoftRegions,
        noteText: selection?.noteText ?? null,
        availabilityStartUtc: selection?.availabilityStartUtc?.toISOString() ?? null,
        availabilityEndUtc: selection?.availabilityEndUtc?.toISOString() ?? null,
        availabilitySourceOffsetMinutes: selection?.availabilitySourceOffsetMinutes ?? null,
        points: selection?.points ?? 0,
      };
    });

    return res.status(200).json({
      group: {
        id: detailsBody.id,
        name: detailsBody.name,
        clanChat: detailsBody.clanChat,
        memberCount: detailsBody.memberCount,
      },
      members,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return res.status(404).json({ error: "Group not found", query: name });
    }

    console.error("WOM group picks error:", error);
    return res.status(502).json({
      error: "Could not build clan picks overview",
    });
  }
});

app.post("/ingest", async (req: Request, res: Response) => {
  const parsed = incomingPayloadSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;

  let queueAccepted = false;
  try {
    await enqueueClanSync({
      id: payload.id,
      source: payload.source,
      timestamp: payload.timestamp ?? null,
    });
    queueAccepted = true;
  } catch (error) {
    console.error("Queue enqueue error:", error);
  }

  return res.status(202).json({
    accepted: true,
    queueAccepted,
    received: {
      id: payload.id,
      source: payload.source,
      timestamp: payload.timestamp ?? null,
      dataType: typeof payload.data,
    },
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Internal server error" });
});
