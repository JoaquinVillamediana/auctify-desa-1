/**
 * Servicio de subastas y sesiones en vivo.
 * Ver docs/features/F04-auction-session-live.md y docs/features/F05-bidding.md
 *
 * Exporta computeRange() para reutilizarlo en items/bids.
 */

import { prisma } from "../../lib/prisma";
import { AppError, ErrorCode, notFound } from "../../lib/errors";

// ── Constantes de categoría ─────────────────────────────────────────────────

/**
 * Orden de categorías (de menor a mayor).
 * auction.category <= client.category equivale a índice menor o igual.
 */
const CATEGORY_ORDER = ["common", "special", "silver", "gold", "platinum"] as const;
type Category = (typeof CATEGORY_ORDER)[number];

/** Categorías exentas de límites de puja (gold y platinum). */
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
 *
 * @param item          - CatalogItem con basePrice
 * @param auctionCategory - Categoría de la subasta
 * @param bestBid       - Mejor puja actual (null si no hay pujas)
 * @param lastBidAmount - Importe de la última puja en tiempo (null si no hay pujas)
 */
export function computeRange(
  item: { basePrice: number },
  auctionCategory: string,
  bestBid: number | null,
  lastBidAmount: number | null
): BidRange {
  // Categorías gold/platinum: sin límites de rango
  if (EXEMPT_CATEGORIES.includes(auctionCategory)) {
    return { minBidAllowed: null, maxBidAllowed: null };
  }

  const base = item.basePrice;

  const minBidAllowed =
    bestBid !== null
      ? bestBid + 0.01 * base       // hay pujas previas: superar en 1% del base
      : base;                         // primera puja: mínimo igual al base

  const maxBidAllowed =
    lastBidAmount !== null
      ? lastBidAmount + 0.2 * base   // máximo: última puja + 20% del base
      : null;                         // sin pujas previas: sin máximo

  return { minBidAllowed, maxBidAllowed };
}

// ── Helpers de mapeo ────────────────────────────────────────────────────────

/**
 * Verifica si la categoría del cliente es suficiente para la subasta.
 * auction.category <= client.category (según CATEGORY_ORDER).
 */
function isCategorySufficient(
  auctionCategory: string,
  clientCategory: string | null
): boolean {
  const aIdx = CATEGORY_ORDER.indexOf(auctionCategory as Category);
  const cIdx = CATEGORY_ORDER.indexOf(clientCategory as Category);
  if (aIdx === -1 || cIdx === -1) return false;
  return aIdx <= cIdx;
}

/** Mapea un Auction de Prisma al shape Auction del OpenAPI. */
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
  date?: string; // ISO date, filtra por día
}

/** Lista todas las subastas con filtros opcionales. */
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

/** Devuelve el detalle de una subasta (AuctionDetail). */
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

// ── GET /auctions/:id/streaming ──────────────────────────────────────────────

/** Devuelve la URL de streaming para clientes admitidos (stub). */
export async function getStreamingUrl(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  // Verificar que el cliente esté admitido
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || !client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }

  // URL stub — en producción integrar con proveedor de streaming
  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 horas
  return {
    url: auction.streamingUrl ?? `https://stream.auctify.example/auction/${auctionId}`,
    expiresAt: expiresAt.toISOString(),
  };
}

// ── POST /auctions/:id/attendees ─────────────────────────────────────────────

/** Registra a un cliente como asistente de una subasta. */
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

  // Validaciones en orden (F04)
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

  // Verificar si ya es asistente (409)
  const existing = await prisma.attendee.findUnique({
    where: { auctionId_clientId: { auctionId, clientId } },
  });
  if (existing) {
    throw new AppError(ErrorCode.DUPLICATE_ENTRY, 409, "Ya estás registrado en esta subasta");
  }

  // Asignar siguiente bidderNumber secuencial dentro de la subasta
  const maxBidder = await prisma.attendee.findFirst({
    where: { auctionId },
    orderBy: { bidderNumber: "desc" },
    select: { bidderNumber: true },
  });
  const bidderNumber = (maxBidder?.bidderNumber ?? 0) + 1;

  const attendee = await prisma.attendee.create({
    data: { auctionId, clientId, bidderNumber },
  });

  return attendee;
}

// ── GET /auctions/:id/attendees ──────────────────────────────────────────────

/** Lista asistentes de una subasta (solo admin). */
export async function listAttendees(auctionId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  return prisma.attendee.findMany({ where: { auctionId }, orderBy: { bidderNumber: "asc" } });
}

