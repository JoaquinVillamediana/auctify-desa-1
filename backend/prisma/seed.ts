/**
 * Seed de desarrollo — ver docs/02-data-model.md §5 y docs/features/F00-setup.md
 *
 * Datos sembrados:
 *   - 1 Country (Argentina)
 *   - 1 Client "admin" (admitted=true, category=platinum, roles ADMIN simulados por category)
 *   - 1 Client "gold" con PaymentMethod verificado (credenciales para desarrollo)
 *   - 1 Owner
 *   - 1 Auction open en ARS, category common
 *   - 1 Catalog con 3 CatalogItems cada uno con Product + 2 Photos
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed...\n");

  // ── País ──────────────────────────────────────────────────────────────────
  const argentina = await prisma.country.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Argentina",
      shortName: "AR",
      capital: "Buenos Aires",
      nationality: "argentina",
      languages: "español",
    },
  });
  console.log(`✓ Country: ${argentina.name} (id=${argentina.id})`);

  // ── Países adicionales (para el selector de país en el registro) ───────────
  const moreCountries = [
    { id: 2, name: "Uruguay", shortName: "UY", capital: "Montevideo", nationality: "uruguaya", languages: "español" },
    { id: 3, name: "Brasil", shortName: "BR", capital: "Brasilia", nationality: "brasileña", languages: "portugués" },
    { id: 4, name: "Chile", shortName: "CL", capital: "Santiago", nationality: "chilena", languages: "español" },
    { id: 5, name: "España", shortName: "ES", capital: "Madrid", nationality: "española", languages: "español" },
    { id: 6, name: "Estados Unidos", shortName: "US", capital: "Washington D.C.", nationality: "estadounidense", languages: "inglés" },
  ];
  for (const c of moreCountries) {
    await prisma.country.upsert({ where: { id: c.id }, update: {}, create: c });
  }
  console.log(`✓ Países adicionales sembrados: ${moreCountries.length}`);

  // ── Cliente "admin" ───────────────────────────────────────────────────────
  const adminPassword = "Admin123!";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const adminClient = await prisma.client.upsert({
    where: { document: "00000001" },
    update: {},
    create: {
      document: "00000001",
      firstName: "Admin",
      lastName: "Auctify",
      email: "admin@auctify.dev",
      passwordHash: adminHash,
      address: "Av. Corrientes 1234, CABA",
      countryId: argentina.id,
      admitted: true,
      category: "platinum", // platinum = acceso total; rol ADMIN se simula por category en MVP
      blocked: false,
      active: true,
    },
  });
  console.log(`✓ Client admin: DNI=${adminClient.document} / password=${adminPassword}`);

  // ── Cliente "postor gold" ─────────────────────────────────────────────────
  const clientPassword = "Secret123!";
  const clientHash = await bcrypt.hash(clientPassword, 10);

  const goldClient = await prisma.client.upsert({
    where: { document: "30111222" },
    update: {},
    create: {
      document: "30111222",
      firstName: "Juan",
      lastName: "Postor",
      email: "juan.postor@ejemplo.com",
      passwordHash: clientHash,
      address: "Calle Falsa 123, Buenos Aires",
      countryId: argentina.id,
      admitted: true,
      category: "gold",
      blocked: false,
      active: true,
    },
  });
  console.log(`✓ Client gold: DNI=${goldClient.document} / password=${clientPassword}`);

  // ── PaymentMethod verificado para el cliente gold ─────────────────────────
  const existingPM = await prisma.paymentMethod.findFirst({
    where: { clientId: goldClient.id },
  });

  let paymentMethod;
  if (!existingPM) {
    paymentMethod = await prisma.paymentMethod.create({
      data: {
        clientId: goldClient.id,
        type: "bank_account",
        currency: "ARS",
        detail: "CBU 0070999 / Cuenta Corriente",
        bank: "Banco Nación",
        countryId: argentina.id,
        status: "verified",
      },
    });
    console.log(`✓ PaymentMethod verificado (id=${paymentMethod.id})`);
  } else {
    paymentMethod = existingPM;
    console.log(`✓ PaymentMethod ya existía (id=${paymentMethod.id})`);
  }

  // ── Owner ─────────────────────────────────────────────────────────────────
  const owner = await prisma.owner.upsert({
    where: { document: "20333444" },
    update: {},
    create: {
      document: "20333444",
      name: "María Coleccionista",
      address: "Palermo 456, CABA",
      countryId: argentina.id,
      financialVerification: true,
      judicialVerification: true,
      riskRating: 2,
      verifierId: adminClient.id,
    },
  });
  console.log(`✓ Owner: ${owner.name} (id=${owner.id})`);

  // ── Auction open ──────────────────────────────────────────────────────────
  let auction = await prisma.auction.findFirst({
    where: { status: "open" },
  });

  if (!auction) {
    auction = await prisma.auction.create({
      data: {
        startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // empezó hace 2hs
        status: "open",
        currency: "ARS",
        category: "common",
        location: "Salón San Martín, CABA",
        attendeeCapacity: 100,
        hasWarehouse: true,
        ownSecurity: false,
        isCollection: false,
        version: 0,
      },
    });
    console.log(`✓ Auction open (id=${auction.id})`);
  } else {
    console.log(`✓ Auction open ya existía (id=${auction.id})`);
  }

  // ── Catalog ───────────────────────────────────────────────────────────────
  let catalog = await prisma.catalog.findUnique({
    where: { auctionId: auction.id },
  });

  if (!catalog) {
    catalog = await prisma.catalog.create({
      data: {
        description: "Catálogo de Arte Moderno — Junio 2026",
        auctionId: auction.id,
        responsibleId: adminClient.id,
      },
    });
    console.log(`✓ Catalog (id=${catalog.id})`);
  } else {
    console.log(`✓ Catalog ya existía (id=${catalog.id})`);
  }

  // ── Productos y CatalogItems ──────────────────────────────────────────────
  const productosData = [
    {
      lot: 1,
      fullDescription: "Óleo sobre tela — Paisaje pampeano",
      catalogDescription: "Paisaje pampeano atribuido a la escuela argentina, s. XX",
      artist: "Anónimo argentino",
      basePrice: 50_000,
      commission: 0.1,
      photos: [
        "https://picsum.photos/seed/p1a/800/600",
        "https://picsum.photos/seed/p1b/800/600",
      ],
    },
    {
      lot: 2,
      fullDescription: "Escultura en bronce — Figura femenina",
      catalogDescription: "Escultura en bronce patinado, firma ilegible, base de mármol",
      artist: "Desconocido",
      basePrice: 120_000,
      commission: 0.12,
      photos: [
        "https://picsum.photos/seed/p2a/800/600",
        "https://picsum.photos/seed/p2b/800/600",
      ],
    },
    {
      lot: 3,
      fullDescription: "Colección de cerámica criolla — 6 piezas",
      catalogDescription: "Juego de cerámica utilitaria, artesanía salteña contemporánea",
      artist: "Cooperativa Jujuy Arte",
      basePrice: 30_000,
      commission: 0.08,
      pieceCount: 6,
      photos: [
        "https://picsum.photos/seed/p3a/800/600",
        "https://picsum.photos/seed/p3b/800/600",
      ],
    },
  ];

  for (const pd of productosData) {
    const existingItem = await prisma.catalogItem.findFirst({
      where: { catalogId: catalog.id, lotNumber: pd.lot },
    });

    if (existingItem) {
      console.log(`✓ CatalogItem lote ${pd.lot} ya existía (id=${existingItem.id})`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        fullDescription: pd.fullDescription,
        catalogDescription: pd.catalogDescription,
        available: true,
        ownerId: owner.id,
        artist: pd.artist,
        pieceCount: pd.pieceCount ?? 1,
        photos: {
          create: pd.photos.map((url) => ({ photoUrl: url })),
        },
      },
    });

    const item = await prisma.catalogItem.create({
      data: {
        catalogId: catalog.id,
        productId: product.id,
        lotNumber: pd.lot,
        basePrice: pd.basePrice,
        commission: pd.commission,
        status: "pending",
        auctioned: false,
      },
    });

    console.log(`✓ Product+CatalogItem lote ${pd.lot} (productId=${product.id}, itemId=${item.id})`);
  }

  // ── Resumen de credenciales ───────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("  CREDENCIALES SEED (solo para desarrollo)");
  console.log("══════════════════════════════════════════════════");
  console.log(`  ADMIN    DNI: 00000001   pass: ${adminPassword}  category: platinum`);
  console.log(`  POSTOR   DNI: 30111222   pass: ${clientPassword}  category: gold`);
  console.log("══════════════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
