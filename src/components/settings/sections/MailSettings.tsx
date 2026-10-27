import { useState } from "react";
import { z } from "zod";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/lib/convexApi";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GOOGLE_SMTP_HOST, isGoogleSmtpHost } from "../../../../convex/lib/smtpConfig";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingsSaveBar } from "../SettingsSaveBar";
import { DraftNotice, useSettingsDraft, useSettingsFormState } from "../SettingsFormState";

const selectStyle = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

type SavedMail = NonNullable<FunctionReturnType<typeof api.mailSettings.get>>;

const mailSchema = z.object({
  host: z.string().trim().min(1, "SMTP sunucu adını girin"),
  port: z.union([z.literal(465), z.literal(587)]),
  username: z.string().trim().min(1, "Kullanıcı adını (e-posta adresi) girin"),
  password: z.string(),
  fromName: z.string().max(100, "En fazla 100 karakter"),
  fromEmail: z.string().trim().email("Geçerli bir e-posta adresi girin"),
  isActive: z.boolean(),
});
type MailValues = z.infer<typeof mailSchema>;

function passwordRequired(saved: SavedMail | null, values: MailValues) {
  return !saved?.hasPassword || saved.host !== values.host.trim().toLowerCase() || saved.username !== values.username.trim();
}

export function MailSettings() {
  const { projectId } = useActiveProjectScope();
  if (!projectId) return null;
  return <MailSettingsForm key={projectId} projectId={projectId} />;
}

