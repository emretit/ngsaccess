import { GeneralSettings, GeneralSettingsFormData } from '../types/generalSettings';

export const normalizeWebsiteUrl = (url: string): string => {
  if (!url) return url;
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  
  return url;
};

export const convertFormDataToSettings = (formData: FormData): GeneralSettings => {
  const websiteUrl = normalizeWebsiteUrl(formData.get('website') as string);
  
  return {
    company_name: formData.get('companyName') as string,
    tax_number: formData.get('taxNumber') as string,
    address: formData.get('address') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    website: websiteUrl,
    system_language: formData.get('language') as string,
    timezone: formData.get('timezone') as string,
    date_format: formData.get('dateFormat') as string,
    currency: formData.get('currency') as string,
    dark_mode: formData.get('darkMode') === 'on',
    notifications_enabled: formData.get('notifications') === 'on',
    working_hours_start: formData.get('workingHoursStart') as string,
    working_hours_end: formData.get('workingHoursEnd') as string,
  };
};

export const validateSettings = (settings: GeneralSettings): string[] => {
  const errors: string[] = [];
  
  if (!settings.company_name?.trim()) {
    errors.push('Şirket adı gereklidir');
  }
  
  if (settings.email && !settings.email.includes('@')) {
    errors.push('Geçerli bir e-posta adresi girin');
  }
  
  return errors;
};