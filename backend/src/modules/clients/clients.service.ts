/**
 * Servicio del módulo clients (admin).
 * Lógica de negocio para listado y detalle de clientes.
 */

import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import { createNotification } from "../notifications/notifications.service";

export interface ListClientsFilters {
  category?: string;
  admitted?: boolean;
}

/** Lista clientes con filtros opcionales. Solo ADMIN. */
export async function listClients(filters: ListClientsFilters) {
  return prisma.client.findMany({
    where: {
      ...(filters.category !== undefined ? { category: filters.category } : {}),
      ...(filters.admitted !== undefined ? { admitted: filters.admitted } : {}),
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      document: true,
      firstName: true,
      lastName: true,
      email: true,
      photoUrl: true,
      admitted: true,
      category: true,
      blocked: true,
      active: true,
      countryId: true,
      verifierId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// ── maybeUpgradeCategory ──────────────────────────────────────────────────────

/**
 * Heurística MVP de mejora de categoría (idempotente, NUNCA degrada).
 *
 * Consigna: "la diversidad de los medios de pago del usuario y su actividad
 * en las subastas permiten mejorar su categoría."
 *
 * Orden de categorías: common → special → silver → gold → platinum
 *
 * Puntuación (0..4):
 *  +1  si el cliente tiene ≥2 tipos distintos de PaymentMethod con status='verified'
 *  +1  si asistió a ≥2 subastas (filas en Attendee)
 *  +1  si ganó al menos 1 subasta (SaleRecord con este clientId)
 *  +1  si ganó ≥3 subastas (acumulación por fidelidad)
 *
 * newIdx = Math.max(currentIdx, score)  → solo sube, nunca baja.
 * Si el índice resultante es mayor al actual, se actualiza la categoría
 * y se emite una notificación.
 *
 * Envuelto en try/catch para ser llamado de forma best-effort desde otros servicios.
 */
export async function maybeUpgradeCategory(clientId: number | null | undefined): Promise<void> {
  if (clientId == null) return;

  try {
    const CATEGORY_ORDER = ["common", "special", "silver", "gold", "platinum"] as const;

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, category: true },
    });

    if (!client) return;

    // Contar tipos distintos de medios verificados
    const verifiedMethods = await prisma.paymentMethod.findMany({
      where: { clientId, status: "verified" },
      select: { type: true },
    });
    const verifiedTypes = new Set(verifiedMethods.map((m) => m.type)).size;

    // Contar asistencias a subastas
    const attended = await prisma.attendee.count({ where: { clientId } });

    // Contar subastas ganadas
    const won = await prisma.saleRecord.count({ where: { clientId } });

    // Calcular score
    const score =
      (verifiedTypes >= 2 ? 1 : 0) +
      (attended >= 2 ? 1 : 0) +
      (won >= 1 ? 1 : 0) +
      (won >= 3 ? 1 : 0);

    const currentCategory = client.category ?? "common";
    const currentIdx = CATEGORY_ORDER.indexOf(currentCategory as typeof CATEGORY_ORDER[number]);
    const effectiveCurrentIdx = currentIdx === -1 ? 0 : currentIdx;
    const newIdx = Math.min(Math.max(effectiveCurrentIdx, score), CATEGORY_ORDER.length - 1);

    if (newIdx > effectiveCurrentIdx) {
      const newCategory = CATEGORY_ORDER[newIdx];

      await prisma.client.update({
        where: { id: clientId },
        data: { category: newCategory },
      });

      await createNotification(
        clientId,
        "info",
        "Categoría mejorada",
        `Tu categoría ahora es ${newCategory} por tu actividad y medios de pago.`,
        { category: newCategory }
      );
    }
  } catch {
    // Best-effort: no propagamos el error para no afectar el flujo principal
  }
}

// ── getClientDetail ───────────────────────────────────────────────────────────

/** Obtiene un cliente con su país y métodos de pago. */
export async function getClientDetail(clientId: number) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      country: true,
      paymentMethods: true,
    },
  });

  if (!client) {
    throw notFound("Cliente");
  }

  // Excluir passwordHash de la respuesta
  const { passwordHash: _pw, idCardFrontUrl: _front, idCardBackUrl: _back, ...safeClient } = client;

  return safeClient;
}
