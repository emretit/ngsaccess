export function validateDeviceDoor(device: { _id: string; projectId?: string; zoneId?: string }, door: {
  deviceId?: string; projectId?: string; zoneId?: string;
}, zoneId = device.zoneId) {
  if (door.projectId !== device.projectId) throw new Error("Seçilen kapı bu cihazın projesinde değil");
  if (door.deviceId && door.deviceId !== device._id) throw new Error("Seçilen kapı başka bir panele ait");
  if (door.zoneId !== zoneId) throw new Error("Seçilen kapı ile bölge tutarlı değil");
}

export function deviceActive(status?: string, isActive?: boolean) {
  return status === "inactive" ? false : status === "active" ? true : isActive ?? true;
}

export function isDeviceHost(value: string): boolean {
  const host = value.trim();
  if (!host || host.length > 253) return false;
  if (/^[0-9.]+$/.test(host)) {
    const parts = host.split(".");
    return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  }
  if (host.includes(":")) {
    try { return new URL(`http://[${host}]/`).hostname.length > 0; } catch { return false; }
  }
  return host.split(".").every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));
}
