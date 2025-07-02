
-- Mail ayarları için tablo oluştur
CREATE TABLE public.mail_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint REFERENCES public.projects(id),
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  smtp_secure boolean DEFAULT true,
  from_email text,
  from_name text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Bildirim ayarları için tablo oluştur
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id bigint REFERENCES public.projects(id),
  email_notifications boolean DEFAULT true,
  late_notifications boolean DEFAULT true,
  report_notifications boolean DEFAULT true,
  system_notifications boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS politikaları ekle
ALTER TABLE public.mail_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- mail_settings için RLS politikaları
CREATE POLICY "Users can manage mail settings in their projects" ON public.mail_settings
  FOR ALL USING (
    project_id IN (
      SELECT up.project_id FROM user_projects up WHERE up.user_id = auth.uid()
    ) OR is_super_admin()
  ) WITH CHECK (
    project_id IN (
      SELECT up.project_id FROM user_projects up WHERE up.user_id = auth.uid()
    ) OR is_super_admin()
  );

-- notification_settings için RLS politikaları
CREATE POLICY "Users can manage notification settings in their projects" ON public.notification_settings
  FOR ALL USING (
    project_id IN (
      SELECT up.project_id FROM user_projects up WHERE up.user_id = auth.uid()
    ) OR is_super_admin()
  ) WITH CHECK (
    project_id IN (
      SELECT up.project_id FROM user_projects up WHERE up.user_id = auth.uid()
    ) OR is_super_admin()
  );

-- Super admin politikaları
CREATE POLICY "Super admins can access all mail settings" ON public.mail_settings
  FOR ALL USING (is_super_admin());

CREATE POLICY "Super admins can access all notification settings" ON public.notification_settings
  FOR ALL USING (is_super_admin());
