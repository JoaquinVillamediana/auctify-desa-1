/**
 * Servicio de ítems y pujas.
 * Ver docs/features/F05-bidding.md y ADR-002-realtime-polling.md
 *
 * La lógica de concurrencia usa una transacción + recompute del bestBid
 * dentro de la transacción para serializar las pujas (BEGIN IMMEDIATE en SQLite).
 */

import { prisma } from "../../lib/prisma";
import { AppError, ErrorCode, notFound } from "../../lib/errors";
import { computeRange } from "../auctions/auctions.service";

// ── GET /items ────────────────────────────────────────────────────────────────

export interface ListItemsFilters {
  catalogId?: number;
  /** Si se pasa auctionId, se resuelve el catalogId de la subasta. */
  auctionId?: number;
  auctioned?: boolean;
}

/** Mapea un CatalogItem de Prisma al shape del OpenAPI. */
function mapItem(
  item: {
    id: number;
    catalogId: number;
    productId: number;
    lotNumber: number;
    basePrice: number;
    commission: number;
    status: string;
    auctioned: boolean;
  },
  isAuthenticated: boolean
) {
  return {
    id: item.id,
    catalogId: item.catalogId,
    productId: item.productId,
    lotNumber: item.lotNumber,
    // basePrice solo visible para autenticados
    basePrice: isAuthenticated ? item.basePrice : null,
    commission: item.commission,
    status: item.status,
    auctioned: item.auctioned,
  };
}

/** Lista ítems con filtros opcionales. */
export async function listItems(
  filters: ListItemsFilters,
  isAuthenticated: boolean
) {
  let resolvedCatalogId = filters.catalogId;

  // Si viene auctionId, resolver el catalogId de la subasta
  if (filters.auctionId && !resolvedCatalogId) {
    const catalog = await prisma.catalog.findFirst({
      where: { auctionId: filters.auctionId },
      select: { id: true },
    });
    if (!catalog) return [];
    resolvedCatalogId = catalog.id;
  }

  const where: Record<string, unknown> = {};
  if (resolvedCatalogId) where.catalogId = resolvedCatalogId;
  if (filters.auctioned !== undefined) where.auctioned = filters.auctioned;

  const items = await prisma.catalogItem.findMany({
    where,
    orderBy: { lotNumber: "asc" },
  });

  return items.map((item) => mapItem(item, isAuthenticated));
}

// ── GET /items/:id ─────────────────────────────────────────────────────────────

/**
 * Detalle de un ítem (CatalogItemDetail): base + bestBid + rango de puja.
 * Requiere acceso al catálogo de la subasta para calcular el rango.
 */
export async function getItemDetail(itemId: number, isAuthenticated: boolean) {
  const item = await prisma.catalogItem.findUnique({
    where: { id: itemId },
    include: {
      product: true,
      catalog: {
        include: { auction: { select: { category: true } } },
      },
    },
  });

  if (!item) throw notFound("Ítem");

  // Mejor puja y última puja
  const bestBidRow = await prisma.bid.findFirst({
    where: { itemId },
    orderBy: { amount: "desc" },
    select: { amount: true },
  });
  const lastBidRow = await prisma.bid.findFirst({
    where: { itemId },
    orderBy: { timestamp: "desc" },
    select: { amount: true },
  });

  const bestBid = bestBidRow?.amount ?? null;
  const lastBidAmount = lastBidRow?.amount ?? null;

  const { minBidAllowed, maxBidAllowed } = computeRange(
    item,
    item.catalog.auction.category,
    bestBid,
    lastBidAmount
  );

  return {
    ...mapItem(item, isAuthenticated),
    productDetail: {
      id: item.product.id,
      catalogDescription: item.product.catalogDescription,
      fullDescription: item.product.fullDescription,
      artist: item.product.artist,
      historicalDate: item.product.historicalDate,
      history: item.product.history,
      pieceCount: item.product.pieceCount,
    },
    bestBid: isAuthenticated ? bestBid : null,
    minBidAllowed: isAuthenticated ? minBidAllowed : null,
    maxBidAllowed: isAuthenticated ? maxBidAllowed : null,
  };
}

