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
import type * as actions_hikvisionSync from "../actions/hikvisionSync.js";
import type * as actions_sendEmail from "../actions/sendEmail.js";
import type * as actions_sendScheduledReports from "../actions/sendScheduledReports.js";
import type * as actions_setPassword from "../actions/setPassword.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as cardReadings from "../cardReadings.js";
import type * as chatConversations from "../chatConversations.js";
import type * as companies from "../companies.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as departments from "../departments.js";
import type * as devices from "../devices.js";
import type * as doors from "../doors.js";
import type * as employeeAuth from "../employeeAuth.js";
import type * as employeeCheckIn from "../employeeCheckIn.js";
import type * as employees from "../employees.js";
import type * as files from "../files.js";
import type * as hikvisionSync from "../hikvisionSync.js";
import type * as holidays from "../holidays.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as leaves from "../leaves.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_cardReaderParse from "../lib/cardReaderParse.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_employeeAuth from "../lib/employeeAuth.js";
import type * as lib_pdksHelpers from "../lib/pdksHelpers.js";
import type * as onboarding from "../onboarding.js";
import type * as pdksRecords from "../pdksRecords.js";
import type * as positions from "../positions.js";
import type * as projects from "../projects.js";
import type * as reports from "../reports.js";
import type * as seedCardReaderTest from "../seedCardReaderTest.js";
import type * as seedHikvisionLanDevice from "../seedHikvisionLanDevice.js";
import type * as seedTestCardAccess from "../seedTestCardAccess.js";
import type * as settings from "../settings.js";
import type * as shifts from "../shifts.js";
import type * as userProjects from "../userProjects.js";
import type * as users from "../users.js";
import type * as zones from "../zones.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessRules: typeof accessRules;
  "actions/getChatData": typeof actions_getChatData;
  "actions/hikvisionSync": typeof actions_hikvisionSync;
  "actions/sendEmail": typeof actions_sendEmail;
  "actions/sendScheduledReports": typeof actions_sendScheduledReports;
  "actions/setPassword": typeof actions_setPassword;
  auditLog: typeof auditLog;
  auth: typeof auth;
  cardReadings: typeof cardReadings;
  chatConversations: typeof chatConversations;
  companies: typeof companies;
  crons: typeof crons;
  dashboard: typeof dashboard;
  departments: typeof departments;
  devices: typeof devices;
  doors: typeof doors;
  employeeAuth: typeof employeeAuth;
  employeeCheckIn: typeof employeeCheckIn;
  employees: typeof employees;
  files: typeof files;
  hikvisionSync: typeof hikvisionSync;
  holidays: typeof holidays;
  http: typeof http;
  invites: typeof invites;
  leaves: typeof leaves;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/cardReaderParse": typeof lib_cardReaderParse;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/employeeAuth": typeof lib_employeeAuth;
  "lib/pdksHelpers": typeof lib_pdksHelpers;
  onboarding: typeof onboarding;
  pdksRecords: typeof pdksRecords;
  positions: typeof positions;
  projects: typeof projects;
  reports: typeof reports;
  seedCardReaderTest: typeof seedCardReaderTest;
  seedHikvisionLanDevice: typeof seedHikvisionLanDevice;
  seedTestCardAccess: typeof seedTestCardAccess;
  settings: typeof settings;
  shifts: typeof shifts;
  userProjects: typeof userProjects;
  users: typeof users;
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

export declare const components: {};
