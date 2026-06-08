/**
 * Rutas del módulo products (F06).
 * Base path: /v1/products
 *
 * POST /products              — JWT (OWNER) — crear producto draft
 * GET  /products              — JWT (OWNER/ADMIN) — listar productos
 * POST /products/:id/photos   — JWT (OWNER) — agregar foto
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../../middleware/auth";
import { resolveOwner } from "../../middleware/owner";
import { validate } from "../../middleware/validate";
import { createProductSchema, listProductsSchema } from "./products.schema";
import * as productsController from "./products.controller";
import { env } from "../../config/env";

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `photo-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo se aceptan imágenes JPEG, PNG o WebP"));
  },
});

const router = Router();

router.post(
  "/",
  requireAuth,
  resolveOwner,
  validate(createProductSchema),
  productsController.createProduct
);

router.get(
  "/",
  requireAuth,
  resolveOwner,
  validate(listProductsSchema),
  productsController.listProducts
);

router.post(
  "/:id/photos",
  requireAuth,
  resolveOwner,
  upload.single("photo"),
  productsController.addPhoto
);

export default router;
