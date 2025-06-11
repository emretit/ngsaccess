
-- departments tablosu için RLS politikalarını etkinleştir
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi projelerinin departmanlarını görebilir
CREATE POLICY "Users can view departments in their projects" 
ON public.departments 
FOR SELECT 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'super_admin'
  )
);

-- Kullanıcılar kendi projelerine departman ekleyebilir
CREATE POLICY "Users can insert departments in their projects" 
ON public.departments 
FOR INSERT 
WITH CHECK (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'super_admin'
  )
);

-- Kullanıcılar kendi projelerinin departmanlarını güncelleyebilir
CREATE POLICY "Users can update departments in their projects" 
ON public.departments 
FOR UPDATE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'super_admin'
  )
);

-- Kullanıcılar kendi projelerinin departmanlarını silebilir
CREATE POLICY "Users can delete departments in their projects" 
ON public.departments 
FOR DELETE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'super_admin'
  )
);
