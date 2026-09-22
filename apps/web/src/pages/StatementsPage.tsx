import type { StatementRequest } from "@betng/contracts";
import { DataSourceError } from "@betng/ui-core";
import { Card, SectionHeader, SectionHeading, SkeletonRows } from "@betng/ui-web";
import { StatementFilters } from "../features/statements/StatementFilters";
import { StatementJobCard } from "../features/statements/StatementJobCard";
import { validJobId } from "../features/statements/statementMeta";
import { useCreateStatement, useStatement } from "../features/statements/statementQueries";
import { FlagGuard, ServiceError, isNotImplemented, ServiceUnavailable } from "../features/wallet/ServiceStates";
import { usePageMeta } from "../features/seo";
import { useUrlState } from "../lib/urlState";
import { env, logger } from "../services/runtime";

function Statements(): React.JSX.Element {
  const [params, patch] = useUrlState();
  const jobId = validJobId(params.get("job"));
  const create = useCreateStatement();
  const job = useStatement(jobId);

  const request = async (values: StatementRequest): Promise<void> => {
    try {
      const created = await create.mutateAsync(values);

      patch({ job: created.id });
    } catch (cause) {
      logger.warn("flow", "Statement request failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      throw cause;
    }
  };

  if (isNotImplemented(create.error) || isNotImplemented(job.error)) return <ServiceUnavailable />;

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeading as="h2">Request a statement</SectionHeading>
        <p className="type-small mt-1 mb-4 text-text-muted">The platform prepares the statement from your ledger. Larger periods can take a little while.</p>
        <StatementFilters onSubmit={request} error={create.error ?? undefined} disabled={job.data?.status === "QUEUED"} />
      </Card>
      {jobId !== undefined &&
        (job.data !== undefined ? (
          <StatementJobCard job={job.data} apiUrl={env.apiUrl} allowedHosts={env.uploadHosts} checking={job.isFetching} onCheck={() => void job.refetch()} />
        ) : job.isError ? (
          <Card padding="none">
            <ServiceError error={job.error} onRetry={() => void job.refetch()} compact />
          </Card>
        ) : (
          <Card>
            <SkeletonRows rows={2} />
          </Card>
        ))}
    </div>
  );
}

export function StatementsPage(): React.JSX.Element {
  usePageMeta({ title: "Statements", noindex: true });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SectionHeader as="h1" eyebrow="Wallet" title="Statements" to="/wallet" linkLabel="Wallet" />
      <FlagGuard flag="statementsEnabled" title="Statements are not available yet" description="Downloadable account statements are not switched on for BETNG yet. Your transactions are listed under Transactions.">
        <Statements />
      </FlagGuard>
    </div>
  );
}
