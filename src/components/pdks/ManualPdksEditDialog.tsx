import { FormFeedback } from "@/components/shared/FormFeedback";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FormDialog } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormActions } from "@/components/shared/FormActions";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { errorMessage, notify } from "@/lib/notify";
import { displayTime, readableDate, validateManual } from "./lib/presentation";
interface Props {
  open: boolean;
  returnFocusTo?: HTMLElement | null;
  employeeId: Id<"employees">;
  employeeName: string;
  date: string;
  isOvernightShift?: boolean;
  initialEntry: string;
  initialExit: string;
  onClose: () => void;
}
export function ManualPdksEditDialog(props: Props) {
  // A fresh form per employee/date/open prevents edits from silently changing day.
  if (!props.open) return null;
  return <ManualForm key={`${props.employeeId}:${props.date}`} {...props} />;
}
function ManualForm({
  returnFocusTo,
  employeeId,
  employeeName,
  date,
  isOvernightShift = false,
  initialEntry,
  initialExit,
  onClose,
}: Props) {
  const returnFocus = useRef<HTMLElement | null>(returnFocusTo ?? null);
  useEffect(() => {
    returnFocus.current = returnFocusTo ?? null;
  }, [returnFocusTo]);
  const originalEntry = displayTime(initialEntry) === "—" ? "" : initialEntry;
  const originalExit = displayTime(initialExit) === "—" ? "" : initialExit;
  const [entry, setEntry] = useState(originalEntry),
    [exit, setExit] = useState(originalExit),
    [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const upsert = useMutation(api.pdksRecords.upsertManual);
  const guard = useUnsavedChangesGuard(
    entry !== originalEntry || exit !== originalExit || note.length > 0,
  );
  const close = () => {
    if (!lock.current) guard.requestClose(onClose);
  };
  const save = async () => {
    if (lock.current) return;
    const next = validateManual(entry, exit, note, isOvernightShift);
    setErrors(next);
    if (Object.keys(next).length) return;
    lock.current = true;
    setSaving(true);
    try {
      await upsert({
        employeeId,
        date,
        entryTime: entry || undefined,
        exitTime: exit || undefined,
        note: note.trim(),
      });
      notify.success("Manuel kayıt güncellendi");
      onClose();
    } catch (error) {
      setErrors({ server: errorMessage(error) });
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      <FormDialog
        open={true}
        onRequestClose={close}
        pending={saving}
        title="Manuel düzelt"
        size="sm"
        description={
          <>
            {employeeName} · {readableDate(date)}
          </>
        }
        returnFocus={returnFocus}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        footer={
          <FormActions
            layout="dialog"
            isLoading={saving}
            onClose={close}
            busyLabel="Kaydediliyor…"
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          Kart okumaları korunur; değişiklik denetim kaydına işlenir.
        </p>
        <fieldset disabled={saving} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  key: "entry",
                  label: "Giriş saati",
                  value: entry,
                  original: originalEntry,
                  change: setEntry,
                },
                {
                  key: "exit",
                  label: "Çıkış saati",
                  value: exit,
                  original: originalExit,
                  change: setExit,
                },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label className="text-sm" htmlFor={`manual-${field.key}`}>
                  {field.label}
                </label>
                <p className="my-1 text-xs text-muted-foreground">
                  Mevcut: {field.original || "—"}
                </p>
                <Input
                  id={`manual-${field.key}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="08:30"
                  value={field.value}
                  onChange={(e) => field.change(e.target.value)}
                  aria-invalid={Boolean(errors[field.key])}
                  aria-describedby={
                    errors[field.key] ? `manual-${field.key}-error` : undefined
                  }
                />
                {errors[field.key] && (
                  <p
                    id={`manual-${field.key}-error`}
                    className="mt-1 text-xs text-danger"
                  >
                    {errors[field.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
          {isOvernightShift && entry && exit && exit <= entry && (
            <p className="text-sm text-muted-foreground">
              Çıkış ertesi gün kaydedilecek.
            </p>
          )}
          <div>
            <label htmlFor="manual-note" className="text-sm">
              Gerekçe (zorunlu)
            </label>
            <Textarea
              id="manual-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              minLength={3}
              maxLength={500}
              required
              rows={3}
              aria-invalid={Boolean(errors.note)}
              aria-describedby={
                errors.note
                  ? "manual-note-help manual-note-error"
                  : "manual-note-help"
              }
            />
            <p
              id="manual-note-help"
              className="mt-1 text-xs text-muted-foreground"
            >
              3–500 karakter.
            </p>
            {errors.note && (
              <p id="manual-note-error" className="text-xs text-danger">
                {errors.note}
              </p>
            )}
          </div>
        </fieldset>
        {errors.server && (
          <FormFeedback
            tone="error"
            variant="panel"
            title="Düzeltme kaydedilemedi."
          >
            <ul className="mt-1 list-disc pl-4">
              {[errors.server].map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </FormFeedback>
        )}
      </FormDialog>
      {guard.dialog}
    </>
  );
}
