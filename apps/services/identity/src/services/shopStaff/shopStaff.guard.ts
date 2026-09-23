import type { ShopRole } from "@betng/contracts";
import { ForbiddenError, ResourceNotFoundError } from "../../errors/index.js";
import type { Cashier } from "../../generated/prisma/client.js";
import type { IdentityRepositories, ShopActor } from "../../interfaces/index.js";

/** Who may act on whom inside a shop. An owner staffs the shop; nobody may reach above themselves. */
const RANK: Readonly<Record<ShopRole, number>> = { CASHIER: 0, MANAGER: 1, OWNER: 2 };

export function assertMayManage(actor: ShopActor, role: ShopRole): void {
  if (actor.role !== "OWNER") {
    throw new ForbiddenError("Only a shop owner can manage cashiers.");
  }

  // One owner per shop: a second would be able to remove the first.
  if (RANK[role] >= RANK[actor.role]) {
    throw new ForbiddenError("You cannot give a cashier your own role.");
  }
}

/**
 * Finds a cashier and proves they belong to the caller's shop. A cashier in another shop is reported as
 * absent, so a guessed id cannot confirm that it exists.
 */
export async function requireOwnCashier(
  repositories: IdentityRepositories,
  actor: ShopActor,
  cashierId: string,
): Promise<Cashier> {
  const cashier = await repositories.cashiers.findById(cashierId);

  if (cashier === undefined || cashier.shopId !== actor.shopId) {
    throw new ResourceNotFoundError("That cashier is not in your shop.");
  }

  if (cashier.id === actor.id) {
    throw new ForbiddenError("You cannot do that to your own account.");
  }

  if (RANK[cashier.role] >= RANK[actor.role]) {
    throw new ForbiddenError("You cannot act on a cashier at your own level.");
  }

  return cashier;
}
