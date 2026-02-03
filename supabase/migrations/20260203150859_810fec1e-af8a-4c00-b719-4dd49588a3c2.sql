-- Drop existing constraint
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_enrollment_id_fkey;

-- Add new constraint with ON DELETE SET NULL
ALTER TABLE leads
  ADD CONSTRAINT leads_enrollment_id_fkey
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL;