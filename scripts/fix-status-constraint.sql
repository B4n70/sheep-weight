-- Drop the existing constraint if it exists
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add the correct constraint with the values the code uses
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled'));
