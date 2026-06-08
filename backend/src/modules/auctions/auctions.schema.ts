/**
 * Schemas zod de validación del módulo auctions.
 * Ver docs/features/F04-auction-session-live.md
 */

import { z } from "zod";

const AUCTION_STATUSES = ["scheduled", "open", "closed"] as const;
const CATEGORIES = ["common", "special", "silver", "gold", "platinum"] as const;
const CURRENCIES = ["ARS", "USD"] as const;

/** ID numérico en params de ruta. */
const numericId = z
  .string()
  .regex(/^\d+$/, "ID debe ser un número")
  .transform(Number);

/** GET /auctions — filtros opcionales. */
export const listAuctionsSchema = z.object({
  query: z.object({
    status: z.enum(AUCTION_STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    currency: z.enum(CURRENCIES).optional(),
    date: z
      .string()
      .optional()
      .refine((d) => !d || !isNaN(Date.parse(d)), { message: "Fecha inválida" }),
  }),
});

/** Params con :id numérico. */
export const auctionIdSchema = z.object({
  params: z.object({ id: numericId }),
});

/**
 * POST /auctions/:id/attendees
 * Admin puede pasar clientId en el body; si no, se ignora (se usa el del token).
 */
export const registerAttendeeSchema = z.object({
  params: z.object({ id: numericId }),
  body: z.object({
    /** Solo para admin: registrar a otro cliente. */
    clientId: z
      .number({ invalid_type_error: "clientId debe ser un número" })
      .int()
      .positive()
      .optional(),
  }),
});
