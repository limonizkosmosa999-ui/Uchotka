CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requested_role TEXT := lower(COALESCE(NEW.raw_user_meta_data->>'role', 'accountant'));
    normalized_email TEXT := lower(btrim(NEW.email));
    assigned_role TEXT;
BEGIN
    assigned_role := CASE
        WHEN requested_role = 'manager'
         AND normalized_email IN (
             'limon.iz.kosmosa.999@gmail.com',
             'ashymova.aiperi@gmail.com'
         )
        THEN 'manager'
        ELSE 'accountant'
    END;

    INSERT INTO public.users (id, email, full_name, role, notification_email)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        assigned_role,
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$;

UPDATE public.users
SET role = CASE
    WHEN lower(btrim(email)) IN (
        'limon.iz.kosmosa.999@gmail.com',
        'ashymova.aiperi@gmail.com'
    ) THEN 'manager'
    ELSE 'accountant'
END
WHERE role = 'manager'
   OR lower(btrim(email)) IN (
       'limon.iz.kosmosa.999@gmail.com',
       'ashymova.aiperi@gmail.com'
   );
