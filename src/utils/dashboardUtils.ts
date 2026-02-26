// dashboardUtils.ts - Bu dosya artık kullanılmıyor.
// Dashboard verileri convex/dashboard.ts'ten useDashboard.ts hook'u ile gelir.
// Geriye dönük uyumluluk için tipleri export ediyoruz.

export interface DashboardStats {
  employees: number;
  devices: number;
  cardReadings: number;
  pendingRequests: number;
}

export interface CardReading {
  id: string;
  cardNo: string;
  employeeName?: string;
  accessTime: string;
  accessStatus?: string;
  access_granted?: boolean;
  status?: string;
  device_name?: string;
  device_location?: string;
}

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
  return { employees: 0, devices: 0, cardReadings: 0, pendingRequests: 0 };
};

export const fetchRecentReadings = async (): Promise<CardReading[]> => {
  return [];
};
