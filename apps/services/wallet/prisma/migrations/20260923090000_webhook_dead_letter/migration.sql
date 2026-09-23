-- A webhook that fails to apply used to leave nothing behind but an id: no body to
-- replay, no attempt count, no record that it failed. These columns make a failed
-- event replayable and countable, so a lost payment is visible rather than silent.

ALTER TABLE "payment_webhook_events"
  ADD COLUMN "payload_encrypted" text,
  ADD COLUMN "signature_verified" boolean NOT NULL DEFAULT true,
  ADD COLUMN "attempts" integer NOT NULL DEFAULT 0,
  ADD COLUMN "last_error" varchar(200),
  ADD COLUMN "next_attempt_at" timestamptz(3),
  ADD COLUMN "abandoned_at" timestamptz(3);

ALTER TABLE "payment_webhook_events"
  ADD CONSTRAINT "payment_webhook_events_attempts_not_negative" CHECK ("attempts" >= 0),
  -- A done event keeps no body: the payload is cleared on success or abandonment.
  ADD CONSTRAINT "payment_webhook_events_payload_released" CHECK (
    ("processed_at" IS NULL AND "abandoned_at" IS NULL) OR "payload_encrypted" IS NULL);

-- Only the rows the retry job scans.
CREATE INDEX "payment_webhook_events_next_attempt_idx"
  ON "payment_webhook_events" ("next_attempt_at")
  WHERE "next_attempt_at" IS NOT NULL;
