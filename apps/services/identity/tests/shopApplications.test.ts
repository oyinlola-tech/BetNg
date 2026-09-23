import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  AdminShopApplication,
  CashierCredentials,
  ShopApplicationReceipt,
  ShopApplicationStatusView,
  ShopOwnerCredentials,
} from "@betng/contracts";
import { adminActor, cashierActor, freshEmail, startHarness } from "./harness.js";
import type { ErrorBody, Harness } from "./harness.js";

let harness: Harness;

beforeAll(async () => {
  harness = await startHarness({ LOG_VERIFICATION_CODES: "true" });
});

afterAll(async () => {
  await harness.stop();
});

const reviewer = () => adminActor("OPERATIONS");

interface Applied {
  readonly receipt: ShopApplicationReceipt;
  readonly email: string;
}

const apply = async (overrides: Record<string, unknown> = {}): Promise<Applied> => {
  const email = freshEmail();
  const answer = await harness.call<ShopApplicationReceipt>("POST", "/shop-applications", {
    body: {
      applicantName: "Adaeze Okonkwo",
      applicantEmail: email,
      applicantPhone: "+234 803 555 0142",
      businessName: "Okonkwo Sports Ventures",
      rcNumber: "RC-1234567",
      address: "42 Allen Avenue, Ikeja",
      city: "Ikeja",
      state: "LAGOS",
      proposedShopName: "BetNG Allen Avenue",
      ...overrides,
    },
  });

  expect(answer.status).toBe(201);

  return { receipt: answer.body, email };
};

const verify = async (applied: Applied): Promise<void> => {
  const answer = await harness.call("POST", `/shop-applications/${applied.receipt.reference}/verify`, {
    body: { applicantEmail: applied.email, code: harness.issuedCode(applied.email) },
  });

  expect(answer.status).toBe(200);
};

const findApplication = async (reference: string): Promise<AdminShopApplication> => {
  const queue = await harness.call<{ items: AdminShopApplication[] }>("GET", "/admin/shop-applications", {
    actor: reviewer(),
  });
  const found = queue.body.items.find((application) => application.reference === reference);

  if (found === undefined) {
    throw new Error(`${reference} is not in the queue.`);
  }

  return found;
};

describe("applying", () => {
  it("accepts an application and returns a reference that needs the address to read back", async () => {
    const applied = await apply();

    expect(applied.receipt.reference).toMatch(/^BNGA-[0-9A-HJ-NP-Z]{16}$/u);
    expect(applied.receipt.verificationRequired).toBe(true);

    // The reference alone is not enough.
    const withoutEmail = await harness.call("GET", `/shop-applications/${applied.receipt.reference}/status`);

    expect(withoutEmail.status).toBe(422);

    const wrongEmail = await harness.call(
      "GET",
      `/shop-applications/${applied.receipt.reference}/status?email=${encodeURIComponent(freshEmail())}`,
    );

    expect(wrongEmail.status).toBe(404);

    const status = await harness.call<ShopApplicationStatusView>(
      "GET",
      `/shop-applications/${applied.receipt.reference}/status?email=${encodeURIComponent(applied.email)}`,
    );

    expect(status.status).toBe(200);
    expect(status.body.status).toBe("PENDING");
    expect(status.body.emailVerified).toBe(false);
    // The applicant's own view carries no internal id and no reviewer.
    expect(JSON.stringify(status.body)).not.toMatch(/decidedBy|"id"/u);
  });

  it("reports an unknown reference and a mismatched address the same way", async () => {
    const applied = await apply();
    const unknown = await harness.call<ErrorBody>(
      "GET",
      `/shop-applications/BNGA-ZZZZZZZZZZZZZZZZ/status?email=${encodeURIComponent(applied.email)}`,
    );
    const mismatched = await harness.call<ErrorBody>(
      "GET",
      `/shop-applications/${applied.receipt.reference}/status?email=${encodeURIComponent(freshEmail())}`,
    );

    expect(unknown.status).toBe(mismatched.status);
    expect(unknown.body.error.message).toBe(mismatched.body.error.message);
  });

  it("refuses a second live application for one address", async () => {
    const applied = await apply();
    const again = await harness.call("POST", "/shop-applications", {
      body: {
        applicantName: "Adaeze Okonkwo",
        applicantEmail: applied.email,
        applicantPhone: "+234 803 555 0142",
        businessName: "Another Venture",
        address: "1 Other Road",
        city: "Ikeja",
        state: "LAGOS",
        proposedShopName: "Another Shop",
      },
    });

    expect(again.status).toBe(409);
  });

  it("refuses an unknown field, a bad state and a missing one", async () => {
    const base = {
      applicantName: "Adaeze Okonkwo",
      applicantEmail: freshEmail(),
      applicantPhone: "+234 803 555 0142",
      businessName: "Okonkwo Sports Ventures",
      address: "42 Allen Avenue, Ikeja",
      city: "Ikeja",
      state: "LAGOS",
      proposedShopName: "BetNG Allen Avenue",
    };

    for (const body of [
      { ...base, status: "APPROVED" },
      { ...base, state: "ATLANTIS" },
      { ...base, applicantPhone: "not a phone" },
      { ...base, businessName: "" },
    ]) {
      expect((await harness.call("POST", "/shop-applications", { body })).status).toBe(422);
    }
  });

  it("verifies the address with the code, and refuses a wrong one the same way as a wrong reference", async () => {
    const applied = await apply();

    const wrongCode = await harness.call<ErrorBody>("POST", `/shop-applications/${applied.receipt.reference}/verify`, {
      body: { applicantEmail: applied.email, code: "000000" },
    });

    expect(wrongCode.status).toBe(422);

    await verify(applied);

    const status = await harness.call<ShopApplicationStatusView>(
      "GET",
      `/shop-applications/${applied.receipt.reference}/status?email=${encodeURIComponent(applied.email)}`,
    );

    expect(status.body.emailVerified).toBe(true);
  });
});

