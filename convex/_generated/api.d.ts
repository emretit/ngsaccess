/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessRules from "../accessRules.js";
import type * as actions_getChatData from "../actions/getChatData.js";
import type * as actions_hikDebug from "../actions/hikDebug.js";
import type * as actions_hikGatewayDevice from "../actions/hikGatewayDevice.js";
import type * as actions_hikQueueWorker from "../actions/hikQueueWorker.js";
import type * as actions_hikvisionSync from "../actions/hikvisionSync.js";
import type * as actions_ideGatewayDevice from "../actions/ideGatewayDevice.js";
import type * as actions_pdksImport from "../actions/pdksImport.js";
import type * as actions_sendEmail from "../actions/sendEmail.js";
import type * as actions_sendScheduledReports from "../actions/sendScheduledReports.js";
import type * as actions_setPassword from "../actions/setPassword.js";
import type * as adminDevices from "../adminDevices.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as cardReadings from "../cardReadings.js";
import type * as chatConversations from "../chatConversations.js";
import type * as companies from "../companies.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as debugIde from "../debugIde.js";
import type * as departments from "../departments.js";
import type * as devices from "../devices.js";
import type * as doors from "../doors.js";
import type * as emailVerification from "../emailVerification.js";
import type * as employeeAuth from "../employeeAuth.js";
import type * as employeeCheckIn from "../employeeCheckIn.js";
import type * as employeeConsents from "../employeeConsents.js";
import type * as employeeFaces from "../employeeFaces.js";
import type * as employeeFingerprints from "../employeeFingerprints.js";
import type * as employees from "../employees.js";
import type * as files from "../files.js";
import type * as hikBridge from "../hikBridge.js";
import type * as hikvisionSync from "../hikvisionSync.js";
import type * as holidays from "../holidays.js";
import type * as http from "../http.js";
import type * as ideDefaults from "../ideDefaults.js";
import type * as ideSync from "../ideSync.js";
import type * as invites from "../invites.js";
import type * as leaves from "../leaves.js";
import type * as lib_accessDecision from "../lib/accessDecision.js";
import type * as lib_accessGraph from "../lib/accessGraph.js";
import type * as lib_accessGraphPure from "../lib/accessGraphPure.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_breakDeduction from "../lib/breakDeduction.js";
import type * as lib_cardReaderParse from "../lib/cardReaderParse.js";
import type * as lib_cardReadingAudit from "../lib/cardReadingAudit.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_deviceHelpers from "../lib/deviceHelpers.js";
import type * as lib_devicePool from "../lib/devicePool.js";
import type * as lib_deviceSync from "../lib/deviceSync.js";
import type * as lib_digestAuth from "../lib/digestAuth.js";
import type * as lib_emailVerification from "../lib/emailVerification.js";
import type * as lib_employeeAuth from "../lib/employeeAuth.js";
import type * as lib_employeeCascade from "../lib/employeeCascade.js";
import type * as lib_escapers from "../lib/escapers.js";
import type * as lib_gateway_biometrics from "../lib/gateway/biometrics.js";
import type * as lib_gateway_capture from "../lib/gateway/capture.js";
import type * as lib_gateway_cards from "../lib/gateway/cards.js";
import type * as lib_gateway_core from "../lib/gateway/core.js";
import type * as lib_gateway_devices from "../lib/gateway/devices.js";
import type * as lib_gateway_events from "../lib/gateway/events.js";
import type * as lib_gateway_persons from "../lib/gateway/persons.js";
import type * as lib_gateway_plans from "../lib/gateway/plans.js";
import type * as lib_gateway_scheduling from "../lib/gateway/scheduling.js";
import type * as lib_hikEventCodes from "../lib/hikEventCodes.js";
import type * as lib_hikGateway from "../lib/hikGateway.js";
import type * as lib_hikModels from "../lib/hikModels.js";
import type * as lib_hikSync from "../lib/hikSync.js";
import type * as lib_overtimeCalc from "../lib/overtimeCalc.js";
import type * as lib_pdksCalc from "../lib/pdksCalc.js";
import type * as lib_pdksHelpers from "../lib/pdksHelpers.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_reconcileMath from "../lib/reconcileMath.js";
import type * as lib_sgkCodes from "../lib/sgkCodes.js";
import type * as lib_shiftResolver from "../lib/shiftResolver.js";
import type * as lib_syncErrors from "../lib/syncErrors.js";
import type * as lib_turkishHolidays from "../lib/turkishHolidays.js";
import type * as migrations from "../migrations.js";
import type * as migrations_projectIdBackfill from "../migrations/projectIdBackfill.js";
import type * as onboarding from "../onboarding.js";
import type * as pdksRecords from "../pdksRecords.js";
import type * as positions from "../positions.js";
import type * as projects from "../projects.js";
import type * as readers from "../readers.js";
import type * as reports from "../reports.js";
import type * as seedCardReaderTest from "../seedCardReaderTest.js";
import type * as seedHikvisionLanDevice from "../seedHikvisionLanDevice.js";
import type * as seedTestCardAccess from "../seedTestCardAccess.js";
import type * as settings from "../settings.js";
import type * as sgkExport from "../sgkExport.js";
import type * as shifts from "../shifts.js";
import type * as syncStatus from "../syncStatus.js";
import type * as userPreferences from "../userPreferences.js";
import type * as userProjects from "../userProjects.js";
import type * as users from "../users.js";
import type * as visitors from "../visitors.js";
import type * as zones from "../zones.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessRules: typeof accessRules;
  "actions/getChatData": typeof actions_getChatData;
  "actions/hikDebug": typeof actions_hikDebug;
  "actions/hikGatewayDevice": typeof actions_hikGatewayDevice;
  "actions/hikQueueWorker": typeof actions_hikQueueWorker;
  "actions/hikvisionSync": typeof actions_hikvisionSync;
  "actions/ideGatewayDevice": typeof actions_ideGatewayDevice;
  "actions/pdksImport": typeof actions_pdksImport;
  "actions/sendEmail": typeof actions_sendEmail;
  "actions/sendScheduledReports": typeof actions_sendScheduledReports;
  "actions/setPassword": typeof actions_setPassword;
  adminDevices: typeof adminDevices;
  auditLog: typeof auditLog;
  auth: typeof auth;
  cardReadings: typeof cardReadings;
  chatConversations: typeof chatConversations;
  companies: typeof companies;
  crons: typeof crons;
  dashboard: typeof dashboard;
  debugIde: typeof debugIde;
  departments: typeof departments;
  devices: typeof devices;
  doors: typeof doors;
  emailVerification: typeof emailVerification;
  employeeAuth: typeof employeeAuth;
  employeeCheckIn: typeof employeeCheckIn;
  employeeConsents: typeof employeeConsents;
  employeeFaces: typeof employeeFaces;
  employeeFingerprints: typeof employeeFingerprints;
  employees: typeof employees;
  files: typeof files;
  hikBridge: typeof hikBridge;
  hikvisionSync: typeof hikvisionSync;
  holidays: typeof holidays;
  http: typeof http;
  ideDefaults: typeof ideDefaults;
  ideSync: typeof ideSync;
  invites: typeof invites;
  leaves: typeof leaves;
  "lib/accessDecision": typeof lib_accessDecision;
  "lib/accessGraph": typeof lib_accessGraph;
  "lib/accessGraphPure": typeof lib_accessGraphPure;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/breakDeduction": typeof lib_breakDeduction;
  "lib/cardReaderParse": typeof lib_cardReaderParse;
  "lib/cardReadingAudit": typeof lib_cardReadingAudit;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/deviceHelpers": typeof lib_deviceHelpers;
  "lib/devicePool": typeof lib_devicePool;
  "lib/deviceSync": typeof lib_deviceSync;
  "lib/digestAuth": typeof lib_digestAuth;
  "lib/emailVerification": typeof lib_emailVerification;
  "lib/employeeAuth": typeof lib_employeeAuth;
  "lib/employeeCascade": typeof lib_employeeCascade;
  "lib/escapers": typeof lib_escapers;
  "lib/gateway/biometrics": typeof lib_gateway_biometrics;
  "lib/gateway/capture": typeof lib_gateway_capture;
  "lib/gateway/cards": typeof lib_gateway_cards;
  "lib/gateway/core": typeof lib_gateway_core;
  "lib/gateway/devices": typeof lib_gateway_devices;
  "lib/gateway/events": typeof lib_gateway_events;
  "lib/gateway/persons": typeof lib_gateway_persons;
  "lib/gateway/plans": typeof lib_gateway_plans;
  "lib/gateway/scheduling": typeof lib_gateway_scheduling;
  "lib/hikEventCodes": typeof lib_hikEventCodes;
  "lib/hikGateway": typeof lib_hikGateway;
  "lib/hikModels": typeof lib_hikModels;
  "lib/hikSync": typeof lib_hikSync;
  "lib/overtimeCalc": typeof lib_overtimeCalc;
  "lib/pdksCalc": typeof lib_pdksCalc;
  "lib/pdksHelpers": typeof lib_pdksHelpers;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/reconcileMath": typeof lib_reconcileMath;
  "lib/sgkCodes": typeof lib_sgkCodes;
  "lib/shiftResolver": typeof lib_shiftResolver;
  "lib/syncErrors": typeof lib_syncErrors;
  "lib/turkishHolidays": typeof lib_turkishHolidays;
  migrations: typeof migrations;
  "migrations/projectIdBackfill": typeof migrations_projectIdBackfill;
  onboarding: typeof onboarding;
  pdksRecords: typeof pdksRecords;
  positions: typeof positions;
  projects: typeof projects;
  readers: typeof readers;
  reports: typeof reports;
  seedCardReaderTest: typeof seedCardReaderTest;
  seedHikvisionLanDevice: typeof seedHikvisionLanDevice;
  seedTestCardAccess: typeof seedTestCardAccess;
  settings: typeof settings;
  sgkExport: typeof sgkExport;
  shifts: typeof shifts;
  syncStatus: typeof syncStatus;
  userPreferences: typeof userPreferences;
  userProjects: typeof userProjects;
  users: typeof users;
  visitors: typeof visitors;
  zones: typeof zones;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
