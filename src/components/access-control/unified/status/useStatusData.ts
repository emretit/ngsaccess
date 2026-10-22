import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/notify";
import type { Counts, Filters } from "./model";

export type StatusScope = {
  convex: ConvexReactClient;
  projectId: Id<"projects">;
  setError: Dispatch<SetStateAction<string>>;
};

export type Options = {
  departments: FunctionReturnType<typeof api.departments.list>;
  devices: FunctionReturnType<typeof api.devices.list>;
  rules: { _id: Id<"accessRules">; name: string }[];
  templates: FunctionReturnType<typeof api.accessScheduleTemplates.list>;
};
const emptyOptions: Options = {
  departments: [],
  devices: [],
  rules: [],
  templates: [],
};

// Status UI reads only _id/name from devices; keeping the old array when those
// match stops a refresh from re-running every per-device counts query.
export function keepSameDevices<T extends { _id: string; name: string }>(
  prev: T[],
  next: T[],
): T[] {
  const same =
    prev.length === next.length &&
    prev.every((d, i) => d._id === next[i]?._id && d.name === next[i]?.name);
  return same ? prev : next;
}

export function useStatusOptions({
  convex, projectId, setError, revision,
}: StatusScope & { revision: number }) {
  const [options, setOptions] = useState<Options>(emptyOptions);
  useEffect(() => {
    let alive = true;
    async function loadOptions() {
      const [departments, devices, templates] = await Promise.all([
        convex.query(api.departments.list, { projectId }),
        convex.query(api.devices.list, { projectId }),
        convex.query(api.accessScheduleTemplates.list, {
          projectId,
          includeArchived: true,
        }),
      ]);
      const rules: Options["rules"] = [];
      let next: string | null = null;
      do {
        const page: FunctionReturnType<typeof api.accessRules.listSummaries> =
          await convex.query(api.accessRules.listSummaries, {
            projectId,
            paginationOpts: { numItems: 50, cursor: next },
          });
        rules.push(...page.page.map((r) => ({ _id: r._id, name: r.name })));
        next = page.isDone ? null : page.continueCursor;
      } while (next && alive);
      if (alive)
        setOptions((prev) => ({
          departments,
          devices: keepSameDevices(prev.devices, devices),
          templates,
          rules,
        }));
    }
    void loadOptions().catch((e) => {
      if (alive) setError(errorMessage(e));
    });
    return () => {
      alive = false;
    };
  }, [convex, projectId, revision, setError]);
  return options;
}

export function useDeviceCounts({
  convex, projectId, setError, options, filters, revision, view,
}: StatusScope & {
  options: Options;
  filters: Filters;
  revision: number;
  view: "person" | "device";
}) {
  const [deviceCounts, setDeviceCounts] = useState<Record<string, Counts>>({});
  useEffect(() => {
    if (view !== "device") return;
    let alive = true;
    setDeviceCounts({});
    void Promise.all(
      options.devices
        .filter((d) => !filters.deviceId || d._id === filters.deviceId)
        .map(
          async (device) =>
            [
              device._id,
              await convex.query(api.accessGrantStatus.counts, {
                projectId,
                deviceId: device._id,
                departmentId: filters.departmentId,
              }),
            ] as const,
        ),
    )
      .then((entries) => {
        if (alive) setDeviceCounts(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      });
    return () => {
      alive = false;
    };
  }, [
    convex,
    projectId,
    options.devices,
    filters.departmentId,
    filters.deviceId,
    revision,
    view,
    setError,
  ]);
  return deviceCounts;
}
