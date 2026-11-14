UPDATE public.users
SET role = 'accountant'
WHERE role = 'manager'
  AND lower(btrim(email)) NOT IN (
      'limon.iz.kosmosa.999@gmail.com',
      'ashymova.aiperi@gmail.com'
  );
