-- One-off: remove every ticket except those titled "Update Framer Homepage Design".
-- Child rows (assignees, comments, audit_log, collaborators) cascade from tickets FKs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tickets WHERE title = 'Update Framer Homepage Design' LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'No ticket with title "Update Framer Homepage Design"; aborting so we do not delete all rows.';
  END IF;
END $$;

DELETE FROM tickets
WHERE title IS DISTINCT FROM 'Update Framer Homepage Design';
