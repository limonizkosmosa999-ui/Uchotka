ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_manager_id ON public.users(manager_id);

CREATE TABLE IF NOT EXISTS public.company_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
    file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
    received_address TEXT NOT NULL,
    received_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_company_documents_company_received
    ON public.company_documents(company_id, received_at DESC);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_documents TO authenticated;

DROP POLICY IF EXISTS "Company documents select policy" ON public.company_documents;
CREATE POLICY "Company documents select policy"
    ON public.company_documents FOR SELECT
    TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Company documents insert policy" ON public.company_documents;
CREATE POLICY "Company documents insert policy"
    ON public.company_documents FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND (
            public.is_manager()
            OR EXISTS (
                SELECT 1 FROM public.companies company
                WHERE company.id = company_documents.company_id
                  AND company.owner_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Company documents update policy" ON public.company_documents;
CREATE POLICY "Company documents update policy"
    ON public.company_documents FOR UPDATE
    TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Company documents delete policy" ON public.company_documents;
CREATE POLICY "Company documents delete policy"
    ON public.company_documents FOR DELETE
    TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
    );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-documents',
    'company-documents',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Company document files select policy" ON storage.objects;
CREATE POLICY "Company document files select policy"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'company-documents'
        AND EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id::TEXT = (storage.foldername(name))[1]
              AND (company.owner_id = auth.uid() OR public.is_manager())
        )
    );

DROP POLICY IF EXISTS "Company document files insert policy" ON storage.objects;
CREATE POLICY "Company document files insert policy"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'company-documents'
        AND EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id::TEXT = (storage.foldername(name))[1]
              AND (company.owner_id = auth.uid() OR public.is_manager())
        )
    );

DROP POLICY IF EXISTS "Company document files delete policy" ON storage.objects;
CREATE POLICY "Company document files delete policy"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'company-documents'
        AND EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id::TEXT = (storage.foldername(name))[1]
              AND (company.owner_id = auth.uid() OR public.is_manager())
        )
    );
