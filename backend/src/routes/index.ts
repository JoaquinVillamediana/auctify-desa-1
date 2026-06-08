/**
 * Router principal /v1
 * Monta todos los módulos del API. Los no implementados tienen un placeholder
 * comentado que indica el feature doc de referencia.
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

const router = Router();

// ── Health ────────────────────────────────────────────────────────────────────
router.use("/health", healthRouter);

// ── Auth (F01) ────────────────────────────────────────────────────────────────
// POST /auth/register, /auth/activate, /auth/login, GET /auth/me
router.use("/auth", authRouter);

// ── Clients (F03) ─────────────────────────────────────────────────────────────
// PATCH /clients/:id (admisión) — mínimo implementado para desbloquear F01
// TODO F03: GET /clients, GET /clients/:id, baja lógica, métricas
// Ver docs/features/F03-clients.md
router.use("/clients", clientsRouter);

// ── Payment Methods (F02) ─────────────────────────────────────────────────────
// Paths completos (/me/payment-methods, /payment-methods/:id) → montado en la raíz /v1.
router.use(paymentMethodsRouter);

// ── Auctions · Sesión · Live (F04) ────────────────────────────────────────────
// GET /auctions, /:id, /:id/streaming; POST /:id/attendees·connect·disconnect; GET /:id/live-status
router.use("/auctions", auctionsRouter);

// ── Items / Bids (F05) ────────────────────────────────────────────────────────
// GET /items, /:id, /:id/bids; POST /:id/bids (puja con Idempotency-Key)
router.use("/items", itemsRouter);

// ── Products (F06) ────────────────────────────────────────────────────────────
// TODO: implementar módulo products
// GET  /products, /products/:id
// POST /products (owner)
// PATCH /products/:id
// POST /products/:id/photos
// GET  /products/:id/location
// Ver docs/features/F06-products.md
// router.use("/products", productsRouter);

// ── Inclusion Requests (F07) ──────────────────────────────────────────────────
// TODO: implementar módulo inclusionRequests
// POST /inclusion-requests (owner)
// GET  /inclusion-requests (owner/admin)
// GET  /inclusion-requests/:id
// POST /inclusion-requests/:id/inspection (admin)
// POST /inclusion-requests/:id/owner-response (owner)
// Ver docs/features/F07-inclusion-requests.md
// router.use("/inclusion-requests", inclusionRequestsRouter);

// ── Sale Records (F08) ────────────────────────────────────────────────────────
// TODO: implementar módulo saleRecords
// GET  /sale-records
// PATCH /sale-records/:id/shipping (comprador)
// POST /sale-records/:id/pay (comprador) ⭐ nuevo en E1
// Ver docs/features/F08-sale-records.md
// router.use("/sale-records", saleRecordsRouter);

// ── Penalties (F10) ───────────────────────────────────────────────────────────
// Paths completos (/penalties, /me/penalties, /clients/:id/penalties, /penalties/:id/pay) → raíz /v1.
router.use(penaltiesRouter);

// ── Notifications (F09) ───────────────────────────────────────────────────────
// TODO: implementar módulo notifications
// GET  /me/notifications
// POST /notifications/:id/read
// Ver docs/features/F09-notifications.md
// router.use("/notifications", notificationsRouter);

// ── Metrics (F08) ─────────────────────────────────────────────────────────────
// TODO: implementar módulo metrics
// GET  /me/metrics, /clients/:id/metrics (admin)
// Ver docs/features/F08-sale-records.md (métricas)
// router.use("/metrics", metricsRouter);

// ── Owners (F07) ──────────────────────────────────────────────────────────────
// TODO: implementar módulo owners
// GET  /owners, /owners/:id
// POST /owners
// GET  /owners/:id/payout-accounts
// POST /owners/:id/payout-accounts
// Ver docs/features/F07-inclusion-requests.md
// router.use("/owners", ownersRouter);

// ── Countries ─────────────────────────────────────────────────────────────────
// TODO: implementar endpoint de países (simple, sin módulo separado necesario)
// GET /countries
// router.use("/countries", countriesRouter);

// ── Insurance ─────────────────────────────────────────────────────────────────
// TODO: implementar módulo insurance
// GET  /insurance/:policy
// POST /insurance/:policy/coverage-increase
// router.use("/insurance", insuranceRouter);

export default router;
