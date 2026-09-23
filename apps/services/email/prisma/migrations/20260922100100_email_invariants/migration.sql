-- Constraints and triggers Prisma cannot express.
-- Delivery history is append-only: nothing, this service included, may rewrite what a provider reported.

-- Addresses are stored lowercase so the suppression hash is one value per mailbox, not one per spelling.
ALTER TABLE "email_messages"
  ADD CONSTRAINT "email_messages_address_lowercase" CHECK ("to_address" = lower("to_address")),
  ADD CONSTRAINT "email_messages_address_shape" CHECK ("to_address" LIKE '%_@_%'),
  ADD CONSTRAINT "email_messages_hash_hex" CHECK ("to_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "email_messages_attempts_sane" CHECK ("attempts" >= 0 AND "attempts" <= 100),
  ADD CONSTRAINT "email_messages_subject_present" CHECK (length(btrim("subject")) > 0),
  ADD CONSTRAINT "email_messages_tags_capped" CHECK (cardinality("tags") <= 10);

ALTER TABLE "email_suppressions"
  ADD CONSTRAINT "email_suppressions_address_lowercase" CHECK ("address" = lower("address")),
  ADD CONSTRAINT "email_suppressions_hash_hex" CHECK ("address_hash" ~ '^[0-9a-f]{64}$');

-- A message only ever moves forward. QUEUED is the only status a row is created in, and a terminal
-- status is final: a late duplicate event cannot walk DELIVERED back to SENT.
CREATE OR REPLACE FUNCTION "email_messages_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'email_messages rows are never deleted' USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."id" <> OLD."id"
     OR NEW."to_hash" <> OLD."to_hash"
     OR NEW."template" <> OLD."template"
     OR NEW."idempotency_key" <> OLD."idempotency_key"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'email_messages identity and idempotency key are immutable' USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD."status" IN ('DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED') AND NEW."status" <> OLD."status" THEN
    RAISE EXCEPTION 'email_messages status % is terminal', OLD."status" USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD."status" = 'SENT' AND NEW."status" = 'QUEUED' THEN
    RAISE EXCEPTION 'email_messages status cannot move back to QUEUED' USING ERRCODE = 'restrict_violation';
  END IF;

  -- The provider's id is write-once: a second send under the same key is a bug, not an update.
  IF OLD."provider_id" IS NOT NULL AND NEW."provider_id" IS DISTINCT FROM OLD."provider_id" THEN
    RAISE EXCEPTION 'email_messages provider id is write-once' USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "email_messages_guard"
BEFORE UPDATE OR DELETE ON "email_messages"
FOR EACH ROW EXECUTE FUNCTION "email_messages_guard"();

-- Events are append-only apart from the one column that records that we finished processing them.
CREATE OR REPLACE FUNCTION "email_events_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'email_events is append-only' USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW."id" <> OLD."id"
     OR NEW."provider" <> OLD."provider"
     OR NEW."event_id" <> OLD."event_id"
     OR NEW."event_type" <> OLD."event_type"
     OR NEW."received_at" <> OLD."received_at" THEN
    RAISE EXCEPTION 'email_events rows are immutable once received' USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "email_events_append_only"
BEFORE UPDATE OR DELETE ON "email_events"
FOR EACH ROW EXECUTE FUNCTION "email_events_append_only"();

CREATE OR REPLACE FUNCTION "email_no_truncate"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'delivery history may not be truncated' USING ERRCODE = 'restrict_violation';
END
$$;

CREATE TRIGGER "email_messages_no_truncate"
BEFORE TRUNCATE ON "email_messages"
FOR EACH STATEMENT EXECUTE FUNCTION "email_no_truncate"();

CREATE TRIGGER "email_events_no_truncate"
BEFORE TRUNCATE ON "email_events"
FOR EACH STATEMENT EXECUTE FUNCTION "email_no_truncate"();

-- An address and its hash are personal data; the reader role that every other service holds may not read them.
REVOKE ALL ON "email_messages", "email_suppressions" FROM betng_reader;
