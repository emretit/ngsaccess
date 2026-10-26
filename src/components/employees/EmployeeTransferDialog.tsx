import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useActiveProject, useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { errorMessage } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmploymentEmployee } from "./lib/employment";

type Projects = FunctionReturnType<typeof api.projects.listActive>;
type Permissions = FunctionReturnType<typeof api.roles.myPermissionsByProject>;

export function EmployeeTransferDialog({ employee, projects, permissions, open, onOpenChange }: {
  employee: EmploymentEmployee; projects: Projects; permissions: Permissions;
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const [targetId, setTargetId] = useState<Id<"projects">>();
  const [departmentId, setDepartmentId] = useState<Id<"departments">>();
  const [ruleIds, setRuleIds] = useState<Id<"accessRules">[]>([]);
  const [step, setStep] = useState(1);
  const [result, setResult] = useState<FunctionReturnType<typeof api.employeeTermination.startTransfer>>();
  const [failure, setFailure] = useState<string>();
  const navigate = useNavigate();
  const { setActiveProjectId } = useActiveProject();
  const start = useMutation(api.employeeTermination.startTransfer);
  const allowedProjects = projects.filter(project => project._id !== employee.projectId && permissions.some(row => row.projectId === project._id && row.permissions.includes("employees.manage")));
  const target = allowedProjects.find(project => project._id === targetId);
  const canManageRules = permissions.some(row => row.projectId === targetId && row.permissions.includes("accessRules.manage"));
  const departments = useQuery(api.departments.list, target && !result && step >= 2 ? { projectId: target._id } : "skip");
  const rules = useQuery(api.accessRules.listMemberships, target && canManageRules && !result && step >= 2 ? { projectId: target._id } : "skip");
  const preflight = useQuery(api.employeeTermination.transferPreflight, target && !result && step === 3 ? { employeeId: employee._id, targetProjectId: target._id } : "skip");
  const ready = !!target && preflight !== undefined && preflight.reasons.length === 0 && departments !== undefined && (!canManageRules || rules !== undefined);
  const { run, pending } = useAsyncAction(async () => {
    if (!target || !ready) return;
    setFailure(undefined);
    try {
      const started = await start({ employeeId: employee._id, targetProjectId: target._id,
        departmentId, accessRuleIds: canManageRules ? ruleIds.filter(ruleId => rules?.some(rule => rule._id === ruleId && rule.isActive !== false)) : [] });
      setResult(started);
    } catch (error) {
      setFailure(errorMessage(error));
      throw error;
    }
  }, { success: "Taşıma başlatıldı" });
  useProjectChangeGuard(pending, () => {});
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto" aria-busy={pending}
      onEscapeKeyDown={event => { if (pending) event.preventDefault(); }}
      onInteractOutside={event => { if (pending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Başka projeye taşı</DialogTitle><DialogDescription>{employee.firstName} {employee.lastName} için hedef projede yeni bir kişi kaydı açılır.</DialogDescription></DialogHeader>
      {result ? <div className="space-y-4" role="status">
        <p className="text-sm">Taşıma başlatıldı. Kart, eski cihazlardan silindiği onaylanınca yeni projeye geçer. İlerlemeyi kişi ayrıntısından izleyebilirsiniz.</p>
        <DialogFooter><Button className="max-sm:min-h-11" variant="outline" disabled={pending} onClick={() => { if (!pending) onOpenChange(false); }}>Kapat</Button><Button className="max-sm:min-h-11" disabled={pending} onClick={() => {
          if (pending || !targetId) return;
          navigate("/employees", { state: { transferEmployeeId: result.targetEmployeeId, transferProjectId: targetId } });
          setActiveProjectId(targetId);
        }}>Yeni projedeki kayda git</Button></DialogFooter>
      </div> : <form className="space-y-4" onSubmit={async event => {
        event.preventDefault();
        if (!ready || pending || step !== 3) return;
        await run();
      }}>
        <p className="text-xs text-muted-foreground" aria-live="polite">Adım {step} / 3 · {step === 1 ? "Hedef proje" : step === 2 ? "Departman ve erişim" : "Ön kontrol ve onay"}</p>
        <fieldset disabled={pending} className="space-y-4">
          {step === 1 && <div className="space-y-2"><Label htmlFor={`${id}-project`}>Hedef proje</Label>
            <Select value={targetId ?? ""} onValueChange={value => {
              const project = allowedProjects.find(item => item._id === value);
              setTargetId(project?._id); setDepartmentId(undefined); setRuleIds([]); setFailure(undefined);
            }}><SelectTrigger className="max-sm:min-h-11" id={`${id}-project`}><SelectValue placeholder="Proje seçin" /></SelectTrigger><SelectContent>{allowedProjects.map(project => <SelectItem key={project._id} value={project._id}>{project.name}</SelectItem>)}</SelectContent></Select>
            {!allowedProjects.length && <p className="text-sm">Kişi yönetme yetkiniz olan başka proje yok. Proje yöneticinizden yetki isteyin.</p>}
          </div>}
          {step === 2 && <>
            <div className="space-y-2"><Label htmlFor={`${id}-department`}>Departman (opsiyonel)</Label><Select value={departmentId ?? "none"} onValueChange={value => setDepartmentId(departments?.find(item => item._id === value)?._id)} disabled={departments === undefined}><SelectTrigger className="max-sm:min-h-11" id={`${id}-department`}><SelectValue placeholder="Departman seçin" /></SelectTrigger><SelectContent><SelectItem value="none">Departman atama</SelectItem>{departments?.map(department => <SelectItem key={department._id} value={department._id}>{department.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><p className="text-sm font-medium">Erişim kuralları (opsiyonel)</p>
              {!canManageRules ? <p className="text-sm text-muted-foreground">Hedef projede erişim kuralı yönetme yetkiniz yok. Taşıma sonrasında proje yöneticisi kural atayabilir.</p> : rules === undefined ? <p role="status">Kurallar yükleniyor…</p> : <>
                {rules.filter(rule => rule.isActive !== false).map(rule => <Label className="flex min-h-11 items-center gap-2" key={rule._id}><Checkbox checked={ruleIds.includes(rule._id)} onCheckedChange={checked => setRuleIds(previous => checked === true ? [...previous, rule._id] : previous.filter(value => value !== rule._id))} />{rule.name}</Label>)}
                {!rules.some(rule => rule.isActive !== false) && <p className="text-sm text-muted-foreground">Hedef projede aktif erişim kuralı yok.</p>}
              </>}
            </div>
          </>}
          {step === 3 && <>
            <p className="text-sm font-medium">Hedef: {target?.name ?? "Hedef proje yetkiniz değişti; geri dönüp proje seçin."}</p>
            {preflight === undefined ? <p role="status">Taşıma engelleri kontrol ediliyor…</p> : preflight.reasons.length ? <div role="alert" className="space-y-2 text-sm"><p className="font-medium">Taşıma başlatılamıyor</p><ul className="list-disc space-y-1 pl-5">{preflight.reasons.filter(reason => reason.code !== "TRANSFER_DEVICE_OFFLINE").map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.message}{reason.code.includes("PERMISSION") && " Proje yöneticinizden gerekli yetkiyi isteyin."}</li>)}{preflight.offlineDevices.map(device => <li key={device.deviceId}>{device.name} çevrimdışı — cihaz açılınca tekrar deneyin.</li>)}{preflight.reasons.filter(reason => reason.code === "TRANSFER_DEVICE_OFFLINE" && preflight.offlineDevices.length === 0).map(reason => <li key={reason.code}>{reason.message}</li>)}</ul></div> : <p className="text-sm" role="status">Taşımaya engel bulunmadı. {preflight.targetDeviceCount} eski cihazdan silme onayı izlenecek.</p>}
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>Eski projede kişi hemen pasif olur ve eski kapılardaki erişimi kesilir; geçmişi orada kalır.</li>
              <li>Ücret bilgisi yetkiniz varsa yeni kayda kopyalanır.</li>
              <li>Kart eski cihazlardan silindiği onaylanınca yeni projeye geçer; genelde birkaç dakika sürer.</li>
              <li>Mobil hesap için yeni projede yeniden davet gerekir.</li>
              <li>Parmak izi yeni projede yeniden kaydedilir.</li>
              <li>Vardiya ataması yeni projede yapılmalı; aksi halde PDKS oluşmaz.</li>
              <li>Taşıma 24 saatte bitmezse "takıldı" olur; yeniden deneyebilir ya da iptal edebilirsiniz.</li>
            </ul>
          </>}
        </fieldset>
        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        <DialogFooter><Button className="max-sm:min-h-11" type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>Vazgeç</Button>
          {step > 1 && <Button className="max-sm:min-h-11" type="button" variant="outline" disabled={pending} onClick={() => { setFailure(undefined); setStep(previous => previous - 1); }}>Geri</Button>}
          {step < 3 ? <Button className="max-sm:min-h-11" type="button" disabled={!target || pending} onClick={() => { setFailure(undefined); setStep(previous => previous + 1); }}>Devam</Button> : <Button className="max-sm:min-h-11" type="submit" disabled={!ready || pending}>{pending ? "Taşınıyor…" : "Taşı"}</Button>}
        </DialogFooter>
      </form>}
    </DialogContent>
  </Dialog>;
}
