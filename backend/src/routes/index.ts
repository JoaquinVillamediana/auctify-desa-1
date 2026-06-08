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
import productsRouter from "../modules/products/products.routes";
import inclusionRequestsRouter from "../modules/inclusion-requests/inclusion-requests.routes";

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
// TODO: implementar módulo paymentMethods
// GET  /me/payment-methods
// POST /me/payment-methods
// POST /payment-methods/:id/verify (admin)
// DELETE /payment-methods/:id
// Ver docs/features/F02-payment-methods.md
// router.use("/payment-methods", paymentMethodsRouter);
// router.use("/me/payment-methods", myPaymentMethodsRouter);

// ── Auctions (F04) ────────────────────────────────────────────────────────────
// TODO: implementar módulo auctions
// GET  /auctions, /auctions/:id
// POST /auctions (admin)
// PATCH /auctions/:id (admin)
// POST /auctions/:id/attendees
// GET  /auctions/:id/attendees (admin)
// POST /auctions/:id/connect, /disconnect
// GET  /auctions/:id/live-status
// GET  /auctions/:id/streaming
// Ver docs/features/F04-auctions.md
// router.use("/auctions", auctionsRouter);

// ── Items / Bids (F05) ────────────────────────────────────────────────────────
// TODO: implementar módulo items y bids
// GET  /items, /items/:id, /items/:id/bids
// POST /items (admin, agrega al catálogo)
// POST /items/:id/bids (postor conectado)
// Ver docs/features/F05-bidding.md
// router.use("/items", itemsRouter);

// ── Products (F06) ────────────────────────────────────────────────────────────
// POST /products, GET /products, POST /products/:id/photos
router.use("/products", productsRouter);

// ── Inclusion Requests (F06) ──────────────────────────────────────────────────
// POST /inclusion-requests, GET /inclusion-requests, GET /inclusion-requests/:id
// POST /inclusion-requests/:id/inspection (admin)
// POST /inclusion-requests/:id/owner-response (owner)
router.use("/inclusion-requests", inclusionRequestsRouter);

// ── Sale Records (F08) ────────────────────────────────────────────────────────
// TODO: implementar módulo saleRecords
// GET  /sale-records
// PATCH /sale-records/:id/shipping (comprador)
// POST /sale-records/:id/pay (comprador) ⭐ nuevo en E1
// Ver docs/features/F08-sale-records.md
// router.use("/sale-records", saleRecordsRouter);

// ── Penalties (F08) ───────────────────────────────────────────────────────────
// TODO: implementar módulo penalties
// GET  /me/penalties, /clients/:id/penalties
// POST /penalties/:id/pay
// Ver docs/features/F08-sale-records.md (multas)
// router.use("/penalties", penaltiesRouter);

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
