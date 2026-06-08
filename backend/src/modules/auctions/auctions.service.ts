/**
 * Servicio de subastas, catálogo y sesiones en vivo.
 * Ver docs/features/F03-auctions.md, F04-auction-session-live.md y F05-bidding.md
 *
 * Exporta computeRange() para reutilizarlo en items/bids.
 */

import { prisma } from "../../lib/prisma";
import { AppError, ErrorCode, notFound } from "../../lib/errors";

// ── Constantes de categoría ─────────────────────────────────────────────────

const CATEGORY_ORDER = ["common", "special", "silver", "gold", "platinum"] as const;
type Category = (typeof CATEGORY_ORDER)[number];

const EXEMPT_CATEGORIES: string[] = ["gold", "platinum"];

// ── Helper de rango de puja ─────────────────────────────────────────────────

export interface BidRange {
  minBidAllowed: number | null;
  maxBidAllowed: number | null;
}

/**
 * Calcula el rango [min, max] permitido para la próxima puja.
 *
 * Reglas (F05):
 *   - base = item.basePrice
 *   - Primera puja: minBidAllowed = base
 *   - Con pujas previas: minBidAllowed = bestBid + 0.01 * base
 *   - maxBidAllowed = lastBidAmount + 0.20 * base (solo si hay lastBid; else null)
 *   - Si auction.category ∈ {gold, platinum} → min/max = null (sin límites)
 */
export function computeRange(
  item: { basePrice: number },
  auctionCategory: string,
  bestBid: number | null,
  lastBidAmount: number | null
): BidRange {
  if (EXEMPT_CATEGORIES.includes(auctionCategory)) {
    return { minBidAllowed: null, maxBidAllowed: null };
  }

  const base = item.basePrice;

  const minBidAllowed =
    bestBid !== null
      ? bestBid + 0.01 * base
      : base;

  const maxBidAllowed =
    lastBidAmount !== null
      ? lastBidAmount + 0.2 * base
      : null;

  return { minBidAllowed, maxBidAllowed };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isCategorySufficient(
  auctionCategory: string,
  clientCategory: string | null
): boolean {
  const aIdx = CATEGORY_ORDER.indexOf(auctionCategory as Category);
  const cIdx = CATEGORY_ORDER.indexOf(clientCategory as Category);
  if (aIdx === -1 || cIdx === -1) return false;
  return aIdx <= cIdx;
}

function mapAuction(a: {
  id: number;
  startsAt: Date;
  status: string;
  currency: string;
  category: string;
  auctioneerId: number | null;
  location: string | null;
  attendeeCapacity: number | null;
  hasWarehouse: boolean;
  ownSecurity: boolean;
  streamingUrl: string | null;
  isCollection: boolean;
  collectionName: string | null;
}) {
  return {
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    status: a.status,
    currency: a.currency,
    category: a.category,
    auctioneerId: a.auctioneerId,
    location: a.location,
    attendeeCapacity: a.attendeeCapacity,
    hasWarehouse: a.hasWarehouse,
    ownSecurity: a.ownSecurity,
    streamingUrl: a.streamingUrl,
    isCollection: a.isCollection,
    collectionName: a.collectionName,
  };
}

// ── GET /auctions ────────────────────────────────────────────────────────────

export interface ListAuctionsFilters {
  status?: string;
  category?: string;
  currency?: string;
  date?: string;
}

export async function listAuctions(filters: ListAuctionsFilters) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.currency) where.currency = filters.currency;
  if (filters.date) {
    const day = new Date(filters.date);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    where.startsAt = { gte: day, lt: nextDay };
  }

  const auctions = await prisma.auction.findMany({ where, orderBy: { startsAt: "asc" } });
  return auctions.map(mapAuction);
}

// ── GET /auctions/:id ────────────────────────────────────────────────────────

export async function getAuctionDetail(auctionId: number) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      catalog: {
        include: { items: { select: { id: true } } },
      },
      attendees: { select: { id: true } },
    },
  });

  if (!auction) throw notFound("Subasta");

  return {
    ...mapAuction(auction),
    catalogId: auction.catalog?.id ?? null,
    itemCount: auction.catalog?.items.length ?? 0,
    attendeeCount: auction.attendees.length,
  };
}

