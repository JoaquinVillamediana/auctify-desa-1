/**
 * Router principal /v1
 * Monta todos los módulos del API.
 *
 * Para agregar un nuevo módulo:
 *   1. Crear src/modules/<nombre>/<nombre>.routes.ts
 *   2. Importarlo aquí y montarlo con router.use(...)
 *   3. Ver el feature doc correspondiente en docs/features/Fxx-*.md
 */

import { Router } from "express";
import healthRouter from "../modules/health/health.routes";
import authRouter from "../modules/auth/auth.routes";
import clientsRouter from "../modules/clients/clients.routes";
import paymentMethodsRouter from "../modules/paymentMethods/paymentMethods.routes";
import auctionsRouter from "../modules/auctions/auctions.routes";
import itemsRouter from "../modules/items/items.routes";
import penaltiesRouter from "../modules/penalties/penalties.routes";
import saleRecordsRouter from "../modules/sale-records/sale-records.routes";
import insuranceRouter from "../modules/insurance/insurance.routes";
import productsRouter from "../modules/products/products.routes";
import ownersRouter from "../modules/owners/owners.routes";

const router = Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.use("/health", healthRouter);

// ── Auth (F01) ────────────────────────────────────────────────────────────────
router.use("/auth", authRouter);

// ── Clients (admin) ───────────────────────────────────────────────────────────
router.use("/clients", clientsRouter);

// ── Payment Methods (F02) ─────────────────────────────────────────────────────
// Paths completos (/me/payment-methods, /payment-methods/:id) → montado en la raíz /v1.
router.use(paymentMethodsRouter);

// ── Auctions · Catálogo · Sesión · Live (F03/F04) ────────────────────────────
router.use("/auctions", auctionsRouter);

// ── Items / Bids (F03/F05) ────────────────────────────────────────────────────
router.use("/items", itemsRouter);

// ── Sale Records (F07) ────────────────────────────────────────────────────────
// GET  /sale-records
// POST /sale-records (admin/system)
// PATCH /sale-records/:id/shipping
// POST  /sale-records/:id/pay
router.use("/sale-records", saleRecordsRouter);

// ── Insurance (F11) ───────────────────────────────────────────────────────────
// GET  /insurance/:policyNumber
// POST /insurance/:policyNumber/coverage-increase
router.use("/insurance", insuranceRouter);

// ── Products (F11 — ubicación) ────────────────────────────────────────────────
// GET  /products/:id/location
router.use("/products", productsRouter);

// ── Owners (F11 — cuentas de cobro) ──────────────────────────────────────────
// GET  /owners/:id/payout-accounts
// POST /owners/:id/payout-accounts
router.use("/owners", ownersRouter);

// ── Penalties (F10) ───────────────────────────────────────────────────────────
// Paths completos (/penalties, /me/penalties, /clients/:id/penalties, /penalties/:id/pay) → raíz /v1.
router.use(penaltiesRouter);

// ── Inclusion Requests (F06) ──────────────────────────────────────────────────
// TODO: implementar módulo inclusionRequests — ver docs/features/F06-inclusion-requests.md
// router.use("/inclusion-requests", inclusionRequestsRouter);

// ── Notifications (F09) ───────────────────────────────────────────────────────
// TODO: implementar módulo notifications — ver docs/features/F09-notifications.md
// router.use("/notifications", notificationsRouter);

// ── Metrics (F08) ─────────────────────────────────────────────────────────────
// TODO: implementar módulo metrics — ver docs/features/F08-metrics.md
// router.use("/metrics", metricsRouter);

export default router;
