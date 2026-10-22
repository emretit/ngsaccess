import { usePermissions } from "@/hooks/usePermissions";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { errorMessage } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import {
  tomorrowInTurkey,
  pdksRuleSchema,
  recommendedPunchRules,
  pdksPublishPayload,
  ruleSummary,
  type PdksRuleValues,
  type RuleConfirmation,
  type Targets,
} from "./pdksRulesModel";
import { PdksRulesPunchFields } from "./pdksRulesPunchFields";
import { PdksRulesCheckpointFields } from "./pdksRulesCheckpointFields";
import { PdksRulesConfirmation } from "./pdksRulesConfirmation";

export {
  tomorrowInTurkey,
  pdksRuleSchema,
  recommendedPunchRules,
  pdksPublishPayload,
  ruleSummary,
} from "./pdksRulesModel";
export type {
  PdksRuleValues,
  Rule,
  Targets,
  RuleConfirmation,
} from "./pdksRulesModel";

export function PdksRulesSettings() {
  const { projectId } = useActiveProjectScope();
  const isAdmin = usePermissions().can("schedule.manage");
  const rules = useQuery(
    api.pdksRules.getRules,
    isAdmin && projectId ? { projectId } : "skip",
  );
  const targets = useQuery(
    api.pdksRules.listCheckpointTargets,
    isAdmin && projectId ? { projectId } : "skip",
  );
  if (!isAdmin || !projectId) return null;
  if (!rules || !targets)
    return (
      <section aria-label="PDKS devam kuralları" role="status">
        PDKS devam kuralları yükleniyor.
      </section>
    );
  return (
    <RulesEditor
      key={projectId}
      projectId={projectId}
      rules={rules}
      targets={targets}
    />
  );
}
function RulesEditor({
  projectId,
  rules,
  targets,
}: {
  projectId: Id<"projects">;
  rules: FunctionReturnType<typeof api.pdksRules.getRules>;
  targets: Targets;
}) {
  const publish = useMutation(api.pdksRules.publishRuleVersion);
  const remove = useMutation(api.pdksRules.deleteFutureRuleVersion);
  const [values, setValues] = useState<PdksRuleValues>(() => ({
    effectiveFrom: tomorrowInTurkey(),
    punchMode: "legacy",
    ...recommendedPunchRules,
    checkpointMode: "all",
    targets: [],
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmation, setConfirmation] = useState<RuleConfirmation>(null);
  const change = (patch: Partial<PdksRuleValues>) => {
    setValues((previous) => ({ ...previous, ...patch }));
    setError("");
    setSuccess("");
  };
  const save = async (parsed: PdksRuleValues) => {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await publish(pdksPublishPayload(projectId, parsed));
      setSuccess("Yeni PDKS kural sürümü yayınlandı.");
      setConfirmation(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };
  const toggleTarget = (
    target: PdksRuleValues["targets"][number],
    checked: boolean,
  ) => {
    const key = (item: PdksRuleValues["targets"][number]) =>
      item.targetType === "door"
        ? `door:${item.doorId}`
        : `device:${item.deviceId}`;
    change({
      targets: checked
        ? [...values.targets, target]
        : values.targets.filter((item) => key(item) !== key(target)),
    });
  };
  return (
    <section className="space-y-5" aria-labelledby="pdks-rules-heading">
      <div>
        <h2 id="pdks-rules-heading" className="text-lg font-semibold">
          PDKS devam kuralları
        </h2>
        <p className="text-sm text-muted-foreground">
          Cihaz senkronu gerekmez. Geçmiş günler değişmez.
        </p>
      </div>
      <div className="space-y-3 rounded-md border p-4">
        <p className="text-sm">
          <strong>Şu an geçerli: </strong>
          {ruleSummary(rules.current, targets)}
          {rules.current && <span> ({rules.current.effectiveFrom})</span>}
        </p>
        {rules.future.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Gelecek sürümler</h3>
            <ul className="divide-y">
              {rules.future.map((rule) => (
                <li
                  key={rule._id}
                  className="flex items-start justify-between gap-3 py-2 text-sm"
                >
                  <p>
                    <strong>{rule.effectiveFrom}</strong> ·{" "}
                    {ruleSummary(rule, targets)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setError("");
                      setConfirmation({ kind: "delete", rule });
                    }}
                    aria-label={`${rule.effectiveFrom} sürümünü sil`}
                  >
                    Sil
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <details>
          <summary className="cursor-pointer text-sm">
            Geçmiş sürümler (son 20)
          </summary>
          <ul className="mt-2 space-y-2 text-sm">
            {rules.history.slice(0, 20).map((rule) => (
              <li key={rule._id}>
                {rule.effectiveFrom} · {ruleSummary(rule, targets)}
              </li>
            ))}
          </ul>
          {rules.history.length === 0 && (
            <p className="text-sm text-muted-foreground">Geçmiş sürüm yok.</p>
          )}
        </details>
      </div>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const parsed = pdksRuleSchema.safeParse(values);
          if (!parsed.success) {
            setError(
              parsed.error.issues[0]?.message ?? "Alanları kontrol edin.",
            );
            return;
          }
          if (
            rules.future.some(
              (rule) => rule.effectiveFrom === parsed.data.effectiveFrom,
            )
          )
            setConfirmation({ kind: "publish", values: parsed.data });
          else void save(parsed.data);
        }}
      >
        <h3 className="font-medium">Yeni sürüm</h3>
        <fieldset disabled={pending} className="space-y-4">
          <PdksRulesPunchFields values={values} change={change} />
          <PdksRulesCheckpointFields
            values={values}
            targets={targets}
            change={change}
            toggleTarget={toggleTarget}
          />
          <Button
            type="submit"
            disabled={
              pending ||
              (values.checkpointMode === "selected" &&
                (values.targets.length === 0 || values.targets.length > 500))
            }
          >
            {pending ? "Yayınlanıyor…" : "Yeni sürümü yayınla"}
          </Button>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm">
          {success}
        </p>
      )}
      <PdksRulesConfirmation
        confirmation={confirmation}
        pending={pending}
        error={error}
        onClose={() => setConfirmation(null)}
        onConfirm={(event) => {
          event.preventDefault();
          if (!confirmation || pending) return;
          if (confirmation.kind === "publish") {
            void save(confirmation.values);
            return;
          }
          setPending(true);
          setError("");
          setSuccess("");
          void remove({ ruleVersionId: confirmation.rule._id })
            .then(() => {
              setConfirmation(null);
              setSuccess("Gelecek sürüm silindi.");
            })
            .catch((cause) => setError(errorMessage(cause)))
            .finally(() => setPending(false));
        }}
      />
    </section>
  );
}
