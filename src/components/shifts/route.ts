import { useLocation, useNavigate } from "react-router-dom";

export const SHIFT_PLAN_PATH = "/pdks-records/plan";

export function useOpenShiftPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  return () => navigate(SHIFT_PLAN_PATH, { state: { fromRecords: location.pathname === "/pdks-records" } });
}