function MailSettingsForm({ projectId }: { projectId: Id<"projects"> }) {
  const saved = useQuery(api.mailSettings.get, { projectId });
  const save = useAction(api.actions.projectMail.save);
  const remove = useMutation(api.mailSettings.remove);
  const draft = useSettingsDraft<MailValues>({
    host: saved?.host ?? GOOGLE_SMTP_HOST, port: saved?.port === 587 ? 587 : 465, username: saved?.username ?? "", password: "",
    fromName: saved?.fromName ?? "", fromEmail: saved?.fromEmail ?? "", isActive: saved?.isActive ?? true,
  });
  const [failed, setFailed] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useUnsavedChangesGuard(draft.dirty);
  const values = draft.values;
  const google = isGoogleSmtpHost(values.host);
  const parsed = mailSchema.superRefine((value, ctx) => {
    if (!value.password.trim() && passwordRequired(saved ?? null, value)) ctx.addIssue({ code: "custom", path: ["password"], message: google ? "16 haneli uygulama şifresini girin" : "SMTP şifresini girin" });
  }).safeParse(values);
  const fieldError = (field: keyof MailValues) => !parsed.success && draft.dirty ? parsed.error.issues.find(issue => issue.path[0] === field)?.message : undefined;
  const action = useAsyncAction(async (payload: MailValues) => {
    await save({ projectId, ...payload, password: payload.password.trim() || undefined });
  }, { success: "E-posta hesabı kaydedildi", error: "E-posta hesabı kaydedilemedi" });
  useSettingsFormState("mail", draft.dirty, action.pending);
  if (saved === undefined) return <SectionSkeleton label="E-posta ayarları yükleniyor" />;

  const chooseProvider = (next: "google" | "custom") => {
    if (next === "google") draft.change({ host: GOOGLE_SMTP_HOST, port: 465, fromEmail: values.fromEmail || values.username });
    else if (google) draft.change({ host: "" });
  };
  return <div className="space-y-6">
    <p role="status" className="rounded border p-3 text-sm break-words">
      {saved?.isActive ? <>Rapor e-postaları <strong>{saved.fromEmail}</strong> hesabınızdan gönderiliyor.</>
        : <>Rapor e-postaları şu an NGS+ adresinden (noreply@ngsplus.app) gönderiliyor. Kendi Google Workspace veya kurumsal e-posta hesabınızdan göndermek için aşağıdaki hesabı kaydedin.</>}
    </p>
    <form className="space-y-4" noValidate onSubmit={async event => {
      event.preventDefault();
      if (!parsed.success) return;
      const success = await action.run(parsed.data); setFailed(!success); if (success) draft.reset();
    }}>
      <DraftNotice remoteChanged={draft.remoteChanged} failed={failed} />
      <fieldset disabled={action.pending} className="min-w-0 space-y-4">
        <div role="group" aria-label="E-posta sağlayıcısı" className="flex flex-wrap gap-2">
          <Button type="button" variant={google ? "default" : "outline"} aria-pressed={google} onClick={() => chooseProvider("google")}>Google Workspace / Gmail</Button>
          <Button type="button" variant={google ? "outline" : "default"} aria-pressed={!google} onClick={() => chooseProvider("custom")}>Diğer SMTP</Button>
        </div>
        {google && <GoogleAppPasswordGuide />}
        <div className="grid gap-4 min-[761px]:grid-cols-[1fr_180px]">
          <FormFieldWrapper htmlFor="mail-host" label="SMTP sunucusu *" error={fieldError("host")}>
            <Input value={values.host} autoComplete="off" placeholder="smtp.firmaniz.com" onChange={event => draft.change({ host: event.target.value })} />
          </FormFieldWrapper>
          <FormFieldWrapper htmlFor="mail-port" label="Port">
            <select className={selectStyle} value={values.port} onChange={event => draft.change({ port: event.target.value === "587" ? 587 : 465 })}>
              <option value={465}>465 (SSL)</option><option value={587}>587 (STARTTLS)</option>
            </select>
          </FormFieldWrapper>
        </div>
        <FormFieldWrapper htmlFor="mail-username" label="Kullanıcı adı *" hint={google ? "Google hesabınızın tam e-posta adresi." : undefined} error={fieldError("username")}>
          <Input type="email" value={values.username} autoComplete="off" onChange={event => {
            const username = event.target.value;
            draft.change(google && (values.fromEmail === "" || values.fromEmail === values.username) ? { username, fromEmail: username } : { username });
          }} />
        </FormFieldWrapper>
        <FormFieldWrapper htmlFor="mail-password" label={google ? "Uygulama şifresi *" : "Şifre *"} error={fieldError("password")}
          hint={saved?.hasPassword ? "Kayıtlı şifre gösterilmez. Değiştirmek için yenisini yazın; sunucu veya kullanıcı adı değişirse yeniden girmeniz gerekir." : undefined}>
          <Input type="password" value={values.password} autoComplete="new-password" placeholder={saved?.hasPassword ? "••••••••  (kayıtlı)" : google ? "abcd efgh ijkl mnop" : ""} onChange={event => draft.change({ password: event.target.value })} />
        </FormFieldWrapper>
        <div className="grid gap-4 min-[761px]:grid-cols-2">
          <FormFieldWrapper htmlFor="mail-from-name" label="Gönderen adı" hint="Örn. firma adınız." error={fieldError("fromName")}>
            <Input value={values.fromName} onChange={event => draft.change({ fromName: event.target.value })} />
          </FormFieldWrapper>
          <FormFieldWrapper htmlFor="mail-from-email" label="Gönderen e-posta *" error={fieldError("fromEmail")}
            hint={google ? "Google hesabının kendisi ya da Gmail'de \"Farklı gönder\" ile doğrulanmış bir adres olmalı." : undefined}>
            <Input type="email" value={values.fromEmail} onChange={event => draft.change({ fromEmail: event.target.value })} />
          </FormFieldWrapper>
        </div>
        <FormFieldWrapper inline htmlFor="mail-active" label="Rapor e-postalarını bu hesaptan gönder" hint="Kapalıyken hesap saklanır ama raporlar NGS+ adresinden gider.">
          <Switch checked={values.isActive} onCheckedChange={isActive => draft.change({ isActive })} />
        </FormFieldWrapper>
      </fieldset>
      <SettingsSaveBar dirty={draft.dirty} saving={action.pending} valid={parsed.success} label="Hesabı kaydet" onCancel={() => { draft.reset(); setFailed(false); }} />
    </form>
    {saved && !draft.dirty && <TestMail projectId={projectId} />}
    {saved && <div className="border-t pt-4">
      <Button type="button" variant="outline" disabled={action.pending} onClick={() => setConfirmRemove(true)}>Hesabı kaldır</Button>
    </div>}
    <ConfirmDestructive
      open={confirmRemove}
      onOpenChange={setConfirmRemove}
      title="E-posta hesabı kaldırılsın mı?"
      objectName={saved?.fromEmail ?? "Kayıtlı SMTP hesabı"}
      effects={["Kayıtlı SMTP bilgileri ve şifre silinir. Rapor e-postaları NGS+ adresinden gönderilmeye devam eder."]}
      confirmLabel="Kaldır"
      errorTitle="E-posta hesabı kaldırılamadı"
      onConfirm={async () => {
        await remove({ projectId });
        draft.reset();
        notify.success("E-posta hesabı kaldırıldı; raporlar NGS+ adresinden gidecek");
      }}
    />
  </div>;
}