// ── POST /auctions (admin) ────────────────────────────────────────────────────

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

// ── PATCH /auctions/:id (admin) ───────────────────────────────────────────────

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

// ── GET /auctions/:id/catalog ─────────────────────────────────────────────────

export async function getAuctionCatalog(auctionId: number, isAuthenticated: boolean) {
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

  return {
    catalogId: auction.catalog.id,
    description: auction.catalog.description,
    auctionId: auction.id,
    items: auction.catalog.items.map((item) => ({
      id: item.id,
      lotNumber: item.lotNumber,
      catalogDescription: item.product.catalogDescription,
      basePrice: isAuthenticated ? item.basePrice : null,
      commission: item.commission,
      status: item.status,
      auctioned: item.auctioned,
      photo: item.product.photos[0]?.photoUrl ?? null,
    })),
  };
}

// ── GET /auctions/:id/streaming ──────────────────────────────────────────────

export async function getStreamingUrl(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || !client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }

  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 horas
  return {
    url: auction.streamingUrl ?? `https://stream.auctify.example/auction/${auctionId}`,
    expiresAt: expiresAt.toISOString(),
  };
}

// ── POST /auctions/:id/attendees ─────────────────────────────────────────────

export async function registerAttendee(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      paymentMethods: { where: { status: "verified" }, select: { id: true } },
    },
  });
  if (!client) throw notFound("Cliente");

  if (!client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }
  if (client.blocked) {
    throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
  }
  if (!isCategorySufficient(auction.category, client.category)) {
    throw new AppError(
      ErrorCode.CATEGORY_INSUFFICIENT,
      403,
      "Tu categoría no es suficiente para esta subasta"
    );
  }
  if (client.paymentMethods.length === 0) {
    throw new AppError(
      ErrorCode.NO_VERIFIED_PAYMENT_METHOD,
      403,
      "Necesitás al menos un medio de pago verificado"
    );
  }

  const existing = await prisma.attendee.findUnique({
    where: { auctionId_clientId: { auctionId, clientId } },
  });
  if (existing) {
    throw new AppError(ErrorCode.DUPLICATE_ENTRY, 409, "Ya estás registrado en esta subasta");
  }

  const maxBidder = await prisma.attendee.findFirst({
    where: { auctionId },
    orderBy: { bidderNumber: "desc" },
    select: { bidderNumber: true },
  });
  const bidderNumber = (maxBidder?.bidderNumber ?? 0) + 1;

  return prisma.attendee.create({
    data: { auctionId, clientId, bidderNumber },
  });
}

// ── GET /auctions/:id/attendees ──────────────────────────────────────────────

export async function listAttendees(auctionId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  return prisma.attendee.findMany({ where: { auctionId }, orderBy: { bidderNumber: "asc" } });
}

// ── POST /auctions/:id/connect ───────────────────────────────────────────────

export async function connectToAuction(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  if (auction.status !== "open") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 422, "La subasta no está abierta");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      paymentMethods: { where: { status: "verified" }, select: { id: true } },
    },
  });
  if (!client) throw notFound("Cliente");

  if (!client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }
  if (client.blocked) {
    throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
  }
  if (!isCategorySufficient(auction.category, client.category)) {
    throw new AppError(
      ErrorCode.CATEGORY_INSUFFICIENT,
      403,
      "Tu categoría no es suficiente para esta subasta"
    );
  }
  if (client.paymentMethods.length === 0) {
    throw new AppError(
      ErrorCode.NO_VERIFIED_PAYMENT_METHOD,
      403,
      "Necesitás al menos un medio de pago verificado"
    );
  }

  const activeSession = await prisma.auctionSession.findFirst({
    where: { clientId, active: true },
  });
  if (activeSession) {
    if (activeSession.auctionId === auctionId) {
      return activeSession;
    }
    throw new AppError(
      ErrorCode.ALREADY_CONNECTED,
      409,
      "Ya estás conectado a otra subasta. Desconectate primero.",
      { auctionId: activeSession.auctionId }
    );
  }

  let attendee = await prisma.attendee.findUnique({
    where: { auctionId_clientId: { auctionId, clientId } },
  });
  if (!attendee) {
    const maxBidder = await prisma.attendee.findFirst({
      where: { auctionId },
      orderBy: { bidderNumber: "desc" },
      select: { bidderNumber: true },
    });
    const bidderNumber = (maxBidder?.bidderNumber ?? 0) + 1;
    attendee = await prisma.attendee.create({
      data: { auctionId, clientId, bidderNumber },
    });
  }

  return prisma.auctionSession.create({
    data: { auctionId, clientId, startedAt: new Date(), active: true },
  });
}

