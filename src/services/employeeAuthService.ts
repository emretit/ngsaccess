
import { supabase } from '@/integrations/supabase/client';

export interface LoginCredentials {
  email?: string;
  phone?: string;
  password: string;
}

export interface EmployeeUser {
  id: number;
  email: string;
  name: string;
  card_number: string;
}

export interface AuthResponse {
  user: EmployeeUser | null;
  error: string | null;
}

export const employeeLogin = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const { email, phone, password } = credentials;
    
    if (!email && !phone) {
      return { user: null, error: 'Email or phone is required' };
    }
    
    const response = await fetch(`https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/employee-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqdWRzZ2hod21uc25uZG5zd2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMzk1NTMsImV4cCI6MjA1MTgxNTU1M30.9mA6Q1JDCszfH3nujNpGWd36M4qxZ-L38GPTaNIsjVg`
      },
      body: JSON.stringify({ email, phone, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { user: null, error: data.error || 'Login failed' };
    }
    
    // Store the session in localStorage
    localStorage.setItem('employeeAuthSession', JSON.stringify(data.session));
    
    return { user: data.user, error: null };
  } catch (error) {
    console.error('Login error:', error);
    return { user: null, error: error.message || 'Login failed' };
  }
};

export const employeeLogout = (): void => {
  localStorage.removeItem('employeeAuthSession');
  window.location.href = '/employee-login';
};

export const getCurrentEmployeeUser = (): EmployeeUser | null => {
  const sessionStr = localStorage.getItem('employeeAuthSession');
  if (!sessionStr) return null;
  
  try {
    const session = JSON.parse(sessionStr);
    return session.user_metadata as EmployeeUser;
  } catch (error) {
    console.error('Error parsing employee session:', error);
    return null;
  }
};

export const getEmployeeAuthToken = (): string | null => {
  const sessionStr = localStorage.getItem('employeeAuthSession');
  if (!sessionStr) return null;
  
  try {
    const session = JSON.parse(sessionStr);
    return session.access_token;
  } catch (error) {
    console.error('Error getting employee auth token:', error);
    return null;
  }
};

export const fetchEmployeeRecords = async () => {
  try {
    const token = getEmployeeAuthToken();
    
    if (!token) {
      return { records: null, error: 'Authentication required' };
    }
    
    const response = await fetch(`https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/employee-records`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { records: null, error: data.error || 'Failed to fetch records' };
    }
    
    return { records: data.records, error: null };
  } catch (error) {
    console.error('Error fetching employee records:', error);
    return { records: null, error: error.message || 'Failed to fetch records' };
  }
};

export const isEmployeeAuthenticated = (): boolean => {
  return !!getCurrentEmployeeUser();
};
