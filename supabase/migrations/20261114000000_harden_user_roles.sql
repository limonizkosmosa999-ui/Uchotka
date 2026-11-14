CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, notification_email)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'accountant',
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

REVOKE UPDATE ON TABLE public.users FROM authenticated;
REVOKE UPDATE (id, email, role, manager_id, created_at)
    ON TABLE public.users FROM authenticated;
GRANT UPDATE (full_name, notification_email)
    ON TABLE public.users TO authenticated;
