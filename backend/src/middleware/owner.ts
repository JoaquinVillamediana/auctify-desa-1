/**
 * Middleware resolveOwner.
 * Busca el Owner asociado al cliente autenticado por document (DNI).
 * Si no existe lo crea con los datos del cliente (MVP: auto-registro de dueño).
 * Puebla req.owner para que los handlers de F06 no repitan esta lógica.
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { unauthorized } from "../lib/errors";

declare global {
  namespace Express {
    interface Request {
      owner?: { id: number; document: string };
    }
  }
}

export async function resolveOwner(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.auth) {
    return next(unauthorized());
  }

  try {
    // Buscar Owner existente por document (DNI) del cliente
    let owner = await prisma.owner.findUnique({
      where: { document: req.auth.document },
      select: { id: true, document: true },
    });

    if (!owner) {
      // Auto-crear Owner desde los datos del Cliente (MVP: cualquier cliente admitido puede ser dueño)
      const client = await prisma.client.findUnique({
        where: { id: req.auth.sub },
        select: { firstName: true, lastName: true, address: true, countryId: true, id: true },
      });

      if (!client) {
        return next(unauthorized());
      }

      owner = await prisma.owner.create({
        data: {
          document: req.auth.document,
          name: `${client.firstName} ${client.lastName}`,
          address: client.address ?? undefined,
          countryId: client.countryId ?? undefined,
          // verifierId: el propio cliente como auto-verificación en desarrollo
          verifierId: client.id,
        },
        select: { id: true, document: true },
      });
    }

    req.owner = owner;
    next();
  } catch (err) {
    next(err);
  }
}