describe("reviewing", () => {
  it("refuses approving before the address is proved", async () => {
    const applied = await apply();
    const application = await findApplication(applied.receipt.reference);

    const answer = await harness.call(`POST` as const, `/admin/shop-applications/${application.id}/review`, {
      actor: reviewer(),
      body: { decision: "APPROVE", reason: "looks legitimate" },
    });

    expect(answer.status).toBe(409);
  });

  it("creates the shop and its owner in one decision", async () => {
    const applied = await apply();

    await verify(applied);

    const application = await findApplication(applied.receipt.reference);
    const approved = await harness.call<{ status: string; credentials: ShopOwnerCredentials }>(
      "POST",
      `/admin/shop-applications/${application.id}/review`,
      { actor: reviewer(), body: { decision: "APPROVE", reason: "premises and CAC verified" } },
    );

    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("APPROVED");
    expect(approved.body.credentials.shopCode).toMatch(/^BNG-LAG-\d{3}$/u);
    expect(approved.body.credentials.username).toBe("adaeze");
    expect(approved.body.credentials.temporaryPassword.length).toBeGreaterThanOrEqual(12);

    // The owner can sign in at once with what they were given.
    const session = await harness.call<{ cashier: { role: string } }>("POST", "/shop/auth/login", {
      body: {
        shopCode: approved.body.credentials.shopCode,
        username: approved.body.credentials.username,
        password: approved.body.credentials.temporaryPassword,
        pin: approved.body.credentials.temporaryPin,
      },
    });

    expect(session.status).toBe(200);
    expect(session.body.cashier.role).toBe("OWNER");
  });

  it("refuses deciding the same application twice", async () => {
    const applied = await apply();

    await verify(applied);

    const application = await findApplication(applied.receipt.reference);
    const body = { decision: "REJECT" as const, reason: "premises not suitable" };

    expect((await harness.call("POST", `/admin/shop-applications/${application.id}/review`, { actor: reviewer(), body })).status).toBe(200);
    expect((await harness.call("POST", `/admin/shop-applications/${application.id}/review`, { actor: reviewer(), body })).status).toBe(409);
  });

  it("lets a request for changes be revisited, unlike a refusal", async () => {
    const applied = await apply();

    await verify(applied);

    const application = await findApplication(applied.receipt.reference);

    expect(
      (await harness.call("POST", `/admin/shop-applications/${application.id}/review`, {
        actor: reviewer(),
        body: { decision: "REQUEST_ACTION", reason: "send a clearer photo of the premises" },
      })).status,
    ).toBe(200);

    // The applicant is told what is needed.
    const status = await harness.call<ShopApplicationStatusView>(
      "GET",
      `/shop-applications/${applied.receipt.reference}/status?email=${encodeURIComponent(applied.email)}`,
    );

    expect(status.body.status).toBe("REQUIRES_ACTION");
    expect(status.body.reason).toMatch(/clearer photo/u);

    expect(
      (await harness.call("POST", `/admin/shop-applications/${application.id}/review`, {
        actor: reviewer(),
        body: { decision: "APPROVE", reason: "photo received" },
      })).status,
    ).toBe(200);
  });

  it("never tells the applicant a reviewer's note on an approval", async () => {
    const applied = await apply();

    await verify(applied);

    const application = await findApplication(applied.receipt.reference);

    await harness.call("POST", `/admin/shop-applications/${application.id}/review`, {
      actor: reviewer(),
      body: { decision: "APPROVE", reason: "known to the regional manager" },
    });

    const status = await harness.call<ShopApplicationStatusView>(
      "GET",
      `/shop-applications/${applied.receipt.reference}/status?email=${encodeURIComponent(applied.email)}`,
    );

    expect(status.body.status).toBe("APPROVED");
    expect(status.body.reason).toBeUndefined();
  });

  it("refuses a reviewer without the permission, and a shop code on a refusal", async () => {
    const applied = await apply();

    await verify(applied);

    const application = await findApplication(applied.receipt.reference);

    expect(
      (await harness.call("POST", `/admin/shop-applications/${application.id}/review`, {
        actor: adminActor("RISK_ANALYST"),
        body: { decision: "APPROVE", reason: "not my job" },
      })).status,
    ).toBe(403);

    expect(
      (await harness.call("POST", `/admin/shop-applications/${application.id}/review`, {
        actor: reviewer(),
        body: { decision: "REJECT", reason: "no premises", shopCode: "BNG-LAG-999" },
      })).status,
    ).toBe(422);
  });
});

