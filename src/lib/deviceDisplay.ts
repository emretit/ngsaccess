import type { Device } from '@/types/device';

export function deviceDisplayName(device: { name: string; brand?: string; ideUuid?: string }): string {
  const name = device.name.trim();
  if (device.brand === 'ide_smart' && (!name || name === device.ideUuid)) {
    return `IDE Smart${device.ideUuid ? ` · ${device.ideUuid.slice(-4)}` : ''}`;
  }
  return name || 'Adsız cihaz';
}

export function deviceModel(device: Pick<Device, 'hikModel' | 'brand'>): string {
  return device.hikModel?.trim() || 'Model bilgisi yok';
}

export const deviceFilterKeys = ['search', 'status', 'type', 'zoneId', 'doorId'] as const;
export type DeviceFiltersState = { search: string; status: string; type: string; zoneId: string | null; doorId: string | null };
export function readDeviceFilters(params: URLSearchParams): DeviceFiltersState {
  const status = params.get('status');
  return {
    search: params.get('search') ?? '',
    status: status && ['online', 'offline', 'never'].includes(status) ? status : 'all',
    type: params.get('type') || 'all',
    zoneId: params.get('zoneId') || null,
    doorId: params.get('doorId') || null,
  };
}
export function writeDeviceFilters(params: URLSearchParams, changes: Partial<DeviceFiltersState>): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of deviceFilterKeys) {
    if (!(key in changes)) continue;
    const value = changes[key];
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
  }
  return next;
}
export function deviceMatchesSearch(device: Device, search: string): boolean {
  const term = search.trim().toLocaleLowerCase('tr-TR');
  return [deviceDisplayName(device), device.name, device.deviceSerial, device.ideUuid, device.description, device.hikModel]
    .some(value => value?.toLocaleLowerCase('tr-TR').includes(term));
}

export function deviceMatchesFilters(device: Device, filters: DeviceFiltersState): boolean {
  const location = filters.doorId
    ? device.doorId === filters.doorId || device.doorIds?.some(id => id === filters.doorId) === true
    : !filters.zoneId || device.zoneId === filters.zoneId;
  return location && deviceMatchesSearch(device, filters.search)
    && (filters.status === 'all' || device.connectionStatus === filters.status)
    && (filters.type === 'all' || device.deviceType?.toLocaleLowerCase('tr-TR') === filters.type.toLocaleLowerCase('tr-TR'));
}

export function resetDeviceFiltersForProject(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of [...deviceFilterKeys, 'deviceId']) next.delete(key);
  return next;
}
