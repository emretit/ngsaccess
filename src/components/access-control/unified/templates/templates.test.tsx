vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => state.admin, loading: false }) }));
import type { ReactNode, MouseEventHandler } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { emptyWeek, inspectSchedule } from "./schedule";
const state = vi.hoisted(() => ({
  admin: true,
  rows: [] as unknown[],
  query: vi.fn(),
  params: "",
  override: false,
  slots: [] as unknown[],
  slot: 0,
  changes: [] as [number, unknown][],
  buttons: new Map<string, MouseEventHandler<HTMLButtonElement>>(),
  inputs: new Map<string, import("react").ChangeEventHandler<HTMLInputElement>>(),
  mutation: vi.fn(),
  success: vi.fn(),
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    const index = state.slot++;
    if (state.override && index < state.slots.length) {
      return [state.slots[index], (next: unknown) => state.changes.push([index, next])];
    }
    return actual.useState(initial);
  } };
});
vi.mock("@/components/ui/button", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/button")>();
  return { ...actual, Button: (props: import("react").ComponentProps<typeof actual.Button>) => {
    if (props.onClick && typeof props.children === "string") state.buttons.set(props.children, props.onClick);
    return <actual.Button {...props} />;
  } };
});
vi.mock("@/lib/notify", () => ({ notify: { success: state.success } }));
vi.mock("@/components/ui/input", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/input")>();
  return { ...actual, Input: (props: import("react").ComponentProps<typeof actual.Input>) => {
    if (props.onChange && props["aria-label"]) state.inputs.set(props["aria-label"], props.onChange);
    return <actual.Input {...props} />;
  } };
});
beforeEach(() => {
  state.override = false;
  state.slot = 0;
  state.params = "";
  state.buttons.clear();
  state.inputs.clear();
  state.changes = [];
  state.mutation.mockReset();
  state.success.mockReset();
});
vi.mock("convex/react", () => ({
  useQuery: () => state.rows,
  useConvex: () => ({ query: state.query }),
  useMutation: () => state.mutation,
}));
vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams(state.params), vi.fn()],
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ projectId: "p", canManage: state.admin }),
  useProjectChangeGuard: () => undefined,
}));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({
  useUnsavedChangesGuard: () => ({ requestClose: vi.fn(), dialog: null }),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
}));
import TemplatesPage from "./TemplatesPage";
import {
  TemplateEditor,
  WeekEditor,
  ImpactConfirmation,
  type Template,
} from "./TemplateEditor";
import { TemplatePicker } from "./TemplatePicker";
import { RuleScheduleSummary } from "./RuleScheduleSummary";
const template: Template = {
  _id: "t" as Id<"accessScheduleTemplates">,
  _creationTime: 0,
  projectId: "p" as Id<"projects">,
  name: "Mesai",
  week: emptyWeek(),
  ruleCount: 2,
  version: 1,
  createdAt: "",
  updatedAt: "",
};
describe("şablon arayüzü SSR", () => {
  it("25:00 girilen ikinci aralığın hatasını satır altında ve bitiş alanına bağlı gösterir", () => {
    let week = emptyWeek();
    week.Monday = [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }];
    const render = () => renderToStaticMarkup(<WeekEditor week={week} onChange={(next) => { week = next; }} />);
    render();
    const change = state.inputs.get("Pazartesi 2. bitiş");
    expect(change).toBeDefined();
    change?.({ target: { value: "25:00" } } as import("react").ChangeEvent<HTMLInputElement>);
    const html = render();
    const input = html.match(/<input[^>]*aria-label="Pazartesi 2\. bitiş"[^>]*>/)?.[0] ?? "";
    const errorId = input.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(input).toContain('aria-invalid="true"');
    expect(errorId).toBeTruthy();
    const message = `id="${errorId}" role="alert"`;
    expect(html).toContain(message);
    expect(html).toContain("Pazartesi 2. aralık: bitiş 24:00&#x27;ü geçemez");
    expect(html.indexOf(message)).toBeGreaterThan(html.indexOf(input));
    expect(html.indexOf(message)).toBeLessThan(html.indexOf("Pazartesi aralık ekle"));
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
    state.inputs.get("Pazartesi 2. bitiş")?.({ target: { value: "24:00" } } as import("react").ChangeEvent<HTMLInputElement>);
    expect(render()).not.toContain('role="alert"');
  });
  it("görünür Başlangıç/Bitiş etiketlerini ve biçim ipuçlarını saat alanlarına bağlar", () => {
    const week = emptyWeek();
    week.Monday = [{ start: "22:00", end: "24:00" }];
    const html = renderToStaticMarkup(<WeekEditor week={week} onChange={() => undefined} />);
    for (const [field, label] of [["başlangıç", "Başlangıç"], ["bitiş", "Bitiş"]]) {
      const input = html.match(new RegExp(`<input[^>]*aria-label="Pazartesi 1\\. ${field}"[^>]*>`))?.[0] ?? "";
      const id = input.match(/ id="([^"]+)"/)?.[1];
      const hintId = input.match(/aria-describedby="([^"]+)"/)?.[1];
      expect(id).toBeTruthy();
      expect(html).toContain(`for="${id}"`);
      expect(html).toMatch(new RegExp(`for="${id}"[^>]*>${label}</label>`));
      expect(input).toContain('aria-invalid="false"');
      expect(input).toContain("min-h-11");
      expect(html).toContain(`id="${hintId}"`);
    }
    expect(html).toContain("Örnek: 22:00");
    expect(html).toContain("En fazla 24:00");
  });
  it("gece açıklamasını ilgili satırda, başka gün hatalıyken de gösterir", () => {
    const week = emptyWeek();
    week.Monday = [{ start: "08:00", end: "25:00" }];
    week.Sunday = [{ start: "22:00", end: "06:00" }];
    const html = renderToStaticMarkup(<WeekEditor week={week} onChange={() => undefined} />);
    const sunday = html.slice(html.indexOf(">Pazar</legend>"));
    expect(sunday).toContain("Pazar 1. aralık: Ertesi güne taşan aralık");
    expect(sunday).toContain("Pzt 00:00–06:00");
    expect(sunday.indexOf("Ertesi güne taşan aralık")).toBeLessThan(sunday.indexOf("Pazar aralık ekle"));
  });
  it("boş liste şablonun amacını ve Kapı Planları farkını açıklar", () => {
    state.admin = true;
    state.rows = [];
    const html = renderToStaticMarkup(<TemplatesPage />);
    expect(html).toContain('<h1 class="text-xl font-semibold">Zaman Şablonları</h1>');
    expect(html).toContain("Kurallarda tekrar kullanılan haftalık geçiş saatleri.");
    expect(html).toContain("Kişilerin geçebileceği gün ve saatleri bir kez tanımlayın, sonra Kurallar&#x27;da bir kurala bağlayın.");
    expect(html).toContain("Kapının herkes için açık ya da kilitli kalma saatleri Kapı Planları&#x27;nda ayarlanır.");
  });

  it("bağlı şablonda silme pasif ve ipucu görünür", () => {
    state.admin = true;
    state.rows = [template];
    const html = renderToStaticMarkup(<TemplatesPage />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sil<\/button>/);
    expect(html).toContain("2 kural kullanıyor");
    expect(html).toContain("Arşivlenenleri göster");
    expect(html).toContain("Düzenle");
  });
  it("okuyucuya yazma aksiyonu sunmaz", () => {
    state.admin = false;
    state.rows = [template];
    const html = renderToStaticMarkup(<TemplatesPage />);
    for (const action of [
      "Yeni şablon",
      "Düzenle",
      "Kopyala",
      ">Arşivle<",
      ">Sil<",
    ])
      expect(html).not.toContain(action);
    state.admin = true;
  });
  it("boş haftada uyarıyı ve sıfır cihaz hesabını gösterir", () => {
    const html = renderToStaticMarkup(
      <TemplateEditor
        projectId={template.projectId}
        template={null}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("Bu şablon hiç erişim vermez");
    expect(html).toContain(
      "Hikvision: günde en fazla 8 aralık — bu şablonda en çok 0 ✓",
    );
    expect(html).toContain("Haftalık saat önizlemesi");
    expect(html).toContain("Haftalık geçiş saatleri");
    expect(html).toContain("Cihaz uyumluluğu");
    expect(html).toContain("IDE: en fazla 8 izin kaydı — bu şablon 0 kullanıyor ✓");
    expect(html).not.toContain("Hik:");
    expect(html).not.toContain("Birleştirilmiş önizleme");
  });
  it("dokuzuncu aralığı ekleyen düğme pasiftir; 24:00 seçilebilir", () => {
    const week = emptyWeek();
    week.Monday = Array.from({ length: 8 }, () => ({
      start: "08:00",
      end: "17:00",
    }));
    const html = renderToStaticMarkup(
      <WeekEditor week={week} onChange={() => undefined} />,
    );
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>Pazartesi aralık ekle<\/button>/,
    );
    expect(html).toContain('value="24:00"');
    expect(html).toContain("Pazartesi 8. aralığı sil");
  });
  it("gece bölmeyi ve aşılmış IDE kontrolünü gösterir", () => {
    const week = emptyWeek();
    week.Sunday = [{ start: "22:00", end: "02:00" }];
    const html = renderToStaticMarkup(
      <TemplateEditor
        projectId={template.projectId}
        template={{ ...template, week }}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain("Ertesi güne taşan aralık");
    expect(html).toContain("00:00–02:00");
    week.Tuesday = Array.from({ length: 8 }, (_, i) => ({
      start: `${String(i * 2 + 3).padStart(2, "0")}:00`,
      end: `${String(i * 2 + 4).padStart(2, "0")}:00`,
    }));
    expect(inspectSchedule(week).ide).toBeGreaterThan(8);
    const over = renderToStaticMarkup(
      <TemplateEditor
        projectId={template.projectId}
        template={{ ...template, week }}
        onClose={() => undefined}
      />,
    );
    expect(over).toContain("✗");
    expect(over).toContain("Aralıkları birleştirin ya da azaltın.");
    expect(over).toMatch(/<button[^>]*disabled=""[^>]*>Kaydet<\/button>/);
  });
  it("etki onayında kişi/panel kapasite aşımı kaydı engeller", () => {
    const impact = {
      ruleCount: 2,
      deviceCount: 3,
      hikMaxSegmentsPerDay: 2,
      ideRecordCount: 3,
      ideOverLimit: [],
    };
    const props = {
      pending: false,
      onBack: () => undefined,
      onConfirm: () => undefined,
    };
    const html = renderToStaticMarkup(
      <ImpactConfirmation {...props} impact={impact} />,
    );
    expect(html).toContain(
      "2 kural ve 3 cihaz güncellenecek; cihaz gönderimi yaklaşık 20 saniye içinde başlar.",
    );
    const blocked = renderToStaticMarkup(
      <ImpactConfirmation
        {...props}
        impact={{
          ...impact,
          ideOverLimit: [
            {
              employeeId: "employee" as Id<"employees">,
              deviceId: "device" as Id<"devices">,
              total: 17,
              employeeName: "Ayşe Yılmaz",
              deviceName: "Ana giriş",
            },
          ],
        }}
      />,
    );
    expect(blocked).toContain("IDE cihazında 16 izin sınırı aşılıyor");
    expect(blocked).toContain("Ayşe Yılmaz — Ana giriş (toplam 17/16)");
    expect(blocked).toMatch(
      /<button[^>]*disabled=""[^>]*>Onayla ve kaydet<\/button>/,
    );
  });
  it("ad boşsa IDE aşımında kimlikleri gösterir", () => {
    const html = renderToStaticMarkup(<ImpactConfirmation
      impact={{ ruleCount: 1, deviceCount: 1, hikMaxSegmentsPerDay: 1, ideRecordCount: 1,
        ideOverLimit: [{ employeeId: "employee" as Id<"employees">, deviceId: "device" as Id<"devices">,
          employeeName: "", deviceName: " ", total: 18 }] }}
      pending={false} onBack={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain("employee — device (toplam 18/16)");
  });
  it("silinen açık şablon için bilgi ve kapatma düğmesi gösterir", () => {
    state.params = "template=t";
    state.rows = [];
    const html = renderToStaticMarkup(<TemplatesPage />);
    expect(html).toContain("Bu şablon silindi");
    expect(html).toContain("Kapat");
    expect(html).not.toContain("Haftalık saat önizlemesi");
    state.params = "";
  });
  it("yalnız mevcut bağlı arşivli şablonu seçicide tutar", () => {
    state.rows = [
      { ...template, isArchived: true },
      { ...template, _id: "other", name: "Diğer arşiv", isArchived: true },
    ];
    const html = renderToStaticMarkup(
      <TemplatePicker
        value="t"
        currentTemplateId="t"
        onChange={() => undefined}
      />,
    );
    expect(html).toContain("Mesai (arşivli)");
    expect(html).not.toContain("Diğer arşiv");
  });
  it("şablon adını özet ipucuyla ve kayıp şablonu kapalı gösterir", () => {
    state.rows = [template];
    expect(
      renderToStaticMarkup(
        <RuleScheduleSummary
          templateId={template._id}
          projectId={template.projectId}
        />,
      ),
    ).toContain('title="Erişim yok"');
    state.rows = [];
    const html = renderToStaticMarkup(
      <RuleScheduleSummary
        templateId={template._id}
        projectId={template.projectId}
      />,
    );
    expect(html).toContain("Şablon bulunamadı — erişim kapalı");
    expect(html).toContain("text-danger");
  });
});

describe("şablon aksiyonu geri bildirimi", () => {
  const click = (label: string) => state.buttons.get(label)?.({} as import("react").MouseEvent<HTMLButtonElement>);
  function page(action: { kind: "copy" | "delete"; template: Template } | null) {
    state.override = true;
    state.slots = [false, false, action, "Kopya", "Önceki hata", false];
    state.slot = 0;
    state.rows = [{ ...template, ruleCount: 0 }];
    state.admin = true;
    return renderToStaticMarkup(<TemplatesPage />);
  }
  it("dialog hatasını tek yerde gösterir ve yeni aksiyonda temizler", () => {
    expect(page({ kind: "copy", template }).match(/Önceki hata/g)).toHaveLength(1);
    click("Yeni şablon");
    expect(state.changes).toContainEqual([4, ""]);
    state.changes = [];
    page(null);
    click("Kopyala");
    expect(state.changes).toContainEqual([4, ""]);
    state.changes = [];
    click("Sil");
    expect(state.changes).toContainEqual([4, ""]);
  });
  it.each([
    ["copy", "Kopyala", "Şablon kopyalandı"],
    ["delete", "Şablonu sil", "Şablon silindi"],
    [null, "Arşivle", "Şablon arşivlendi"],
  ] as const)("%s başarısında bildirir, hatayı temizler ve dialogu kapatır", async (kind, label, message) => {
    page(kind ? { kind, template } : null);
    click(label);
    await vi.waitFor(() => expect(state.success).toHaveBeenCalledWith(message));
    expect(state.mutation).toHaveBeenCalledOnce();
    expect(state.changes.filter(([index, value]) => index === 4 && value === "")).toHaveLength(2);
    expect(state.changes).toContainEqual([2, null]);
  });
  it("başarısız aksiyonda başarı bildirimi vermez ve hatayı dialogda tutar", async () => {
    state.mutation.mockRejectedValueOnce(new Error("Şablon kullanılıyor"));
    page({ kind: "delete", template });
    click("Şablonu sil");
    await vi.waitFor(() => expect(state.changes).toContainEqual([4, "Şablon kullanılıyor"]));
    expect(state.success).not.toHaveBeenCalled();
    expect(state.changes).not.toContainEqual([2, null]);
  });
});

it("yalnız ad değişince onayda cihaz gönderimi sözü vermez", () => {
  state.override = true;
  state.slots = ["Yeni ad", "", template.week, "", false,
    { ruleCount: 2, deviceCount: 3, hikMaxSegmentsPerDay: 0, ideRecordCount: 0, ideOverLimit: [] }];
  const html = renderToStaticMarkup(<TemplateEditor template={template} projectId={template.projectId} onClose={() => undefined} />);
  const confirmation = html.slice(html.indexOf('role="alertdialog"'));
  expect(confirmation).toContain("Geçiş saatleri değişmedi; cihaza gönderim gerekmiyor.");
  expect(confirmation).not.toContain("20");
});
