import { prisma } from "../../lib/prisma";
import { notFound, forbidden, AppError, ErrorCode } from "../../lib/errors";
import type { JwtPayload } from "../../lib/jwt";

const CATEGORY_ORDER = ["common", "special", "silver", "gold", "platinum"];

function categoryLevel(cat: string): number {
  return CATEGORY_ORDER.indexOf(cat);
}

export async function getAuctions(
  filters: {
    status?: string;
    category?: string;
    currency?: string;
    date?: string;
    accessibleForClient?: boolean;
  },
  auth?: JwtPayload
) {
  const where: Record<string, unknown> = {};

  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.currency) where.currency = filters.currency;

  if (filters.date) {
    const start = new Date(filters.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.startsAt = { gte: start, lt: end };
  }

  if (filters.accessibleForClient && auth) {
    const client = await prisma.client.findUnique({ where: { id: auth.sub } });
    if (client?.category) {
      const level = categoryLevel(client.category);
      where.category = { in: CATEGORY_ORDER.slice(0, level + 1) };
    }
  }

  const auctions = await prisma.auction.findMany({
    where,
    include: {
      catalog: {
        include: { _count: { select: { items: true } } },
      },
      _count: { select: { attendees: true } },
    },
    orderBy: { startsAt: "desc" },
  });

  return auctions.map((a) => ({
    id: a.id,
    startsAt: a.startsAt,
    status: a.status,
    currency: a.currency,
    category: a.category,
    location: a.location,
    attendeeCapacity: a.attendeeCapacity,
    hasWarehouse: a.hasWarehouse,
    ownSecurity: a.ownSecurity,
    isCollection: a.isCollection,
    collectionName: a.collectionName,
    itemCount: a.catalog?._count.items ?? 0,
    attendeeCount: a._count.attendees,
  }));
}

export async function getAuctionById(id: number, auth?: JwtPayload) {
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      catalog: {
        include: { _count: { select: { items: true } } },
      },
      _count: { select: { attendees: true } },
    },
  });

  if (!auction) throw notFound("Subasta");

  return {
    id: auction.id,
    startsAt: auction.startsAt,
    status: auction.status,
    currency: auction.currency,
    category: auction.category,
    location: auction.location,
    auctioneerId: auction.auctioneerId,
    attendeeCapacity: auction.attendeeCapacity,
    hasWarehouse: auction.hasWarehouse,
    ownSecurity: auction.ownSecurity,
    isCollection: auction.isCollection,
    collectionName: auction.collectionName,
    catalogId: auction.catalog?.id ?? null,
    itemCount: auction.catalog?._count.items ?? 0,
    attendeeCount: auction._count.attendees,
    streamingUrl: auth ? auction.streamingUrl : null,
  };
}

export async function createAuction(data: {
  startsAt: string;
  status?: string;
  currency: string;
  category: string;
  auctioneerId?: number;
  location?: string;
  attendeeCapacity?: number;
  hasWarehouse?: boolean;
  ownSecurity?: boolean;
  isCollection?: boolean;
  collectionName?: string;
  streamingUrl?: string;
}) {
  return prisma.auction.create({
    data: {
      startsAt: new Date(data.startsAt),
      status: data.status ?? "scheduled",
      currency: data.currency,
      category: data.category,
      auctioneerId: data.auctioneerId ?? null,
      location: data.location ?? null,
      attendeeCapacity: data.attendeeCapacity ?? null,
      hasWarehouse: data.hasWarehouse ?? false,
      ownSecurity: data.ownSecurity ?? false,
      isCollection: data.isCollection ?? false,
      collectionName: data.collectionName ?? null,
      streamingUrl: data.streamingUrl ?? null,
    },
  });
}

export async function updateAuction(
  id: number,
  data: {
    startsAt?: string;
    status?: string;
    currency?: string;
    category?: string;
    auctioneerId?: number | null;
    location?: string | null;
    attendeeCapacity?: number | null;
    hasWarehouse?: boolean;
    ownSecurity?: boolean;
    isCollection?: boolean;
    collectionName?: string | null;
    streamingUrl?: string | null;
  }
) {
  const existing = await prisma.auction.findUnique({ where: { id } });
  if (!existing) throw notFound("Subasta");

  return prisma.auction.update({
    where: { id },
    data: {
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.auctioneerId !== undefined && { auctioneerId: data.auctioneerId }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.attendeeCapacity !== undefined && { attendeeCapacity: data.attendeeCapacity }),
      ...(data.hasWarehouse !== undefined && { hasWarehouse: data.hasWarehouse }),
      ...(data.ownSecurity !== undefined && { ownSecurity: data.ownSecurity }),
      ...(data.isCollection !== undefined && { isCollection: data.isCollection }),
      ...(data.collectionName !== undefined && { collectionName: data.collectionName }),
      ...(data.streamingUrl !== undefined && { streamingUrl: data.streamingUrl }),
    },
  });
}

export async function getAuctionCatalog(auctionId: number, auth?: JwtPayload) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      catalog: {
        include: {
          items: {
            include: {
              product: { include: { photos: true } },
            },
            orderBy: { lotNumber: "asc" },
          },
        },
      },
    },
  });

  if (!auction) throw notFound("Subasta");
  if (!auction.catalog) throw notFound("Catálogo");

  const isAuthed = !!auth;

  return {
    catalogId: auction.catalog.id,
    description: auction.catalog.description,
    auctionId: auction.id,
    items: auction.catalog.items.map((item) => ({
      id: item.id,
      lotNumber: item.lotNumber,
      catalogDescription: item.product.catalogDescription,
      basePrice: isAuthed ? item.basePrice : null,
      commission: item.commission,
      status: item.status,
      auctioned: item.auctioned,
      photo: item.product.photos[0]?.photoUrl ?? null,
    })),
  };
}

export async function getStreamingUrl(auctionId: number, auth: JwtPayload) {
  const client = await prisma.client.findUnique({ where: { id: auth.sub } });
  if (!client) throw notFound("Cliente");

  if (!client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está admitida");
  }

  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  const clientLevel = categoryLevel(client.category ?? "");
  const auctionLevel = categoryLevel(auction.category);

  if (clientLevel < auctionLevel) {
    throw new AppError(
      ErrorCode.CATEGORY_INSUFFICIENT,
      403,
      "Tu categoría no es suficiente para acceder al streaming de esta subasta"
    );
  }

  if (!auction.streamingUrl) {
    throw notFound("URL de streaming");
  }

  return { url: auction.streamingUrl, expiresAt: null };
}