// ── POST /auctions/:id/disconnect ────────────────────────────────────────────

export async function disconnectFromAuction(auctionId: number, clientId: number) {
  const session = await prisma.auctionSession.findFirst({
    where: { auctionId, clientId, active: true },
  });

  if (!session) throw notFound("Sesión activa");

  return prisma.auctionSession.update({
    where: { id: session.id },
    data: { active: false, endedAt: new Date() },
  });
}

// ── GET /auctions/:id/live-status ────────────────────────────────────────────

export async function getLiveStatus(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      currentItem: {
        include: {
          product: { select: { id: true, catalogDescription: true } },
          bids: {
            orderBy: { amount: "desc" },
            take: 1,
            include: { attendee: { select: { bidderNumber: true } } },
          },
        },
      },
    },
  });

  if (!auction) throw notFound("Subasta");

  const session = await prisma.auctionSession.findFirst({
    where: { auctionId, clientId, active: true },
  });
  if (!session) {
    throw new AppError(ErrorCode.NOT_CONNECTED, 403, "No estás conectado a esta subasta");
  }

  const connectedCount = await prisma.auctionSession.count({
    where: { auctionId, active: true },
  });

  let currentItem = null;
  if (auction.currentItemId && auction.currentItem) {
    const item = auction.currentItem;

    const bestBidRow = await prisma.bid.findFirst({
      where: { itemId: item.id },
      orderBy: { amount: "desc" },
      include: { attendee: { select: { bidderNumber: true } } },
    });

    const lastBidRow = await prisma.bid.findFirst({
      where: { itemId: item.id },
      orderBy: { timestamp: "desc" },
      select: { amount: true },
    });

    const bestBid = bestBidRow?.amount ?? null;
    const lastBidAmount = lastBidRow?.amount ?? null;
    const bidCount = await prisma.bid.count({ where: { itemId: item.id } });

    const { minBidAllowed, maxBidAllowed } = computeRange(
      item,
      auction.category,
      bestBid,
      lastBidAmount
    );

    currentItem = {
      itemId: item.id,
      productId: item.productId,
      catalogDescription: item.product.catalogDescription ?? `Lote #${item.id}`,
      basePrice: item.basePrice,
      bestBid,
      bestBidBidderNumber: bestBidRow?.attendee.bidderNumber ?? null,
      minBidAllowed,
      maxBidAllowed,
      bidCount,
    };
  }

  let youWereOutbid = false;
  if (auction.currentItemId && currentItem) {
    const attendee = await prisma.attendee.findUnique({
      where: { auctionId_clientId: { auctionId, clientId } },
    });

    if (attendee) {
      const clientHasBid = await prisma.bid.findFirst({
        where: { itemId: auction.currentItemId, attendeeId: attendee.id },
      });
      const clientIsWinner = await prisma.bid.findFirst({
        where: { itemId: auction.currentItemId, attendeeId: attendee.id, winner: true },
      });
      youWereOutbid = clientHasBid !== null && clientIsWinner === null;
    }
  }

  const lastEventRow = await prisma.auctionEvent.findFirst({
    where: { auctionId },
    orderBy: { createdAt: "desc" },
  });

  const lastEvent = lastEventRow
    ? {
        type: lastEventRow.type,
        timestamp: lastEventRow.createdAt.toISOString(),
        data: JSON.parse(lastEventRow.data) as Record<string, unknown>,
      }
    : null;

  return {
    version: auction.version,
    auctionId: auction.id,
    auctionStatus: auction.status,
    connectedCount,
    currentItem,
    youWereOutbid,
    lastEvent,
    updatedAt: new Date().toISOString(),
  };
}
