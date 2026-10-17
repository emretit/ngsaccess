import { describe, expect, it } from 'vitest';
import type { Id } from '../../convex/_generated/dataModel';
import type { Device } from '@/types/device';
import { deviceDisplayName, deviceMatchesFilters, deviceMatchesSearch, deviceModel, readDeviceFilters, writeDeviceFilters, resetDeviceFiltersForProject } from './deviceDisplay';

const device: Device = {
  _id: 'device1' as Id<'devices'>, name: 'İdari giriş', brand: 'ide_smart', ideUuid: '1234567890123',
  zoneId: 'zone1' as Id<'zones'>, doorIds: ['door1' as Id<'doors'>], connectionStatus: 'online', deviceType: 'Panel',
};
describe('cihaz görünümü ve filtreleri', () => {
  it('IDE özel adını korur; yalnız UUID veya boş ad için yedek kullanır', () => {
    expect(deviceDisplayName(device)).toBe('İdari giriş');
    expect(deviceDisplayName({ ...device, name: device.ideUuid ?? '' })).toBe('IDE Smart · 0123');
    expect(deviceDisplayName({ ...device, name: ' ' })).toBe('IDE Smart · 0123');
    expect(deviceDisplayName({ ...device, name: '999999999999' })).toBe('999999999999');
  });
  it('UUID ve görünen adı Türkçe harflerle arar', () => {
    expect(deviceMatchesSearch(device, '7890123')).toBe(true);
    expect(deviceMatchesSearch(device, 'idari')).toBe(true);
    expect(deviceMatchesSearch(device, 'bilinmeyen')).toBe(false);
  });
  it('modeli tipten ve UUIDden ayırır', () => {
    expect(deviceModel({ ...device, hikModel: 'DS-K2804' })).toBe('DS-K2804');
    expect(deviceModel(device)).toBe('Model bilgisi yok');
  });
  it('URL eşlemesi deep-link ve diğer parametreleri korur, boşları kaldırır', () => {
    const initial = new URLSearchParams('deviceId=device1&tab=info');
    const next = writeDeviceFilters(initial, { search: 'giriş', status: 'online', type: 'Panel', zoneId: 'zone1', doorId: 'door1' });
    expect(initial.get('search')).toBeNull();
    expect(next.get('deviceId')).toBe('device1');
    expect(next.get('tab')).toBe('info');
    expect(readDeviceFilters(next)).toEqual({ search: 'giriş', status: 'online', type: 'Panel', zoneId: 'zone1', doorId: 'door1' });
    const cleared = writeDeviceFilters(next, { search: '', status: 'all', type: 'all', zoneId: null, doorId: null });
    expect(cleared.toString()).toBe(initial.toString());
    expect(readDeviceFilters(next).search).toBe('giriş');
    expect(readDeviceFilters(initial).search).toBe('');
  });
  it('proje değişiminde deviceId ve tüm filtreleri kaldırır', () => {
    expect(resetDeviceFiltersForProject(new URLSearchParams('deviceId=old&search=a&status=online&type=Panel&zoneId=z&doorId=d&tab=info')).toString()).toBe('tab=info');
  });
  it('geçersiz durumu varsayılana indirger', () => {
    expect(readDeviceFilters(new URLSearchParams('status=broken&type=&doorId=')).status).toBe('all');
  });
  it('kapı bağlantı listesini, eski kapı alanını ve bölgeyi eşler; bütün filtreleri birlikte uygular', () => {
    const filters = { search: '0123', status: 'online', type: 'panel', zoneId: 'zone1', doorId: 'door1' };
    expect(deviceMatchesFilters(device, filters)).toBe(true);
    expect(deviceMatchesFilters({ ...device, doorIds: [], doorId: 'door1' as Id<'doors'> }, filters)).toBe(true);
    expect(deviceMatchesFilters(device, { ...filters, doorId: 'door2' })).toBe(false);
    expect(deviceMatchesFilters(device, { ...filters, status: 'offline' })).toBe(false);
    expect(deviceMatchesFilters(device, { ...filters, doorId: null, zoneId: 'zone2' })).toBe(false);
  });
});
