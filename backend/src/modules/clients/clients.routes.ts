/**
 * Rutas del módulo clients (admin).
 * Base path: /v1/clients (montado en routes/index.ts)
 *
 * Implementado aquí solo lo mínimo para desbloquear el flujo F01:
 *   PATCH /clients/:id — admitir cliente + asignar categoría + generar ActivationToken
 *
 * Para implementación completa ver docs/features/F03-clients.md (pendiente)
 *
 * TODO F03: GET /clients (listar), GET /clients/:id, baja lógica, métricas
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, validationError } from "../../lib/errors";
import { createActivationToken } from "../auth/auth.service";
import { env } from "../../config/env";

const router = Router();

// Categorías válidas — ver docs/02-data-model.md §1
const CATEGORIES = ["common", "special", "silver", "gold", "platinum"] as const;

const admitClientSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, "ID debe ser un número").transform(Number),
  }),
  body: z.object({
    admitted: z.boolean().optional(),
    category: z.enum(CATEGORIES).optional(),
    blocked: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

/**
 * PATCH /clients/:id
 * Uso principal: admitir cliente y asignar categoría.
 * Solo ADMIN.
 *
 * Al admitir (admitted=true), genera un ActivationToken.
 * En desarrollo, el token se devuelve en la respuesta para facilitar las pruebas.
 * En producción se enviaría por email (TODO: integrar servicio de mail).
 *
 * @example
 *   PATCH /v1/clients/5
 *   { "admitted": true, "category": "silver" }
 *   → 200 { client, activationToken: "act_..." }  // token devuelto solo en dev
 */
router.patch(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate(admitClientSchema),
  async (req, res, next) => {
    try {
      const clientId = req.params.id as unknown as number;
      const { admitted, category, blocked, active } = req.body;

      const existing = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!existing) {
        return next(notFound("Cliente"));
      }

      // Validar: si se admite, la categoría es obligatoria
      if (admitted === true && !category && !existing.category) {
        return next(
          validationError("Al admitir se debe asignar una categoría", {
            category: "Requerida al admitir",
          })
        );
      }

      const updatedClient = await prisma.client.update({
        where: { id: clientId },
        data: {
          ...(admitted !== undefined && { admitted }),
          ...(category !== undefined && { category }),
          ...(blocked !== undefined && { blocked }),
          ...(active !== undefined && { active }),
        },
      });

      // Generar ActivationToken si se acaba de admitir
      let activationToken: string | undefined;

      const wasJustAdmitted = admitted === true && !existing.admitted;

      if (wasJustAdmitted) {
        activationToken = await createActivationToken(clientId);
        console.log(
          `[clients] ActivationToken generado para clientId=${clientId}: ${activationToken}`
        );
      }

      const response: Record<string, unknown> = {
        client: {
          id: updatedClient.id,
          document: updatedClient.document,
          firstName: updatedClient.firstName,
          lastName: updatedClient.lastName,
          email: updatedClient.email,
          admitted: updatedClient.admitted,
          category: updatedClient.category,
          blocked: updatedClient.blocked,
          active: updatedClient.active,
        },
      };

      // En desarrollo, devolver el token en la respuesta para pruebas
      // En producción se enviaría por email y NO se incluiría aquí
      if (activationToken && env.NODE_ENV !== "production") {
        response.activationToken = activationToken;
        response._dev_note =
          "activationToken solo visible en development/test. En producción se envía por mail.";
      }

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
