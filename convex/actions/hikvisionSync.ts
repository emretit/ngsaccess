"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { createHash, randomBytes } from "crypto";

// ────────────────────────────────────────────────────────────
// Digest Auth
// ────────────────────────────────────────────────────────────

interface DigestParams {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
}

function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

function parseWWWAuthenticate(header: string): DigestParams {
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2];
  }
  return {
    realm: params.realm ?? "",
    nonce: params.nonce ?? "",
    qop: params.qop,
    opaque: params.opaque,
  };
}

async function digestFetch(
  url: string,
  method: string,
  body: string | null,
  username: string,
  password: string
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const firstResponse = await fetch(url, {
    method,
    headers,
    body: method !== "GET" ? body : undefined,
  });

  if (firstResponse.status !== 401) {
    return { status: firstResponse.status, body: await firstResponse.text() };
  }

  const wwwAuth = firstResponse.headers.get("www-authenticate");
  if (!wwwAuth) {
    return { status: 401, body: "WWW-Authenticate header bulunamadı" };
  }

  const dp = parseWWWAuthenticate(wwwAuth);
  const uri = new URL(url).pathname + new URL(url).search;
  const cnonce = randomBytes(8).toString("hex");
  const nc = "00000001";
  const ha1 = md5(`${username}:${dp.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = dp.qop
    ? md5(`${ha1}:${dp.nonce}:${nc}:${cnonce}:auth:${ha2}`)
    : md5(`${ha1}:${dp.nonce}:${ha2}`);

  let authHeader = `Digest username="${username}", realm="${dp.realm}", nonce="${dp.nonce}", uri="${uri}", response="${response}"`;
  if (dp.qop) authHeader += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
  if (dp.opaque) authHeader += `, opaque="${dp.opaque}"`;

  const secondResponse = await fetch(url, {
    method,
    headers: { ...headers, Authorization: authHeader },
    body: method !== "GET" ? body : undefined,
  });

  return { status: secondResponse.status, body: await secondResponse.text() };
}

// ────────────────────────────────────────────────────────────
// ISAPI Helper'lar
// ────────────────────────────────────────────────────────────

interface DeviceCreds {
  ip: string;
  username: string;
  password: string;
}

interface SyncResult {
  success: boolean;
  error?: string;
  deviceIp: string;
}

function buildUserInfoBody(employeeNo: string, name: string, cardNo: string, planTemplateNo: string) {
  return JSON.stringify({
    UserInfo: {
      employeeNo,
      name,
      userType: "normal",
      doorRight: "1",
      RightPlan: [{ doorNo: 1, planTemplateNo }],
      numOfCard: 1,
      card: [{ cardNo, cardType: "normalCard" }],
      Valid: {
        enable: true,
        beginTime: "2025-01-01T00:00:00",
        endTime: "2035-12-31T23:59:59",
        timeType: "local",
      },
    },
  });
}

async function syncPersonToDevice(
  creds: DeviceCreds,
  info: { employeeNo: string; name: string; cardNo: string; planTemplateNo: string }
): Promise<SyncResult> {
  const url = `http://${creds.ip}/ISAPI/AccessControl/UserInfo/Record?format=json`;
  const body = buildUserInfoBody(info.employeeNo, info.name, info.cardNo, info.planTemplateNo);

  try {
    const result = await digestFetch(url, "POST", body, creds.username, creds.password);

    if (result.status === 200) {
      try {
        const json = JSON.parse(result.body);
        if (json.statusCode === 1 || json.statusString === "OK") {
          return { success: true, deviceIp: creds.ip };
        }
        if (json.subStatusCode === "deviceUserAlreadyExist") {
          // Kişi zaten var — güncelle
          const modUrl = `http://${creds.ip}/ISAPI/AccessControl/UserInfo/Modify?format=json`;
          const modResult = await digestFetch(modUrl, "PUT", body, creds.username, creds.password);
          if (modResult.status === 200) return { success: true, deviceIp: creds.ip };
          return { success: false, error: `Modify: HTTP ${modResult.status}`, deviceIp: creds.ip };
        }
        return { success: false, error: json.subStatusCode || json.statusString || result.body, deviceIp: creds.ip };
      } catch {
        return { success: true, deviceIp: creds.ip };
      }
    }

    return { success: false, error: `HTTP ${result.status}: ${result.body}`, deviceIp: creds.ip };
  } catch (err) {
    return { success: false, error: (err as Error).message, deviceIp: creds.ip };
  }
}

async function syncWeekPlanToDevice(
  creds: DeviceCreds,
  weekPlanNo: number,
  schedule: { week: string; beginTime: string; endTime: string }[]
): Promise<SyncResult> {
  const url = `http://${creds.ip}/ISAPI/AccessControl/UserRightWeekPlanCfg/${weekPlanNo}?format=json`;

  const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weekPlanCfg = allDays.map((day) => {
    const found = schedule.find((s) => s.week === day);
    return {
      week: day,
      id: 1,
      enable: !!found,
      beginTime: found?.beginTime ?? "00:00:00",
      endTime: found?.endTime ?? "00:00:00",
    };
  });

  const body = JSON.stringify({
    UserRightWeekPlanCfg: { weekPlanNo, enable: true, WeekPlanCfg: weekPlanCfg },
  });

  try {
    const result = await digestFetch(url, "PUT", body, creds.username, creds.password);
    if (result.status === 200) return { success: true, deviceIp: creds.ip };
    return { success: false, error: `HTTP ${result.status}: ${result.body}`, deviceIp: creds.ip };
  } catch (err) {
    return { success: false, error: (err as Error).message, deviceIp: creds.ip };
  }
}

// ────────────────────────────────────────────────────────────
// Convex Actions
// ────────────────────────────────────────────────────────────

/**
 * Çalışanı erişim gruplarındaki tüm cihazlara senkronize eder.
 */
export const syncEmployeeToDevices = action({
  args: { employeeId: v.id("employees") },
  handler: async (ctx, args): Promise<{ synced: number; failed: number; errors: string[] }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getEmployeeWithDevices, {
      employeeId: args.employeeId,
    });

    if (!data?.employee.cardNumber || data.deviceRules.length === 0) {
      return { synced: 0, failed: 0, errors: [] };
    }

    const { employee, deviceRules } = data;
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];
    const processedIps = new Set<string>();

    for (const { device, rule } of deviceRules) {
      if (processedIps.has(device.deviceIp)) continue;
      processedIps.add(device.deviceIp);

      if (!device.devicePassword) {
        errors.push(`${device.deviceIp}: Cihaz şifresi tanımlı değil`);
        failed++;
        continue;
      }

      console.log(`[hikvision-sync] Kişi sync: ${employee.cardNumber} → ${device.deviceIp}`);

      const result = await syncPersonToDevice(
        { ip: device.deviceIp, username: device.deviceUsername, password: device.devicePassword },
        {
          employeeNo: employee.cardNumber,
          name: `${employee.firstName} ${employee.lastName}`,
          cardNo: employee.cardNumber,
          planTemplateNo: rule.hikWeekPlanNo?.toString() ?? "1",
        }
      );

      if (result.success) {
        console.log(`[hikvision-sync] OK: ${employee.cardNumber} → ${device.deviceIp}`);
        synced++;
      } else {
        console.error(`[hikvision-sync] FAIL: ${employee.cardNumber} → ${device.deviceIp}: ${result.error}`);
        errors.push(`${device.deviceIp}: ${result.error}`);
        failed++;
      }
    }

    return { synced, failed, errors };
  },
});

/**
 * Erişim kuralındaki zaman planını tüm ilişkili cihazlara gönderir,
 * ardından gruptaki çalışanları güncel planTemplateNo ile re-sync eder.
 */
export const syncWeekPlanToDevices = action({
  args: { accessRuleId: v.id("accessRules") },
  handler: async (ctx, args): Promise<{ synced: number; failed: number; errors: string[]; employeesSynced: number }> => {
    const data = await ctx.runQuery(internal.hikvisionSync.getAccessRuleWithDevices, {
      accessRuleId: args.accessRuleId,
    });

    if (!data) return { synced: 0, failed: 0, errors: [], employeesSynced: 0 };

    const { rule, devices, employees } = data;

    if (!rule.startTime || !rule.endTime || !rule.days?.length || devices.length === 0) {
      return { synced: 0, failed: 0, errors: [], employeesSynced: 0 };
    }

    // hikWeekPlanNo yoksa ata
    let weekPlanNo = rule.hikWeekPlanNo;
    if (!weekPlanNo) {
      const maxNo = await ctx.runQuery(internal.hikvisionSync.getMaxWeekPlanNo, {});
      weekPlanNo = maxNo + 1;
      await ctx.runMutation(internal.hikvisionSync.assignWeekPlanNo, {
        accessRuleId: args.accessRuleId,
        weekPlanNo,
      });
    }

    const schedule = rule.days.map((day: string) => ({
      week: day,
      beginTime: `${rule.startTime}:00`,
      endTime: `${rule.endTime}:00`,
    }));

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const device of devices) {
      if (!device.devicePassword) {
        errors.push(`${device.deviceIp}: Cihaz şifresi tanımlı değil`);
        failed++;
        continue;
      }

      console.log(`[hikvision-sync] WeekPlan #${weekPlanNo} → ${device.deviceIp}`);
      const result = await syncWeekPlanToDevice(
        { ip: device.deviceIp, username: device.deviceUsername, password: device.devicePassword },
        weekPlanNo,
        schedule
      );

      if (result.success) {
        console.log(`[hikvision-sync] WeekPlan OK → ${device.deviceIp}`);
        synced++;
      } else {
        console.error(`[hikvision-sync] WeekPlan FAIL → ${device.deviceIp}: ${result.error}`);
        errors.push(`${device.deviceIp}: ${result.error}`);
        failed++;
      }
    }

    // Gruptaki çalışanları güncel planTemplateNo ile re-sync
    let employeesSynced = 0;
    for (const emp of employees) {
      for (const device of devices) {
        if (!device.devicePassword) continue;

        const result = await syncPersonToDevice(
          { ip: device.deviceIp, username: device.deviceUsername, password: device.devicePassword },
          {
            employeeNo: emp.cardNumber,
            name: `${emp.firstName} ${emp.lastName}`,
            cardNo: emp.cardNumber,
            planTemplateNo: weekPlanNo.toString(),
          }
        );

        if (result.success) employeesSynced++;
      }
    }

    return { synced, failed, errors, employeesSynced };
  },
});
