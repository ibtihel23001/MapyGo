-- ============================================================
-- Run this in Railway Postgres Console BEFORE redeploying
-- It drops the old tickets table and recreates it cleanly.
-- WARNING: This deletes all existing ticket data.
-- ============================================================

-- 1. Drop dependent tables first (foreign keys point to tickets)
ALTER TABLE IF EXISTS "transactions" DROP CONSTRAINT IF EXISTS "transactions_ticket_id_fkey";
ALTER TABLE IF EXISTS "refunds"       DROP CONSTRAINT IF EXISTS "refunds_ticket_id_fkey";

-- 2. Drop old tickets table
DROP TABLE IF EXISTS "tickets";

-- 3. Drop old enum and create new one
DROP TYPE IF EXISTS "TicketStatus";
CREATE TYPE "TicketStatus" AS ENUM ('pending', 'refunded', 'approved', 'rejete');

-- 4. Recreate tickets table with the clean schema
CREATE TABLE "tickets" (
  "id"             SERIAL PRIMARY KEY,
  "agency_id"      INTEGER NOT NULL,
  "ticket_number"  TEXT    NOT NULL UNIQUE,
  "pnr"            TEXT,
  "passenger_name" TEXT    NOT NULL,
  "departure_date" TIMESTAMP(3),
  "arrive_date"    TIMESTAMP(3),
  "status"         "TicketStatus" NOT NULL DEFAULT 'approved',
  "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "airline"        TEXT,
  "air_fare"       DECIMAL(65,30),
  "ttc"            DECIMAL(65,30),

  CONSTRAINT "tickets_agency_id_fkey"
    FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE
);

-- 5. Restore foreign keys from refunds and transactions
ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id");

-- 6. Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tickets_updated_at ON "tickets";
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON "tickets"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Done!
SELECT 'Migration complete. tickets table is ready.' AS result;
