import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useGuardedFormNavigation } from "@/hooks/useGuardedFormNavigation";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { DateRangeFields } from "@/components/shared/DateRangeFields";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/shared/FormActions";
import { EmployeePicker, selectClass } from "./EmployeePicker";
import {
  calendarDays,
  dateLabel,
  leaveError,
  makeLeaveFormSchema,
  leaveTypes,
  type LeaveFormValues,
  type LeaveRow,
} from "./lib/leaveState";

export function LeaveForm({
  row,
  projectId,
  projectName,
  onClose,
  onConflict,
  latestRow,
}: {
  row?: LeaveRow;
  projectId: Id<"projects">;
  projectName: string;
  onClose: () => void;
  onConflict: (
    conflict: { id: string; start: string; end: string },
    employeeId: string,
  ) => void;
  latestRow?: LeaveRow;
}) {
  const mobile = useIsMobile();
  const create = useMutation(api.leaves.create),
    update = useMutation(api.leaves.update);
  const [validationRange, setValidationRange] = useState(
    row ? { startDate: row.startDate, endDate: row.endDate } : undefined,
  );
  const [version, setVersion] = useState(row?.updatedAt);
  const [serverError, setServerError] =
    useState<ReturnType<typeof leaveError>>();
  const form = useForm<LeaveFormValues>({
    mode: "onChange",
    resolver: zodResolver(makeLeaveFormSchema(validationRange)),
    defaultValues: {
      employeeId: row?.employeeId ?? "",
      leaveType: row?.leaveType ?? "annual",
      startDate: row?.startDate ?? "",
      endDate: row?.endDate ?? "",
      notes: row?.notes ?? "",
    },
  });
  const { run, pending } = useAsyncAction(
    async (values: LeaveFormValues) => {
      setServerError(undefined);
      try {
        if (row)
          await update({
            leaveId: row._id,
            leaveType: values.leaveType,
            startDate:
              values.startDate !== validationRange?.startDate
                ? values.startDate
                : undefined,
            endDate:
              values.endDate !== validationRange?.endDate
                ? values.endDate
                : undefined,
            notes: values.notes || null,
            expectedUpdatedAt: version ?? row.updatedAt,
          });
        else
          await create({
            projectId,
            employeeId: values.employeeId as Id<"employees">,
            leaveType: values.leaveType,
            startDate: values.startDate,
            endDate: values.endDate,
            notes: values.notes || undefined,
          });
      } catch (error: unknown) {
        const detail = leaveError(error);
        setServerError(detail);
        const field =
          detail.code === "LEAVE_EMPLOYEE_UNAVAILABLE" ||
          detail.code === "LEAVE_PROJECT_MISMATCH"
            ? "employeeId"
            : [
                  "LEAVE_INVALID_DATE",
                  "LEAVE_RANGE_REVERSED",
                  "LEAVE_TOO_LONG",
                  "LEAVE_OVERLAP",
                ].includes(detail.code ?? "")
              ? "endDate"
              : undefined;
        if (field)
          form.setError(
            field,
            { message: detail.message },
            { shouldFocus: true },
          );
        throw error;
      }
    },
    { success: "İzin kaydedildi", error: "İzin kaydedilemedi" },
  );
  const guard = useGuardedFormNavigation({
    dirty: form.formState.isDirty || pending,
    pending,
  });
  const close = () => guard.requestClose(onClose);
  const [startDate, endDate, employeeId] = useWatch({
    control: form.control,
    name: ["startDate", "endDate", "employeeId"],
  });
  const days = calendarDays(startDate, endDate);
  const datesChanged = !validationRange || startDate !== validationRange.startDate || endDate !== validationRange.endDate;
  const checkConflict = Boolean(employeeId && days !== null && days <= 366 && datesChanged);
  const conflict = useQuery(api.leaves.conflictFor, checkConflict ? {
    projectId, employeeId: employeeId as Id<"employees">, startDate, endDate, excludeLeaveId: row?._id,
  } : "skip");

  const Header = mobile ? SheetHeader : DialogHeader,
    Title = mobile ? SheetTitle : DialogTitle,
    Description = mobile ? SheetDescription : DialogDescription;
  const content = (
    <>
      <Header className="shrink-0 border-b p-5 pr-12 text-left">
        <Title>{row ? "İzni düzenle" : "İzin ekle"}</Title>
        <Description>{projectName} · Doğrudan onaylı kayıt</Description>
      </Header>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(
          async (values) => {
            if (checkConflict && (conflict === undefined || conflict !== null)) return;
            if (await run(values)) onClose();
          },
          (errors) => {
            const id = errors.employeeId
              ? "leave-person"
              : errors.leaveType
                ? "leave-type"
                : errors.startDate
                  ? "leave-start"
                  : "leave-end";
            document.getElementById(id)?.focus();
          },
        )}
      >
        <fieldset
          disabled={pending}
          aria-busy={pending}
          className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-5"
        >
          {serverError && (
            <div
              role="alert"
              className="space-y-2 rounded-md border border-danger p-3 text-sm"
            >
              <p>{serverError.message}</p>
              {serverError.conflict && (
                <>
                  <p>
                    {dateLabel(serverError.conflict.start)} –{" "}
                    {dateLabel(serverError.conflict.end)}
                  </p>
                  <Button asChild variant="link" className="h-auto p-0">
                    <a
                      href={`/leaves?${new URLSearchParams({ employee: employeeId, period: "custom", from: serverError.conflict.start, to: serverError.conflict.end, leave: serverError.conflict.id })}`}
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        guard.requestClose(() => {
                          if (serverError.conflict) {
                            guard.release();
                            onConflict(
                              serverError.conflict,
                              form.getValues("employeeId"),
                            );
                          }
                        });
                      }}
                    >
                      Kaydı aç
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Kayıt seçili projedeyse listeden açılır.
                  </p>
                </>
              )}
              {serverError.code === "LEAVE_STALE" && (
                <>
                  <p className="text-xs">
                    Güncel kaydı yüklemek bu taslaktaki değişiklikleri kaldırır.
                    Kayıt mevcut filtrelerde bulunamıyorsa formu kapatıp dönemi
                    değiştirin.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!latestRow || latestRow.updatedAt === version}
                    onClick={() =>
                      guard.requestClose(() => {
                        if (!latestRow) return;
                        form.reset({
                          employeeId: latestRow.employeeId,
                          leaveType: latestRow.leaveType,
                          startDate: latestRow.startDate,
                          endDate: latestRow.endDate,
                          notes: latestRow.notes ?? "",
                        });
                        setValidationRange({
                          startDate: latestRow.startDate,
                          endDate: latestRow.endDate,
                        });
                        setVersion(latestRow.updatedAt);
                        setServerError(undefined);
                      })
                    }
                  >
                    Güncel kaydı yükle
                  </Button>
                </>
              )}
            </div>
          )}
          <FormFieldWrapper
            htmlFor="leave-person"
            label="Kişi"
            error={form.formState.errors.employeeId?.message}
          >
            {(control) =>
              row ? (
                <Input
                  {...control}
                  value={`${row.employeeName} · ${row.departmentName ?? "Departman belirtilmemiş"}`}
                  readOnly
                />
              ) : (
                <QuerySectionBoundary
                  title="Kişiler yüklenemedi."
                  description="Tekrar deneyin. Form bilgileriniz korunur."
                  resetKey={projectId}
                >
                  <EmployeePicker
                    projectId={projectId}
                    value={employeeId}
                    onChange={(value) =>
                      form.setValue("employeeId", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    control={control}
                    disabled={pending}
                  />
                </QuerySectionBoundary>
              )
            }
          </FormFieldWrapper>
          <FormFieldWrapper
            htmlFor="leave-type"
            label="İzin türü"
            error={form.formState.errors.leaveType?.message}
          >
            <select className={selectClass} {...form.register("leaveType")}>
              {Object.entries(leaveTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </FormFieldWrapper>
          <DateRangeFields
            idPrefix="leave"
            required
            value={{ start: startDate, end: endDate }}
            errors={{
              start: form.formState.errors.startDate?.message,
              end: form.formState.errors.endDate?.message,
            }}
            onChange={(next, changed) =>
              form.setValue(
                changed === "start" ? "startDate" : "endDate",
                next[changed],
                { shouldDirty: true, shouldValidate: true },
              )
            }
          />
          {checkConflict && conflict === undefined && <p role="status" className="text-sm">İzin çakışması kontrol ediliyor…</p>}
          {checkConflict && conflict && <div role="alert" className="rounded-md border border-danger p-3 text-sm">
            <p>Bu tarihler onaylı bir izinle çakışıyor: {dateLabel(conflict.start)} – {dateLabel(conflict.end)}.</p>
            <Button type="button" variant="link" onClick={() => guard.requestClose(() => { guard.release(); onConflict(conflict, employeeId); })}>Kaydı aç</Button>
          </div>}
          {row && (days === null || days > 366) && (
            <p className="text-xs text-muted-foreground">
              Eski kaydın tarihlerini değiştirmeden tür ve açıklamayı
              düzenleyebilirsiniz. Yeni tarih aralığı en fazla 366 takvim günü
              olabilir.
            </p>
          )}
          <p role="status" className="text-xs text-muted-foreground">
            {days === null
              ? "— · Tarih aralığını seçin."
              : `${days} takvim günü · Başlangıç ve bitiş dahil. Hafta sonu ve tatiller çıkarılmaz.`}
          </p>
          <FormFieldWrapper
            htmlFor="leave-notes"
            label="Açıklama (isteğe bağlı)"
          >
            <Textarea
              {...form.register("notes")}
              className="min-h-24 resize-y"
            />
          </FormFieldWrapper>
          <p className="rounded-md border bg-subtle p-3 text-xs leading-relaxed">
            Bu kayıt doğrudan onaylı kaydedilir. İzin tarihleri PDKS
            hesaplarında kullanılır; devam ve tatil bilgileri gün sonucunu
            değiştirebilir.
          </p>
        </fieldset>
        <FormActions className="static shrink-0 gap-2 p-4" isLoading={pending} onClose={close} cancelLabel="İptal" busyLabel="Kaydediliyor…" submitDisabled={checkConflict && conflict !== null} />
      </form>
    </>
  );
  const blockDismiss = (event: Event) => {
    if (pending) event.preventDefault();
  };
  return (
    <>
      {mobile ? (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <SheetContent
            size="full"
            className="flex h-dvh min-w-0 flex-col gap-0 p-0"
            aria-describedby={undefined}
            onEscapeKeyDown={blockDismiss}
            onPointerDownOutside={blockDismiss}
          >
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <DialogContent
            className="flex max-h-[90dvh] w-[calc(100%-32px)] max-w-[560px] flex-col gap-0 overflow-hidden p-0"
            onEscapeKeyDown={blockDismiss}
            onPointerDownOutside={blockDismiss}
          >
            {content}
          </DialogContent>
        </Dialog>
      )}
      {guard.dialog}
    </>
  );
}
