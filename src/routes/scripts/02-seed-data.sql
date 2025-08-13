-- Insert sample predefined items
INSERT INTO predefined_items (name, default_quantity, category) VALUES
('Documentation Review', 1, 'Review'),
('Code Testing', 1, 'Testing'),
('Database Backup', 1, 'Maintenance'),
('Security Audit', 1, 'Security'),
('Performance Analysis', 1, 'Analysis'),
('User Training', 2, 'Training'),
('System Deployment', 1, 'Deployment'),
('Bug Investigation', 1, 'Investigation'),
('Feature Implementation', 1, 'Development'),
('Quality Assurance', 1, 'QA')
ON CONFLICT DO NOTHING;

-- Insert sample users (these will be created via Supabase auth, but we need the role mapping)
-- Note: In production, users will be created through Supabase auth and then added to this table
