/**
 * Servicio del módulo clients (admin).
 * Lógica de negocio para listado y detalle de clientes.
 */

import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";

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
