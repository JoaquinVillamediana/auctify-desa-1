import { prisma } from "../../lib/prisma";
import { notFound } from "../../lib/errors";
import type { JwtPayload } from "../../lib/jwt";

export async function getItems(
  filters: {
    catalogId?: number;
    auctionId?: number;
    auctioned?: boolean;
  },
  auth?: JwtPayload
) {
  let catalogId = filters.catalogId;

  // Si se pasa auctionId, resolver el catalogId internamente
  if (!catalogId && filters.auctionId) {
    const catalog = await prisma.catalog.findUnique({
      where: { auctionId: filters.auctionId },
    });
    catalogId = catalog?.id;
  }

  const where: Record<string, unknown> = {};
  if (catalogId) where.catalogId = catalogId;
  if (filters.auctioned !== undefined) where.auctioned = filters.auctioned;

  const items = await prisma.catalogItem.findMany({
    where,
    include: {
      product: { include: { photos: true } },
    },
    orderBy: { lotNumber: "asc" },
  });

  const isAuthed = !!auth;

  return items.map((item) => ({
    id: item.id,
    catalogId: item.catalogId,
    lotNumber: item.lotNumber,
    productId: item.productId,
    catalogDescription: item.product.catalogDescription,
    basePrice: isAuthed ? item.basePrice : null,
    commission: item.commission,
    status: item.status,
    auctioned: item.auctioned,
    photo: item.product.photos[0]?.photoUrl ?? null,
  }));
}

export async function getItemById(id: number, auth?: JwtPayload) {
  const item = await prisma.catalogItem.findUnique({
    where: { id },
    include: {
      product: { include: { photos: true } },
      bids: {
        orderBy: { amount: "desc" },
        take: 1,
      },
    },
  });

  if (!item) throw notFound("Ítem");

  const isAuthed = !!auth;
  const bestBid = item.bids[0]?.amount ?? null;

  // Cálculo simple de rango de puja
  const base = bestBid ?? item.basePrice;
  const minBidAllowed = isAuthed ? base + 1000 : null;
  const maxBidAllowed = null; // sin límite superior (definido por F05)

  return {
    id: item.id,
    catalogId: item.catalogId,
    lotNumber: item.lotNumber,
    productId: item.productId,
    basePrice: isAuthed ? item.basePrice : null,
    commission: item.commission,
    status: item.status,
    auctioned: item.auctioned,
    bestBid,
    minBidAllowed,
    maxBidAllowed,
    product: {
      id: item.product.id,
      fullDescription: item.product.fullDescription,
      catalogDescription: item.product.catalogDescription,
      pieceCount: item.product.pieceCount,
      artist: item.product.artist,
      historicalDate: item.product.historicalDate,
      history: item.product.history,
      photos: item.product.photos.map((p) => p.photoUrl),
    },
  };
}

export async function createItem(data: {
  catalogId: number;
  productId: number;
  lotNumber: number;
  basePrice: number;
  commission: number;
  status?: string;
}) {
  return prisma.catalogItem.create({
    data: {
      catalogId: data.catalogId,
      productId: data.productId,
      lotNumber: data.lotNumber,
      basePrice: data.basePrice,
      commission: data.commission,
      status: data.status ?? "pending",
      auctioned: false,
    },
  });
}

export async function updateItem(
  id: number,
  data: {
    lotNumber?: number;
    basePrice?: number;
    commission?: number;
    status?: string;
    auctioned?: boolean;
    insurancePolicy?: string | null;
  }
) {
  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) throw notFound("Ítem");

  return prisma.catalogItem.update({
    where: { id },
    data: {
      ...(data.lotNumber !== undefined && { lotNumber: data.lotNumber }),
      ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
      ...(data.commission !== undefined && { commission: data.commission }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.auctioned !== undefined && { auctioned: data.auctioned }),
      ...(data.insurancePolicy !== undefined && { insurancePolicy: data.insurancePolicy }),
    },
  });
}