function GoogleAppPasswordGuide() {
  const link = "underline underline-offset-2";
  return <div className="rounded border p-3 text-sm">
    <p className="font-medium">Google Workspace / Gmail için uygulama şifresi</p>
    <p className="mt-1 text-muted-foreground">Google, normal hesap şifresiyle SMTP girişine izin vermez. Bir kez uygulama şifresi oluşturmanız yeterli:</p>
    <ol className="mt-2 list-decimal space-y-1 pl-5">
      <li>Google hesabınızda <a className={link} href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">2 Adımlı Doğrulama</a>'yı açın.</li>
      <li><a className={link} href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Uygulama şifreleri</a> sayfasında ad olarak "NGS+" yazıp Oluştur'a basın.</li>
      <li>Gösterilen 16 haneli şifreyi aşağıdaki "Uygulama şifresi" alanına yapıştırın, kaydedin ve test maili gönderin.</li>
    </ol>
    <p className="mt-2 text-muted-foreground">Uygulama şifreleri sayfası açılmıyorsa Workspace yöneticiniz 2 Adımlı Doğrulama'yı kapatmış olabilir; Yönetici Konsolu › Güvenlik › 2 Adımlı Doğrulama'dan izin verilmelidir.</p>
  </div>;
}

function TestMail({ projectId }: { projectId: Id<"projects"> }) {
  const sendTest = useAction(api.actions.projectMail.sendTest);
  const [to, setTo] = useState("");
  const [result, setResult] = useState<FunctionReturnType<typeof api.actions.projectMail.sendTest> | null>(null);
  const action = useAsyncAction(async () => {
    setResult(null);
    setResult(await sendTest({ projectId, to: to.trim() || undefined }));
  }, { error: "Test maili gönderilemedi" });
  return <section className="space-y-3 border-t pt-4">
    <h3 className="text-sm font-semibold">Bağlantıyı test et</h3>
    <form className="flex flex-wrap items-end gap-3" noValidate onSubmit={event => { event.preventDefault(); void action.run(); }}>
      <FormFieldWrapper className="min-w-0 flex-1" htmlFor="mail-test-to" label="Test alıcısı" hint="Boş bırakırsanız kendi hesabınızın e-postasına gider.">
        <Input type="email" value={to} disabled={action.pending} onChange={event => setTo(event.target.value)} />
      </FormFieldWrapper>
      <Button type="submit" disabled={action.pending}>{action.pending ? "Gönderiliyor…" : "Test maili gönder"}</Button>
    </form>
    {result && <p role={result.ok ? "status" : "alert"} className={`text-sm break-words ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
      {result.ok ? `Test maili ${result.to} adresine gönderildi. Gelen kutusunu (ve spam klasörünü) kontrol edin.` : result.error}
    </p>}
  </section>;
}
