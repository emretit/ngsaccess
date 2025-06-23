
-- devices tablosu için RLS politikalarını etkinleştir
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi projelerindeki cihazları görebilir
CREATE POLICY "Users can view devices in their projects" 
ON public.devices 
FOR SELECT 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  -- Super admin tüm cihazları görebilir
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'super_admin'
  )
);

-- Kullanıcılar kendi projelerine cihaz ekleyebilir
CREATE POLICY "Users can insert devices in their projects" 
ON public.devices 
FOR INSERT 
WITH CHECK (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  -- Super admin tüm projelere cihaz ekleyebilir
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'super_admin'
  )
);

-- Kullanıcılar kendi projelerindeki cihazları güncelleyebilir
CREATE POLICY "Users can update devices in their projects" 
ON public.devices 
FOR UPDATE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  -- Super admin tüm cihazları güncelleyebilir
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'super_admin'
  )
);

-- Kullanıcılar kendi projelerindeki cihazları silebilir
CREATE POLICY "Users can delete devices in their projects" 
ON public.devices 
FOR DELETE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  -- Super admin tüm cihazları silebilir
  EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() 
    AND u.role = 'super_admin'
  )
);
