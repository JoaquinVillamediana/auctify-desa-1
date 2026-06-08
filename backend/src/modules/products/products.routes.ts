import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import * as insuranceController from "../insurance/insurance.controller";

const router = Router();

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

/** GET /products/:id/location — ubicación del producto en depósito */
router.get("/:id/location", requireAuth, validate(idParam), insuranceController.getProductLocation);

export default router;
