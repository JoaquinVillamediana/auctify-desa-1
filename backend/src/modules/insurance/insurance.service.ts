import { prisma } from "../../lib/prisma";
import { notFound, forbidden, validationError, AppError, ErrorCode } from "../../lib/errors";
import type { JwtPayload } from "../../lib/jwt";

async function checkOwnerHasPolicy(ownerId: number, policyNumber: string) {
  const product = await prisma.product.findFirst({
    where: { ownerId, insurancePolicy: policyNumber },
  });
  if (!product) {
    throw new AppError(ErrorCode.FORBIDDEN, 403, "No tenés ningún bien con esa póliza");
  }
}

export async function getInsurance(policyNumber: string, auth: JwtPayload) {
  const insurance = await prisma.insurance.findUnique({
    where: { policyNumber },
  });

  if (!insurance) throw notFound("Póliza");

  if (!auth.roles.includes("ADMIN")) {
    await checkOwnerHasPolicy(auth.sub, policyNumber);
  }

  return insurance;
}

export async function increaseCoverage(
  policyNumber: string,
  data: { newAmount: number },
  auth: JwtPayload
) {
  const insurance = await prisma.insurance.findUnique({
    where: { policyNumber },
  });

  if (!insurance) throw notFound("Póliza");

  await checkOwnerHasPolicy(auth.sub, policyNumber);

  if (data.newAmount <= insurance.amount) {
    throw validationError("El nuevo monto debe ser mayor al actual", {
      newAmount: `Debe ser mayor a ${insurance.amount}`,
    });
  }

  const premiumDelta = (data.newAmount - insurance.amount) * 0.02;
  const previousAmount = insurance.amount;

  await prisma.insurance.update({
    where: { policyNumber },
    data: { amount: data.newAmount },
  });

  return {
    policyNumber,
    previousAmount,
    newAmount: data.newAmount,
    premiumDelta,
    status: "confirmed",
  };
}

export async function getProductLocation(productId: number, auth: JwtPayload) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw notFound("Producto");

  if (!auth.roles.includes("ADMIN") && product.ownerId !== auth.sub) {
    throw forbidden("No tenés acceso a la ubicación de este producto");
  }

  const location = await prisma.productLocation.findUnique({
    where: { productId },
  });

  if (!location) throw notFound("Ubicación del producto");

  return location;
}

export async function getPayoutAccounts(ownerId: number, auth: JwtPayload) {
  if (!auth.roles.includes("ADMIN") && auth.sub !== ownerId) {
    throw forbidden("Solo podés ver tus propias cuentas de cobro");
  }

  return prisma.payoutAccount.findMany({ where: { ownerId } });
}

export async function createPayoutAccount(
  ownerId: number,
  data: {
    bank: string;
    currency: string;
    cbuOrIban: string;
    accountHolder: string;
    countryId?: number;
  },
  auth: JwtPayload
) {
  if (!auth.roles.includes("ADMIN") && auth.sub !== ownerId) {
    throw forbidden("Solo podés declarar tus propias cuentas de cobro");
  }

  return prisma.payoutAccount.create({
    data: {
      ownerId,
      bank: data.bank,
      currency: data.currency,
      cbuOrIban: data.cbuOrIban,
      accountHolder: data.accountHolder,
      countryId: data.countryId ?? null,
      declaredAt: new Date(),
    },
  });
}