// ── GET /items/:id/bids ───────────────────────────────────────────────────────

/** Historial de pujas de un ítem en orden cronológico (ascendente por timestamp, id). */
export async function listBids(itemId: number) {
  const item = await prisma.catalogItem.findUnique({ where: { id: itemId } });
  if (!item) throw notFound("Ítem");

  const bids = await prisma.bid.findMany({
    where: { itemId },
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    include: {
      attendee: { select: { bidderNumber: true } },
    },
  });

  return bids.map((bid) => ({
    id: bid.id,
    attendeeId: bid.attendeeId,
    bidderNumber: bid.attendee.bidderNumber,
    itemId: bid.itemId,
    amount: bid.amount,
    winner: bid.winner,
    timestamp: bid.timestamp.toISOString(),
    paymentMethodId: bid.paymentMethodId,
  }));
}

// ── POST /items/:id/bids ──────────────────────────────────────────────────────

export interface CreateBidInput {
  itemId: number;
  clientId: number;
  amount: number;
  paymentMethodId: number;
  idempotencyKey: string;
  /** Mejor puja que el cliente conocía (para detección de BID_SUPERSEDED). */
  knownBestBid?: number | null;
}

/**
 * Registra una nueva puja.
 *
 * Flujo (dentro de una transacción):
 *   1. Idempotencia: si la clave ya existe, devolver la puja existente.
 *   2. Resolver attendee por (auctionId del ítem + clientId); verificar sesión activa.
 *   3. Validar paymentMethod (propiedad, verificado, límite de cheque, no bloqueado).
 *   4. Recomputar bestBid / lastBid DENTRO de la transacción.
 *   5. BID_SUPERSEDED si el bestBid cambió vs. lo que el cliente conocía.
 *   6. Validar rango (salvo gold/platinum).
 *   7. Insertar Bid, marcar winner, crear AuctionEvent, incrementar auction.version.
 *   8. Retornar 201 con la Bid.
 */
