
-- Create security definer functions to prevent infinite recursion in RLS policies

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if current user is super admin
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if current user has access to a specific project
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id_param INTEGER)
RETURNS BOOLEAN AS $$
  SELECT 
    CASE 
      WHEN public.is_current_user_super_admin() THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM public.project_users 
        WHERE user_id = auth.uid() AND project_id = project_id_param
      )
    END;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if current user is admin of a specific project
CREATE OR REPLACE FUNCTION public.user_is_project_admin(project_id_param INTEGER)
RETURNS BOOLEAN AS $$
  SELECT 
    CASE 
      WHEN public.is_current_user_super_admin() THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM public.project_users 
        WHERE user_id = auth.uid() 
        AND project_id = project_id_param 
        AND is_admin = TRUE
      )
    END;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to get user's accessible project IDs
CREATE OR REPLACE FUNCTION public.get_user_accessible_project_ids()
RETURNS INTEGER[] AS $$
  SELECT 
    CASE 
      WHEN public.is_current_user_super_admin() THEN 
        ARRAY(SELECT id FROM public.projects WHERE is_active = TRUE)
      ELSE 
        ARRAY(
          SELECT project_id FROM public.project_users 
          WHERE user_id = auth.uid()
        )
    END;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update RLS policies for project_users table to use security definer functions
DROP POLICY IF EXISTS "Users can view their own project assignments" ON public.project_users;
DROP POLICY IF EXISTS "Super admins can view all project assignments" ON public.project_users;
DROP POLICY IF EXISTS "Users can insert their own project assignments" ON public.project_users;
DROP POLICY IF EXISTS "Super admins can manage all project assignments" ON public.project_users;

-- New policies using security definer functions
CREATE POLICY "Users can view accessible project assignments" 
ON public.project_users FOR SELECT 
USING (
  public.is_current_user_super_admin() OR 
  user_id = auth.uid()
);

CREATE POLICY "Super admins can insert project assignments" 
ON public.project_users FOR INSERT 
WITH CHECK (public.is_current_user_super_admin());

CREATE POLICY "Super admins can update project assignments" 
ON public.project_users FOR UPDATE 
USING (public.is_current_user_super_admin());

CREATE POLICY "Super admins can delete project assignments" 
ON public.project_users FOR DELETE 
USING (public.is_current_user_super_admin());

-- Update RLS policies for users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Super admins can manage users" ON public.users;

CREATE POLICY "Users can view their own profile" 
ON public.users FOR SELECT 
USING (id = auth.uid());

CREATE POLICY "Super admins can view all users" 
ON public.users FOR SELECT 
USING (public.is_current_user_super_admin());

CREATE POLICY "Super admins can update users" 
ON public.users FOR UPDATE 
USING (public.is_current_user_super_admin());

CREATE POLICY "Super admins can delete users" 
ON public.users FOR DELETE 
USING (public.is_current_user_super_admin());

-- Update RLS policies for projects table
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
DROP POLICY IF EXISTS "Super admins can manage projects" ON public.projects;

CREATE POLICY "Users can view accessible projects" 
ON public.projects FOR SELECT 
USING (
  is_active = TRUE AND (
    public.is_current_user_super_admin() OR 
    id = ANY(public.get_user_accessible_project_ids())
  )
);

CREATE POLICY "Super admins can insert projects" 
ON public.projects FOR INSERT 
WITH CHECK (public.is_current_user_super_admin());

CREATE POLICY "Super admins can update projects" 
ON public.projects FOR UPDATE 
USING (public.is_current_user_super_admin());

CREATE POLICY "Super admins can delete projects" 
ON public.projects FOR DELETE 
USING (public.is_current_user_super_admin());
