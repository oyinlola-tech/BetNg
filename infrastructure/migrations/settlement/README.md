# settlement service migrations

SQL migrations for the **settlement** service's own database (`betng_settlement`).

Files are applied in filename order and recorded in `schema_migrations`, so
each runs exactly once. Name them `NNNN_description.sql`, for example
`0001_create_settlement_tables.sql`.

Apply them with:

```bash
pnpm db:migrate
```

## Why this directory is empty

This phase establishes the migration mechanism, the per-service database and
the ownership boundary. It does not ship a domain schema, because the domain
models are still being settled and a schema written now would be migrated
away before anything used it.

The runner is real and works — running it against an empty directory creates
`schema_migrations` and reports zero pending migrations. The first domain
migration lands with the repository that needs it.

## The rule this directory enforces

Only the settlement service writes here, and only the settlement service connects to
`betng_settlement`. Another service that needs this data asks for it over the settlement
service's API. See `docs/architecture.md`.
