
-- Zones tablosu için RLS politikaları
CREATE POLICY "Users can view zones in their projects" 
ON public.zones 
FOR SELECT 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Users can insert zones in their projects" 
ON public.zones 
FOR INSERT 
WITH CHECK (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Users can update zones in their projects" 
ON public.zones 
FOR UPDATE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Users can delete zones in their projects" 
ON public.zones 
FOR DELETE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

-- Doors tablosu için RLS politikaları
CREATE POLICY "Users can view doors in their projects" 
ON public.doors 
FOR SELECT 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Users can insert doors in their projects" 
ON public.doors 
FOR INSERT 
WITH CHECK (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Users can update doors in their projects" 
ON public.doors 
FOR UPDATE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "Users can delete doors in their projects" 
ON public.doors 
FOR DELETE 
USING (
  project_id IN (
    SELECT up.project_id 
    FROM public.user_projects up 
    WHERE up.user_id = auth.uid()
  )
  OR 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
