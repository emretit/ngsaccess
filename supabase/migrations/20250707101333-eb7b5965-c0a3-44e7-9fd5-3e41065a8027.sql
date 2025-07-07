-- Companies tablosuna eksik şirket bilgisi alanlarını ekle
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tax_number TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TRY';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Index'ler ekle
CREATE INDEX IF NOT EXISTS idx_companies_project_id ON public.companies(project_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON public.companies(name);

-- RLS politikalarını güncelle
DROP POLICY IF EXISTS "Users can manage companies in their projects" ON public.companies;

CREATE POLICY "Users can manage companies in their projects"
ON public.companies
FOR ALL
USING (
  project_id IN (
    SELECT up.project_id 
    FROM user_projects up 
    WHERE up.user_id = auth.uid()
  ) 
  OR is_super_admin()
)
WITH CHECK (
  project_id IN (
    SELECT up.project_id 
    FROM user_projects up 
    WHERE up.user_id = auth.uid()
  ) 
  OR is_super_admin()
);