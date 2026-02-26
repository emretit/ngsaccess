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
import type * as actions_sendEmail from "../actions/sendEmail.js";
import type * as actions_setPassword from "../actions/setPassword.js";
import type * as auth from "../auth.js";
import type * as cardReadings from "../cardReadings.js";
import type * as chatConversations from "../chatConversations.js";
import type * as companies from "../companies.js";
import type * as dashboard from "../dashboard.js";
import type * as departments from "../departments.js";
import type * as devices from "../devices.js";
import type * as doors from "../doors.js";
import type * as employeeAuth from "../employeeAuth.js";
import type * as employees from "../employees.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as positions from "../positions.js";
import type * as projects from "../projects.js";
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
  "actions/sendEmail": typeof actions_sendEmail;
  "actions/setPassword": typeof actions_setPassword;
  auth: typeof auth;
  cardReadings: typeof cardReadings;
  chatConversations: typeof chatConversations;
  companies: typeof companies;
  dashboard: typeof dashboard;
  departments: typeof departments;
  devices: typeof devices;
  doors: typeof doors;
  employeeAuth: typeof employeeAuth;
  employees: typeof employees;
  files: typeof files;
  http: typeof http;
  invites: typeof invites;
  "lib/auth": typeof lib_auth;
  "lib/customFunctions": typeof lib_customFunctions;
  positions: typeof positions;
  projects: typeof projects;
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
