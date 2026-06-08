import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import * as insuranceController from "../insurance/insurance.controller";

const router = Router();

const CURRENCIES = ["ARS", "USD"] as const;

const createPayoutSchema = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  body: z.object({
    bank: z.string().min(1),
    currency: z.enum(CURRENCIES),
    cbuOrIban: z.string().min(1),
    accountHolder: z.string().min(1),
    countryId: z.number().int().optional(),
  }),
});

const idParam = z.object({
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
});

/** GET /owners/:id/payout-accounts — cuentas de cobro declaradas */
router.get("/:id/payout-accounts", requireAuth, validate(idParam), insuranceController.getPayoutAccounts);

/** POST /owners/:id/payout-accounts — declarar nueva cuenta de cobro */
router.post(
  "/:id/payout-accounts",
  requireAuth,
  validate(createPayoutSchema),
  insuranceController.createPayoutAccount
);

export default router;
