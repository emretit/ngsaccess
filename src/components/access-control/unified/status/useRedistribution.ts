import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/notify";
import { redistributionSuccessText, type Pair } from "./model";

export function useRedistribution({
  projectId,
  selected,
  setSelected,
  setError,
  canManageDevices,
}: {
  projectId: Id<"projects">;
  canManageDevices: boolean;
  selected: Pair[];
  setSelected: Dispatch<SetStateAction<Pair[]>>;
  setError: Dispatch<SetStateAction<string>>;
}) {
  const redistribute = useMutation(api.accessGrantStatus.redistribute);
  const [action, setAction] = useState<"selected" | "failed" | "all" | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [runId, setRunId] = useState<Id<"deviceSyncRuns"> | null>(null);
  const actionLock = useRef(false);
  async function send() {
    if (!action || actionLock.current || (action === "all" && !canManageDevices)) return;
    actionLock.current = true;
    setSending(true);
    setError("");
    try {
      const result = await redistribute({
        projectId,
        ...(action === "selected"
          ? { pairs: selected }
          : action === "failed"
            ? { onlyFailed: true }
            : {}),
      });
      setRunId(result.runId);
      setSuccess(action === "failed" ? redistributionSuccessText(result) : "");
      setAction(null);
      setSelected([]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      actionLock.current = false;
      setSending(false);
    }
  }
  return { action, setAction, sending, success, runId, send };
}
