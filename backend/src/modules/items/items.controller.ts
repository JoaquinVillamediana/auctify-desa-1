import { Request, Response, NextFunction } from "express";
import * as itemsService from "./items.service";

export async function getItems(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      catalogId: req.query.catalogId ? parseInt(req.query.catalogId as string, 10) : undefined,
      auctionId: req.query.auctionId ? parseInt(req.query.auctionId as string, 10) : undefined,
      auctioned: req.query.auctioned !== undefined ? req.query.auctioned === "true" : undefined,
    };
    const result = await itemsService.getItems(filters, req.auth);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await itemsService.getItemById(id, req.auth);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await itemsService.createItem(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await itemsService.updateItem(id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
