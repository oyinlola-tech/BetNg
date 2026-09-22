import type { StatementJob, StatementRequest } from "@betng/contracts";
import type { Logger } from "@betng/service-kit";
import { STATEMENT } from "../../constants/payments.constant.js";
import { LEDGER_ENTRY_TYPES } from "../../constants/index.js";
import { paymentErrors } from "../../errors/index.js";
import type { StatementJobRow, StatementsRepository } from "../../repositories/statements.repository.js";
import { renderCsv, renderPdf } from "../../statements/statement.render.js";
import type { StorageProvider } from "../../storage/s3.storage.js";
import { toStatementJob, utcDayRange, utcToday } from "../../utils/index.js";

export interface StatementsServiceDeps {
  readonly statements: StatementsRepository;
  readonly storage: StorageProvider | undefined;
  readonly logger: Logger;
}

const DAY_MS = 86_400_000;
const LEASE_MS = 5 * 60_000;
const NOT_CONFIGURED = "Statement storage is not configured on this platform.";
const GENERATION_FAILED = "The statement could not be generated.";

const KNOWN_TYPES: ReadonlySet<string> = new Set<string>(LEDGER_ENTRY_TYPES);

export class StatementsService {
  private readonly deps: StatementsServiceDeps;

  public constructor(deps: StatementsServiceDeps) {
    this.deps = deps;
  }

  public async request(userId: string, request: StatementRequest, requestId: string): Promise<StatementJob> {
    const from = utcDayRange(request.from);
    const to = utcDayRange(request.to);

    if (from === undefined || to === undefined || from.from > to.from) {
      throw paymentErrors.invalid("Choose a start date on or before the end date.");
    }

    if (to.from >= utcToday().to) {
      throw paymentErrors.invalid("A statement cannot end in the future.");
    }

    const days = Math.round((to.to.getTime() - from.from.getTime()) / DAY_MS);

    if (days > STATEMENT.MAX_RANGE_DAYS) {
      throw paymentErrors.invalid(`A statement covers at most ${String(STATEMENT.MAX_RANGE_DAYS)} days.`);
    }

    const types = [...new Set(request.types ?? [])];

    if (types.some((type) => !KNOWN_TYPES.has(type))) {
      throw paymentErrors.invalid("Contains an unknown transaction type.");
    }

    const job = await this.deps.statements.create({ userId, format: request.format, from: from.from, to: to.from, types });

    if (this.deps.storage === undefined) {
      return this.view(await this.deps.statements.fail(job.id, NOT_CONFIGURED));
    }

    if (days <= STATEMENT.SYNC_RANGE_DAYS) {
      await this.process(job.id, requestId);
    } else {
      setImmediate(() => {
        void this.process(job.id, requestId);
      });
    }

    return this.get(userId, job.id);
  }

  public async get(userId: string, id: string): Promise<StatementJob> {
    const job = await this.deps.statements.findOwned(userId, id);

    if (job === undefined) {
      throw paymentErrors.notFound("No statement matches that id.");
    }

    return this.view(job);
  }

  private view(job: StatementJobRow): StatementJob {
    if (job.status !== "READY" || job.storageKey === null) {
      return toStatementJob(job, job.status === "READY" ? "FAILED" : (job.status as StatementJob["status"]));
    }

    if (this.deps.storage === undefined || (job.readyAt ?? job.createdAt).getTime() + STATEMENT.RETENTION_MS < Date.now()) {
      return toStatementJob(job, "EXPIRED");
    }

    const expiresAt = new Date(Date.now() + STATEMENT.DOWNLOAD_TTL_SECONDS * 1000);
    const url = this.deps.storage.presignGet(job.storageKey, STATEMENT.DOWNLOAD_TTL_SECONDS, {
      filename: `betng-statement-${job.fromDate.toISOString().slice(0, 10)}-${job.toDate.toISOString().slice(0, 10)}.${job.format.toLowerCase()}`,
    });

    return toStatementJob(job, "READY", { url, expiresAt });
  }

  /** Runs one claimed job to READY or, after the last attempt, FAILED. Never produces a link without a stored file. */
  public async process(id: string | undefined, requestId: string): Promise<boolean> {
    const job = await this.deps.statements.claim(id, LEASE_MS);

    if (job === undefined) {
      return false;
    }

    const storage = this.deps.storage;

    if (storage === undefined) {
      await this.deps.statements.fail(job.id, NOT_CONFIGURED);

      return true;
    }

    try {
      const data = await this.deps.statements.ledger(
        job.userId,
        job.fromDate,
        new Date(job.toDate.getTime() + DAY_MS),
        job.types,
        STATEMENT.MAX_ROWS,
      );
      const document = {
        holder: await this.deps.statements.holderName(job.userId),
        from: job.fromDate.toISOString().slice(0, 10),
        to: job.toDate.toISOString().slice(0, 10),
        generatedAt: new Date(),
        ...data,
      };
      const pdf = job.format === "PDF";
      const key = `statements/${job.userId}/${job.id}.${pdf ? "pdf" : "csv"}`;

      await storage.put(key, pdf ? renderPdf(document) : renderCsv(document), pdf ? "application/pdf" : "text/csv; charset=utf-8");
      await this.deps.statements.complete(job.id, key);
    } catch (error) {
      this.deps.logger.warn("Statement generation failed", {
        requestId,
        event: "statement_failed",
        error: error instanceof Error ? error.message.slice(0, 120) : "unknown",
      });

      if (job.attempts >= STATEMENT.MAX_ATTEMPTS) {
        await this.deps.statements.fail(job.id, GENERATION_FAILED);
      } else {
        await this.deps.statements.release(job.id);
      }
    }

    return true;
  }

  public async runQueued(requestId: string): Promise<number> {
    let processed = 0;

    while (processed < 5 && (await this.process(undefined, requestId))) {
      processed += 1;
    }

    return processed;
  }
}
