/**
 * Servicio del módulo products.
 * Ver docs/features/F06-inclusion-requests.md
 */

import { prisma } from "../../lib/prisma";
import { notFound, forbidden } from "../../lib/errors";

export interface CreateProductInput {
  ownerId: number;
  fullDescription: string;
  catalogDescription?: string;
  date?: string;
  pieceCount?: number;
  artist?: string;
  historicalDate?: string;
  history?: string;
}

/** Crea un producto en estado draft (available: false). */
export async function createProduct(input: CreateProductInput) {
  return prisma.product.create({
    data: {
      ownerId: input.ownerId,
      fullDescription: input.fullDescription,
      catalogDescription: input.catalogDescription ?? null,
      date: input.date ? new Date(input.date) : null,
      pieceCount: input.pieceCount ?? 1,
      artist: input.artist ?? null,
      historicalDate: input.historicalDate ?? null,
      history: input.history ?? null,
      available: false,
    },
    include: { photos: true },
  });
}

/** Agrega una foto a un producto. Valida que el producto sea del dueño. */
export async function addPhoto(
  productId: number,
  ownerId: number,
  photoUrl: string
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, ownerId: true },
  });

  if (!product) throw notFound("Producto");
  if (product.ownerId !== ownerId) throw forbidden("No sos el dueño de este producto");

  return prisma.photo.create({
    data: { productId, photoUrl },
  });
}

/** Lista productos. OWNER solo ve los suyos; ADMIN puede ver todos o filtrar por ownerId. */
export async function listProducts(filters: {
  ownerId?: number;
  available?: boolean;
}) {
  return prisma.product.findMany({
    where: {
      ...(filters.ownerId !== undefined ? { ownerId: filters.ownerId } : {}),
      ...(filters.available !== undefined ? { available: filters.available } : {}),
    },
    include: { photos: { take: 1 } },
    orderBy: { id: "desc" },
  });
}

/** Obtiene un producto con sus fotos. Valida que sea del dueño (o admin). */
export async function getProduct(productId: number, ownerId: number, isAdmin: boolean) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { photos: true },
  });

  if (!product) throw notFound("Producto");
  if (!isAdmin && product.ownerId !== ownerId) throw forbidden("No sos el dueño de este producto");

  return product;
}
