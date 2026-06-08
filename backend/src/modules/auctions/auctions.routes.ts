import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth, optionalAuth, requireRole } from "../../middleware/auth";
import * as controller from "./auctions.controller";

const router = Router();

const STATUSES = ["scheduled", "open", "closed"] as const;
const CATEGORIES = ["common", "special", "silver", "gold", "platinum"] as const;
const CURRENCIES = ["ARS", "USD"] as const;

const createSchema = z.object({
  body: z.object({
    startsAt: z.string().min(1),
    status: z.enum(STATUSES).optional(),
    currency: z.enum(CURRENCIES),
    category: z.enum(CATEGORIES),
    auctioneerId: z.number().int().optional(),
    location: z.string().optional(),
    attendeeCapacity: z.number().int().optional(),
    hasWarehouse: z.boolean().optional(),
    ownSecurity: z.boolean().optional(),
    isCollection: z.boolean().optional(),
    collectionName: z.string().optional(),
    streamingUrl: z.string().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    startsAt: z.string().optional(),
    status: z.enum(STATUSES).optional(),
    currency: z.enum(CURRENCIES).optional(),
    category: z.enum(CATEGORIES).optional(),
    auctioneerId: z.number().int().nullable().optional(),
    location: z.string().nullable().optional(),
    attendeeCapacity: z.number().int().nullable().optional(),
    hasWarehouse: z.boolean().optional(),
    ownSecurity: z.boolean().optional(),
    isCollection: z.boolean().optional(),
    collectionName: z.string().nullable().optional(),
    streamingUrl: z.string().nullable().optional(),
  }),
});

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

/** GET /auctions — lista con filtros opcionales */
router.get("/", optionalAuth, controller.getAuctions);

/** GET /auctions/:id — detalle de subasta */
router.get("/:id", optionalAuth, validate(idParam), controller.getAuctionById);

/** POST /auctions — crear subasta (solo ADMIN) */
router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), controller.createAuction);

/** PATCH /auctions/:id — actualizar subasta (solo ADMIN) */
router.patch("/:id", requireAuth, requireRole("ADMIN"), validate(updateSchema), controller.updateAuction);

/** GET /auctions/:id/catalog — catálogo con ítems */
router.get("/:id/catalog", optionalAuth, validate(idParam), controller.getAuctionCatalog);

/** GET /auctions/:id/streaming — URL de streaming (requiere admitido + categoría) */
router.get("/:id/streaming", requireAuth, validate(idParam), controller.getStreamingUrl);

export default router;
