-- Create user profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create predefined items table
CREATE TABLE IF NOT EXISTS public.items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  unit TEXT DEFAULT 'units',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create task_items table (junction table for tasks and items)
CREATE TABLE IF NOT EXISTS public.task_items (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES public.tasks(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES public.items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  completed_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, item_id)
);

-- Create audit_trail table for tracking updates
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Create policies for collaborative access
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Anyone can view items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create items" ON public.items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tasks" ON public.tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update tasks" ON public.tasks FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete tasks" ON public.tasks FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view task items" ON public.task_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage task items" ON public.task_items FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can view audit trail" ON public.audit_trail FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create audit entries" ON public.audit_trail FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert some default items
INSERT INTO public.items (name, description, unit) VALUES
  ('Concrete Blocks', 'Standard concrete building blocks', 'blocks'),
  ('Steel Rebar', 'Reinforcement steel bars', 'bars'),
  ('Cement Bags', '50kg cement bags', 'bags'),
  ('Bricks', 'Clay building bricks', 'bricks'),
  ('Sand', 'Construction sand', 'cubic meters'),
  ('Gravel', 'Construction gravel', 'cubic meters'),
  ('Lumber', 'Construction lumber', 'boards'),
  ('Roofing Tiles', 'Clay or concrete roofing tiles', 'tiles'),
  ('Windows', 'Standard windows', 'units'),
  ('Doors', 'Interior/exterior doors', 'units')
ON CONFLICT (name) DO NOTHING;
