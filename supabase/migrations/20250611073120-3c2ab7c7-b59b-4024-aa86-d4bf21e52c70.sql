
-- group_devices tablosu için RLS politikalarını etkinleştir
ALTER TABLE public.group_devices ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi projelerinin group_devices kayıtlarını görebilir
CREATE POLICY "Users can view group devices in their projects" 
ON public.group_devices 
FOR SELECT 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
);

-- Kullanıcılar kendi projelerine group_devices ekleyebilir
CREATE POLICY "Users can insert group devices in their projects" 
ON public.group_devices 
FOR INSERT 
WITH CHECK (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
);

-- Kullanıcılar kendi projelerinin group_devices kayıtlarını güncelleyebilir
CREATE POLICY "Users can update group devices in their projects" 
ON public.group_devices 
FOR UPDATE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
);

-- Kullanıcılar kendi projelerinin group_devices kayıtlarını silebilir
CREATE POLICY "Users can delete group devices in their projects" 
ON public.group_devices 
FOR DELETE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
);
