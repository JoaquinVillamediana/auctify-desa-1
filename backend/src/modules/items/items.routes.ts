import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth, optionalAuth, requireRole } from "../../middleware/auth";
import * as controller from "./items.controller";

const router = Router();

const createSchema = z.object({
  body: z.object({
    catalogId: z.number().int(),
    productId: z.number().int(),
    lotNumber: z.number().int(),
    basePrice: z.number().positive(),
    commission: z.number().min(0).max(1),
    status: z.string().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    lotNumber: z.number().int().optional(),
    basePrice: z.number().positive().optional(),
    commission: z.number().min(0).max(1).optional(),
    status: z.string().optional(),
    auctioned: z.boolean().optional(),
    insurancePolicy: z.string().nullable().optional(),
  }),
});

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

/** GET /items — lista de ítems con filtros opcionales */
router.get("/", optionalAuth, controller.getItems);

/** GET /items/:id — detalle de ítem con producto y mejor oferta */
router.get("/:id", optionalAuth, validate(idParam), controller.getItemById);

/** POST /items — crear ítem en catálogo (solo ADMIN) */
router.post("/", requireAuth, requireRole("ADMIN"), validate(createSchema), controller.createItem);

/** PATCH /items/:id — actualizar ítem (solo ADMIN) */
router.patch("/:id", requireAuth, requireRole("ADMIN"), validate(updateSchema), controller.updateItem);

export default router;