describe("an owner staffing their own shop", () => {
  const openShop = async (): Promise<ShopOwnerCredentials> => {
    const applied = await apply();

    await verify(applied);

    const application = await findApplication(applied.receipt.reference);
    const approved = await harness.call<{ credentials: ShopOwnerCredentials }>(
      "POST",
      `/admin/shop-applications/${application.id}/review`,
      { actor: reviewer(), body: { decision: "APPROVE", reason: "verified" } },
    );

    return approved.body.credentials;
  };

  const ownerActor = async (credentials: ShopOwnerCredentials) => {
    const session = await harness.call<{ cashier: { id: string; shopId: string; role: "OWNER" } }>(
      "POST",
      "/shop/auth/login",
      {
        body: {
          shopCode: credentials.shopCode,
          username: credentials.username,
          password: credentials.temporaryPassword,
          pin: credentials.temporaryPin,
        },
      },
    );

    return cashierActor({ ...session.body.cashier, status: "ACTIVE" } as never);
  };

  it("creates a cashier and refuses one at the owner's own level", async () => {
    const credentials = await openShop();
    const actor = await ownerActor(credentials);

    const created = await harness.call<CashierCredentials>("POST", "/shop/cashiers", {
      actor,
      body: { username: "bisi", displayName: "Bisi Adeyemi", role: "CASHIER" },
    });

    expect(created.status).toBe(201);
    expect(created.body.temporaryPin).toMatch(/^\d{6}$/u);

    const owner = await harness.call("POST", "/shop/cashiers", {
      actor,
      body: { username: "rival", displayName: "Rival Owner", role: "OWNER" },
    });

    expect(owner.status).toBe(403);
  });

  it("refuses a cashier and a manager", async () => {
    const credentials = await openShop();
    const actor = await ownerActor(credentials);

    await harness.call("POST", "/shop/cashiers", {
      actor,
      body: { username: "kunle", displayName: "Kunle Ojo", role: "MANAGER" },
    });

    for (const role of ["CASHIER", "MANAGER"] as const) {
      const answer = await harness.call("POST", "/shop/cashiers", {
        actor: { ...actor, role, permissions: role === "MANAGER" ? ["cashiers:read", "cash:transfer"] : [] },
        body: { username: `x${role.toLowerCase()}`, displayName: "Someone", role: "CASHIER" },
      });

      expect(answer.status).toBe(403);
    }
  });

  it("never lets an owner reach a cashier in another shop", async () => {
    const [first, second] = await Promise.all([openShop(), openShop()]);
    const firstOwner = await ownerActor(first);
    const secondOwner = await ownerActor(second);

    const created = await harness.call<CashierCredentials>("POST", "/shop/cashiers", {
      actor: secondOwner,
      body: { username: "theirs", displayName: "Their Cashier", role: "CASHIER" },
    });

    expect(created.status).toBe(201);

    const cashiers = await harness.call<{ items: { id: string; username: string }[] }>("GET", "/shop/cashiers", {
      actor: secondOwner,
    });
    const target = cashiers.body.items.find((cashier) => cashier.username === "theirs");

    // Reported as absent, so a guessed id cannot confirm it exists.
    const answer = await harness.call("POST", `/shop/cashiers/${String(target?.id)}/status`, {
      actor: firstOwner,
      body: { status: "SUSPENDED", reason: "not mine to suspend" },
    });

    expect(answer.status).toBe(404);
  });

  it("refuses an owner acting on their own account", async () => {
    const credentials = await openShop();
    const actor = await ownerActor(credentials);

    const answer = await harness.call("POST", `/shop/cashiers/${actor.id}/status`, {
      actor,
      body: { status: "SUSPENDED", reason: "locking myself out" },
    });

    expect(answer.status).toBe(403);
  });

  it("resets a cashier's credentials and signs them out", async () => {
    const credentials = await openShop();
    const actor = await ownerActor(credentials);

    const created = await harness.call<CashierCredentials>("POST", "/shop/cashiers", {
      actor,
      body: { username: "tunde", displayName: "Tunde Bakare", role: "CASHIER" },
    });

    const cashiers = await harness.call<{ items: { id: string; username: string }[] }>("GET", "/shop/cashiers", { actor });
    const target = cashiers.body.items.find((cashier) => cashier.username === "tunde");

    const reset = await harness.call<CashierCredentials>(
      "POST",
      `/shop/cashiers/${String(target?.id)}/reset-credentials`,
      { actor },
    );

    expect(reset.status).toBe(200);
    expect(reset.body.temporaryPassword).not.toBe(created.body.temporaryPassword);

    const stale = await harness.call("POST", "/shop/auth/login", {
      body: {
        shopCode: credentials.shopCode,
        username: "tunde",
        password: created.body.temporaryPassword,
        pin: created.body.temporaryPin,
      },
    });

    expect(stale.status).toBe(401);
  });
});
