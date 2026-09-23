import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { addressHash } from "../src/utils/index.js";
import { serviceUrl } from "./support.js";

// These run against the live triggers, so nothing here disables them. Raw SQL, not the typed client:
// Prisma reports a `restrict_violation` as a foreign-key error and hides the trigger's own message.
let prisma: PrismaClient;

async function message(overrides: { address?: string; tags?: readonly string[] } = {}): Promise<string> {
  const id = randomUUID();
  const address = overrides.address ?? "guard@example.test";
  const tags = overrides.tags ?? [];

  await prisma.$executeRaw`
    INSERT INTO email.email_messages
      (id, to_address, to_hash, template, subject, idempotency_key, tags, updated_at)
    VALUES
      (${id}::uuid, ${address}, ${addressHash(address)}, 'notice', 'Guarded',
       ${`guard-${randomUUID()}`}, ${tags}::text[], now())`;

  return id;
}

const refuses = async (run: () => Promise<unknown>, pattern: RegExp): Promise<void> => {
  await expect(run()).rejects.toThrow(pattern);
};

beforeAll(() => {
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: serviceUrl() }, { schema: "email" }) });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("email_messages guard", () => {
  it("refuses a delete and a truncate", async () => {
    const id = await message();

    await refuses(async () => prisma.$executeRaw`DELETE FROM email.email_messages WHERE id = ${id}::uuid`, /never deleted/i);
    await refuses(async () => prisma.$executeRawUnsafe("TRUNCATE email.email_messages CASCADE"), /may not be truncated/i);
  });

  it("refuses a changed idempotency key, template or hash", async () => {
    const id = await message();

    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_messages SET idempotency_key = ${randomUUID()} WHERE id = ${id}::uuid`,
      /immutable/i,
    );
    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_messages SET template = 'verification_code' WHERE id = ${id}::uuid`,
      /immutable/i,
    );
    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_messages SET to_hash = ${addressHash("other@example.test")} WHERE id = ${id}::uuid`,
      /immutable/i,
    );
  });

  it("refuses to move a terminal status, or to walk SENT back to QUEUED", async () => {
    const delivered = await message();

    await prisma.$executeRaw`UPDATE email.email_messages SET status = 'DELIVERED' WHERE id = ${delivered}::uuid`;
    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_messages SET status = 'SENT' WHERE id = ${delivered}::uuid`,
      /terminal/i,
    );

    const sent = await message();

    await prisma.$executeRaw`UPDATE email.email_messages SET status = 'SENT' WHERE id = ${sent}::uuid`;
    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_messages SET status = 'QUEUED' WHERE id = ${sent}::uuid`,
      /back to QUEUED/i,
    );
  });

  it("writes the provider id once", async () => {
    const id = await message();

    await prisma.$executeRaw`UPDATE email.email_messages SET provider_id = 'em_first' WHERE id = ${id}::uuid`;
    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_messages SET provider_id = 'em_second' WHERE id = ${id}::uuid`,
      /write-once/i,
    );
  });

  it("refuses an address that is not lowercase, and more than ten tags", async () => {
    await refuses(async () => message({ address: "Mixed@Example.Test" }), /address_lowercase/i);
    await refuses(
      async () => message({ tags: Array.from({ length: 11 }, (_, index) => `t${String(index)}`) }),
      /tags_capped/i,
    );
  });
});

describe("email_events guard", () => {
  it("is append-only apart from the processed marker", async () => {
    const id = randomUUID();
    const eventId = `evt-${randomUUID()}`;

    await prisma.$executeRaw`
      INSERT INTO email.email_events (id, provider, event_id, event_type)
      VALUES (${id}::uuid, 'sendbyte', ${eventId}, 'email.delivered')`;

    await refuses(
      async () => prisma.$executeRaw`UPDATE email.email_events SET event_type = 'email.bounced' WHERE id = ${id}::uuid`,
      /immutable/i,
    );
    await refuses(async () => prisma.$executeRaw`DELETE FROM email.email_events WHERE id = ${id}::uuid`, /append-only/i);

    // The one write the guard allows.
    await expect(
      prisma.$executeRaw`UPDATE email.email_events SET processed_at = now(), outcome = 'applied' WHERE id = ${id}::uuid`,
    ).resolves.toBe(1);
  });

  it("refuses a second event with the same provider event id", async () => {
    const eventId = `evt-${randomUUID()}`;
    const insert = async () =>
      prisma.$executeRaw`
        INSERT INTO email.email_events (id, provider, event_id, event_type)
        VALUES (${randomUUID()}::uuid, 'sendbyte', ${eventId}, 'email.sent')`;

    await insert();
    await expect(insert()).rejects.toThrow();
  });
});

describe("email_suppressions", () => {
  it("refuses an address that is not lowercase", async () => {
    await refuses(
      async () => prisma.$executeRaw`
        INSERT INTO email.email_suppressions (address_hash, address, reason, source)
        VALUES (${addressHash("Loud@example.test")}, 'Loud@example.test', 'BOUNCE', 'test')`,
      /address_lowercase/i,
    );
  });
});
