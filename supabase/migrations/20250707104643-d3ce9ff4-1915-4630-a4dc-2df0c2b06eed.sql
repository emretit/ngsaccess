-- Companies tablosunda project_id için unique constraint ekle
-- Her proje için sadece bir şirket olmalı
ALTER TABLE public.companies 
ADD CONSTRAINT unique_companies_project_id UNIQUE (project_id);

-- General settings tablosunda da project_id için unique constraint ekle
-- Her proje için sadece bir genel ayar seti olmalı
ALTER TABLE public.general_settings 
ADD CONSTRAINT unique_general_settings_project_id UNIQUE (project_id);