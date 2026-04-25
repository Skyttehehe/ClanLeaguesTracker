import { z } from "zod";

export const incomingPayloadSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }).optional(),
  data: z.unknown(),
});

export type IncomingPayload = z.infer<typeof incomingPayloadSchema>;

export const playerSearchQuerySchema = z.object({
  username: z.string().trim().min(1).max(12),
});

export type PlayerSearchQuery = z.infer<typeof playerSearchQuerySchema>;

export const groupMembersQuerySchema = z.object({
  name: z.string().trim().min(1).default("obsidian"),
});

export type GroupMembersQuery = z.infer<typeof groupMembersQuerySchema>;

const lockedRegionIds = ["karamja", "varlamore"] as const;

export const saveRegionPicksSchema = z
  .object({
    clan: z.string().trim().min(1),
    username: z.string().trim().min(1).max(12),
    regions: z.array(z.string().trim().min(1)).min(2).max(5),
    softRegions: z.array(z.string().trim().min(1)).optional().default([]),
    noteText: z.string().trim().max(300).optional(),
    availabilityStartUtc: z.string().datetime({ offset: true }).optional(),
    availabilityEndUtc: z.string().datetime({ offset: true }).optional(),
    availabilitySourceOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  })
  .refine(
    (value) => value.regions.map((region) => region.toLowerCase()).includes(lockedRegionIds[0]),
    { message: "Karamja must always be selected", path: ["regions"] },
  )
  .refine(
    (value) => value.regions.map((region) => region.toLowerCase()).includes(lockedRegionIds[1]),
    { message: "Varlamore must always be selected", path: ["regions"] },
  )
  .refine(
    (value) => {
      const lockedIds: string[] = [...lockedRegionIds];
      return value.softRegions.every((r) => !lockedIds.includes(r.toLowerCase()));
    },
    { message: "Locked regions cannot be soft picks", path: ["softRegions"] },
  )
  .refine(
    (value) => value.softRegions.every((r) => value.regions.map((reg) => reg.toLowerCase()).includes(r.toLowerCase())),
    { message: "Soft regions must be a subset of selected regions", path: ["softRegions"] },
  )
  .refine(
    (value) => {
      const hasStart = Boolean(value.availabilityStartUtc);
      const hasEnd = Boolean(value.availabilityEndUtc);
      return hasStart === hasEnd;
    },
    {
      message: "Both availability start and end time must be provided",
      path: ["availabilityStartUtc"],
    },
  )
  .refine(
    (value) => {
      if (!value.availabilityStartUtc || !value.availabilityEndUtc) {
        return true;
      }
      return new Date(value.availabilityEndUtc).getTime() > new Date(value.availabilityStartUtc).getTime();
    },
    {
      message: "Availability end time must be after start time",
      path: ["availabilityEndUtc"],
    },
  )
  .refine(
    (value) => {
      const hasWindow = Boolean(value.availabilityStartUtc && value.availabilityEndUtc);
      if (!hasWindow) {
        return true;
      }
      return typeof value.availabilitySourceOffsetMinutes === "number";
    },
    {
      message: "Source timezone offset is required when availability is set",
      path: ["availabilitySourceOffsetMinutes"],
    },
  );

export const groupPicksQuerySchema = z.object({
  name: z.string().trim().min(1).default("obsidian"),
});

export const updateNoteSchema = z
  .object({
    clan: z.string().trim().min(1),
    username: z.string().trim().min(1).max(12),
    noteText: z.string().trim().min(1).max(300),
    availabilityStartUtc: z.string().datetime({ offset: true }).optional(),
    availabilityEndUtc: z.string().datetime({ offset: true }).nullish(),
    availabilitySourceOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  });

export type SaveRegionPicksInput = z.infer<typeof saveRegionPicksSchema>;
export type GroupPicksQuery = z.infer<typeof groupPicksQuerySchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const updatePointsSchema = z.object({
  clan: z.string().trim().min(1),
  updates: z.array(
    z.object({
      username: z.string().trim().min(1).max(12),
      points: z.number().int().min(0),
    }),
  ).min(1),
});

export type UpdatePointsInput = z.infer<typeof updatePointsSchema>;

export const refreshPlayerPointsSchema = z.object({
  username: z.string().trim().min(1).max(12),
  clan: z.string().trim().min(1),
});

export type RefreshPlayerPointsInput = z.infer<typeof refreshPlayerPointsSchema>;
