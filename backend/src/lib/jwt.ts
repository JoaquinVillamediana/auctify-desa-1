/**
 * Utilidades de JWT.
 * Ver docs/03-auth-and-roles.md §1 para el payload esperado.
 */

import jwt from "jsonwebtoken";
import { env } from "../config/env";

/** Claims del JWT de Auctify. */
export interface JwtPayload {
  /** clientId */
  sub: number;
  /** DNI del cliente */
  document: string;
  /** Categoría asignada al cliente */
  category: string | null;
  /** Roles del cliente: CLIENT, OWNER, ADMIN */
  roles: string[];
}

/**
 * Firma un token JWT con los claims del cliente.
 * La expiración se toma de JWT_EXPIRES_IN (por defecto 7d).
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Verifica y decodifica un JWT.
 * Lanza JsonWebTokenError o TokenExpiredError si es inválido.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
