-- Check the actual constraint definition for tasks table
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'tasks' 
AND n.nspname = 'public'
AND contype = 'c';

-- Also check what values currently exist in the status column
SELECT DISTINCT status FROM tasks;
