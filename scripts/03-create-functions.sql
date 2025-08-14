-- Creating helper functions for TaskTracker Pro

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update task status based on item completion
CREATE OR REPLACE FUNCTION public.update_task_status()
RETURNS TRIGGER AS $$
DECLARE
    total_items INTEGER;
    completed_items INTEGER;
    task_status TEXT;
BEGIN
    -- Get total items and completed items for the task
    SELECT 
        COUNT(*),
        COUNT(CASE WHEN completed_quantity >= quantity THEN 1 END)
    INTO total_items, completed_items
    FROM public.task_items
    WHERE task_id = COALESCE(NEW.task_id, OLD.task_id);
    
    -- Determine new status
    IF completed_items = 0 THEN
        task_status := 'pending';
    ELSIF completed_items = total_items THEN
        task_status := 'completed';
    ELSE
        task_status := 'in-progress';
    END IF;
    
    -- Update task status
    UPDATE public.tasks 
    SET status = task_status, updated_at = NOW()
    WHERE id = COALESCE(NEW.task_id, OLD.task_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update task status when task items change
DROP TRIGGER IF EXISTS on_task_items_changed ON public.task_items;
CREATE TRIGGER on_task_items_changed
    AFTER INSERT OR UPDATE OR DELETE ON public.task_items
    FOR EACH ROW EXECUTE FUNCTION public.update_task_status();
