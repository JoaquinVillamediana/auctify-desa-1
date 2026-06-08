/**
 * Controlador del módulo items/bids.
 * Traduce requests HTTP → service → response.
 *
 * Ver docs/features/F05-bidding.md
 */

import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCode } from "../../lib/errors";
import * as itemsService from "./items.service";

// ── GET /items ────────────────────────────────────────────────────────────────

export async function listItems(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isAuthenticated = !!req.auth;
    const items = await itemsService.listItems(
      {
        catalogId: req.query.catalogId as unknown as number | undefined,
        auctionId: req.query.auctionId as unknown as number | undefined,
        auctioned: req.query.auctioned as unknown as boolean | undefined,
      },
      isAuthenticated
    );
    res.status(200).json(items);
  } catch (err) {
    next(err);
  }
}

// ── GET /items/:id ─────────────────────────────────────────────────────────────

export async function getItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const itemId = req.params.id as unknown as number;
    const isAuthenticated = !!req.auth;
    const detail = await itemsService.getItemDetail(itemId, isAuthenticated);
    res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
}

// ── GET /items/:id/bids ───────────────────────────────────────────────────────

export async function listBids(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const itemId = req.params.id as unknown as number;
    const bids = await itemsService.listBids(itemId);
    res.status(200).json(bids);
  } catch (err) {
    next(err);
  }
}

// ── POST /items/:id/bids ──────────────────────────────────────────────────────

/**
 * Crea una puja.
 *
 * Header `Idempotency-Key` obligatorio (400 si falta).
 * Identidad del postor desde req.auth.sub.
 * attendeeId se resuelve en el servicio.
 */
export async function createBid(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim() === "") {
      return next(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "El header Idempotency-Key es obligatorio",
          { fields: { "Idempotency-Key": "Header requerido" } }
        )
      );
    }

    const itemId = req.params.id as unknown as number;
    const clientId = req.auth!.sub;

    const bid = await itemsService.createBid({
      itemId,
      clientId,
      amount: req.body.amount,
      paymentMethodId: req.body.paymentMethodId,
      idempotencyKey: idempotencyKey.trim(),
      knownBestBid: req.body.knownBestBid,
    });

    res.status(201).json(bid);
  } catch (err) {
    next(err);
  }
}
