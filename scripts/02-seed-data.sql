-- Insert sample predefined items for new users
-- Note: These will be created when users first sign up and the initializeDefaultItems function runs
-- This file is kept for reference but the actual seeding happens in the storage.js file

-- Sample data that would be created:
-- INSERT INTO predefined_items (name, description, created_by) VALUES
-- ('Research Hours', 'Research and analysis tasks', user_id),
-- ('Development Hours', 'Software development tasks', user_id),
-- ('Testing Sessions', 'Quality assurance and testing', user_id),
-- ('Documentation Pages', 'Documentation and writing', user_id),
-- ('Review Items', 'Code and content review', user_id);

-- The actual seeding is handled automatically when users create accounts
-- through the initializeDefaultItems function in lib/storage.js