// ── POST /auctions/:id/connect ───────────────────────────────────────────────

/** Conecta al cliente a la subasta en vivo. Crea sesión y Attendee si no existe. */
export async function connectToAuction(auctionId: number, clientId: number) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } });
  if (!auction) throw notFound("Subasta");

  // 1. Subasta debe estar abierta
  if (auction.status !== "open") {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      422,
      "La subasta no está abierta"
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      paymentMethods: { where: { status: "verified" }, select: { id: true } },
    },
  });
  if (!client) throw notFound("Cliente");

  // 2. Cliente admitido
  if (!client.admitted) {
    throw new AppError(ErrorCode.NOT_ADMITTED, 403, "Tu cuenta no está verificada aún");
  }
  // 3. No bloqueado
  if (client.blocked) {
    throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
  }
  // 4. Categoría suficiente
  if (!isCategorySufficient(auction.category, client.category)) {
    throw new AppError(
      ErrorCode.CATEGORY_INSUFFICIENT,
      403,
      "Tu categoría no es suficiente para esta subasta"
    );
  }
  // 5. Medio de pago verificado
  if (client.paymentMethods.length === 0) {
    throw new AppError(
      ErrorCode.NO_VERIFIED_PAYMENT_METHOD,
      403,
      "Necesitás al menos un medio de pago verificado"
    );
  }

  // 6. Invariante: solo 1 sesión activa global por cliente
  const activeSession = await prisma.auctionSession.findFirst({
    where: { clientId, active: true },
  });
  if (activeSession) {
    throw new AppError(
      ErrorCode.ALREADY_CONNECTED,
      409,
      "Ya estás conectado a otra subasta. Desconectate primero.",
      { auctionId: activeSession.auctionId }
    );
  }

  // Crear Attendee si no existe (auto-registro al conectar)
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

  // Crear sesión activa
  const session = await prisma.auctionSession.create({
    data: { auctionId, clientId, startedAt: new Date(), active: true },
  });

  return session;
}

// ── POST /auctions/:id/disconnect ────────────────────────────────────────────

/** Desconecta al cliente de la subasta (cierra la sesión activa). */
export async function disconnectFromAuction(auctionId: number, clientId: number) {
  const session = await prisma.auctionSession.findFirst({
    where: { auctionId, clientId, active: true },
  });

  if (!session) {
    throw notFound("Sesión activa");
  }

  return prisma.auctionSession.update({
    where: { id: session.id },
    data: { active: false, endedAt: new Date() },
  });
}

// ── GET /auctions/:id/live-status ────────────────────────────────────────────

/** Construye el AuctionLiveStatus para el cliente conectado. */
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

  // Verificar que el cliente tenga sesión activa en ESTA subasta
  const session = await prisma.auctionSession.findFirst({
    where: { auctionId, clientId, active: true },
  });
  if (!session) {
    throw new AppError(
      ErrorCode.NOT_CONNECTED,
      403,
      "No estás conectado a esta subasta"
    );
  }

  // Cantidad de sesiones activas (connectedCount)
  const connectedCount = await prisma.auctionSession.count({
    where: { auctionId, active: true },
  });

  // Construir currentItem con rango de puja
  let currentItem = null;
  if (auction.currentItemId && auction.currentItem) {
    const item = auction.currentItem;

    // Mejor puja (mayor importe) y última puja (más reciente por timestamp)
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
      catalogDescription:
        item.product.catalogDescription ?? `Lote #${item.id}`,
      basePrice: item.basePrice,
      bestBid,
      bestBidBidderNumber: bestBidRow?.attendee.bidderNumber ?? null,
      minBidAllowed,
      maxBidAllowed,
      bidCount,
    };
  }

  // youWereOutbid: el cliente fue el mejor postor pero fue superado
  let youWereOutbid = false;
  if (auction.currentItemId && currentItem) {
    const attendee = await prisma.attendee.findUnique({
      where: { auctionId_clientId: { auctionId, clientId } },
    });

    if (attendee) {
      // El cliente hizo al menos una puja pero no es el ganador actual
      const clientHasBid = await prisma.bid.findFirst({
        where: { itemId: auction.currentItemId, attendeeId: attendee.id },
      });

      const clientIsWinner = await prisma.bid.findFirst({
        where: {
          itemId: auction.currentItemId,
          attendeeId: attendee.id,
          winner: true,
        },
      });

      youWereOutbid = clientHasBid !== null && clientIsWinner === null;
    }
  }

  // Último evento de la subasta
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