export async function createBid(input: CreateBidInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Idempotencia
    const existing = await tx.bid.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    // Cargar el ítem con su catálogo y subasta
    const item = await tx.catalogItem.findUnique({
      where: { id: input.itemId },
      include: {
        catalog: {
          include: {
            auction: {
              select: {
                id: true,
                category: true,
                version: true,
                currentItemId: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!item) throw notFound("Ítem");

    const auction = item.catalog.auction;
    const auctionId = auction.id;

    // 2. Resolver attendee y verificar sesión activa
    const attendee = await tx.attendee.findUnique({
      where: { auctionId_clientId: { auctionId, clientId: input.clientId } },
    });

    if (!attendee) {
      throw new AppError(
        ErrorCode.NOT_CONNECTED,
        403,
        "No estás conectado a esta subasta"
      );
    }

    const activeSession = await tx.auctionSession.findFirst({
      where: { auctionId, clientId: input.clientId, active: true },
    });
    if (!activeSession) {
      throw new AppError(
        ErrorCode.NOT_CONNECTED,
        403,
        "No estás conectado a esta subasta"
      );
    }

    // 3. Validar medio de pago
    const paymentMethod = await tx.paymentMethod.findUnique({
      where: { id: input.paymentMethodId },
    });

    if (!paymentMethod || paymentMethod.clientId !== input.clientId) {
      throw new AppError(
        ErrorCode.PAYMENT_METHOD_NOT_OWNED,
        403,
        "El medio de pago no te pertenece"
      );
    }
    if (paymentMethod.status !== "verified") {
      throw new AppError(
        ErrorCode.NO_VERIFIED_PAYMENT_METHOD,
        403,
        "El medio de pago no está verificado"
      );
    }

    // Verificar cliente no bloqueado
    const client = await tx.client.findUnique({ where: { id: input.clientId } });
    if (!client || client.blocked) {
      throw new AppError(ErrorCode.CLIENT_BLOCKED, 403, "La cuenta está bloqueada");
    }

    // Regla del cheque certificado
    if (paymentMethod.type === "certified_check") {
      const reservedAmount = paymentMethod.reservedAmount ?? 0;
      // Suma de pujas ganadores (compromisos del cliente con este medio de pago)
      const committed = await tx.bid.aggregate({
        where: {
          attendee: { clientId: input.clientId },
          winner: true,
          paymentMethodId: input.paymentMethodId,
        },
        _sum: { amount: true },
      });
      const totalCommitted = (committed._sum.amount ?? 0) + input.amount;
      if (totalCommitted > reservedAmount) {
        throw new AppError(
          ErrorCode.CHECK_LIMIT_EXCEEDED,
          403,
          `Superás el límite del cheque (${reservedAmount}). Comprometido: ${committed._sum.amount ?? 0}`
        );
      }
    }

    // 4. Recomputar bestBid y lastBid DENTRO de la transacción
    const bestBidRow = await tx.bid.findFirst({
      where: { itemId: input.itemId },
      orderBy: { amount: "desc" },
      select: { amount: true },
    });
    const lastBidRow = await tx.bid.findFirst({
      where: { itemId: input.itemId },
      orderBy: { timestamp: "desc" },
      select: { amount: true },
    });

    const currentBest = bestBidRow?.amount ?? null;
    const lastBidAmount = lastBidRow?.amount ?? null;

    // 5. BID_SUPERSEDED: el best cambió vs. lo que el cliente conocía
    if (
      input.knownBestBid !== undefined &&
      input.knownBestBid !== null &&
      currentBest !== null &&
      currentBest !== input.knownBestBid
    ) {
      throw new AppError(
        ErrorCode.BID_SUPERSEDED,
        409,
        "Otro postor pujó antes que vos. Refrescá el estado y volvé a intentar."
      );
    }

    // 6. Validar rango (excepto gold/platinum)
    const { minBidAllowed, maxBidAllowed } = computeRange(
      item,
      auction.category,
      currentBest,
      lastBidAmount
    );

    if (minBidAllowed !== null && input.amount < minBidAllowed) {
      throw new AppError(
        ErrorCode.BID_OUT_OF_RANGE,
        422,
        `El importe mínimo permitido es ${minBidAllowed}`,
        { minAllowed: minBidAllowed, maxAllowed: maxBidAllowed }
      );
    }
    if (maxBidAllowed !== null && input.amount > maxBidAllowed) {
      throw new AppError(
        ErrorCode.BID_OUT_OF_RANGE,
        422,
        `El importe máximo permitido es ${maxBidAllowed}`,
        { minAllowed: minBidAllowed, maxAllowed: maxBidAllowed }
      );
    }

    // Para gold/platinum: solo requerir que supere el best (o >= base si no hay pujas)
    if (minBidAllowed === null) {
      const threshold = currentBest !== null ? currentBest : item.basePrice;
      if (input.amount <= threshold - 0.001) {
        throw new AppError(
          ErrorCode.BID_OUT_OF_RANGE,
          422,
          `El importe debe superar la mejor puja actual (${threshold})`,
          { minAllowed: threshold, maxAllowed: null }
        );
      }
    }

    // 7. Insertar puja, marcar ganador, crear evento, incrementar versión

    // Desmarcar puja ganadora anterior
    await tx.bid.updateMany({
      where: { itemId: input.itemId, winner: true },
      data: { winner: false },
    });

    const newBid = await tx.bid.create({
      data: {
        itemId: input.itemId,
        attendeeId: attendee.id,
        amount: input.amount,
        winner: true,
        paymentMethodId: input.paymentMethodId,
        idempotencyKey: input.idempotencyKey,
        timestamp: new Date(),
      },
    });

    // Crear AuctionEvent(new_bid)
    await tx.auctionEvent.create({
      data: {
        auctionId,
        type: "new_bid",
        data: JSON.stringify({
          bidId: newBid.id,
          itemId: input.itemId,
          amount: input.amount,
          attendeeId: attendee.id,
          bidderNumber: attendee.bidderNumber,
        }),
        createdAt: new Date(),
      },
    });

    // Incrementar auction.version
    await tx.auction.update({
      where: { id: auctionId },
      data: { version: { increment: 1 } },
    });

    return newBid;
  });
}
