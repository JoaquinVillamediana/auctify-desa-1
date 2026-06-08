import { Request, Response, NextFunction } from "express";
import * as auctionsService from "./auctions.service";

export async function getAuctions(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      currency: req.query.currency as string | undefined,
      date: req.query.date as string | undefined,
      accessibleForClient: req.query.accessibleForClient === "true",
    };
    const result = await auctionsService.getAuctions(filters, req.auth);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAuctionById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await auctionsService.getAuctionById(id, req.auth);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createAuction(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await auctionsService.createAuction(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateAuction(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await auctionsService.updateAuction(id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAuctionCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await auctionsService.getAuctionCatalog(id, req.auth);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStreamingUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await auctionsService.getStreamingUrl(id, req.auth!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
