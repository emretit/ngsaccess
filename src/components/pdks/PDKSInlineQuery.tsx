import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Sparkles, Send, MessageSquare, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TurkishNlpParser, type NaturalLanguageQuery } from "./chat/services/parsers/turkishNlpParser";
import { getDateRange, PRESET_LABELS, type PresetKey } from "@/lib/pdksDateRanges";
import { STATUS_FILTER_LABELS } from "./statusMeta";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FilterValues, StatusFilter } from "./dashboard/PDKSFilterBar";

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/[İı]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/\s+/g, " ")
    .trim();
}

const SAMPLE_QUERIES = [
  "Bugün kimler geç kaldı?",
  "Bu hafta devamsızlık yapanlar",
  "Bu ay en çok geç kalanlar",
  "Bu ay mesai yapanlar",
];

const NL_TIME_TO_PRESET: Partial<Record<NaturalLanguageQuery["timeRange"]["type"], PresetKey>> = {
  today: "today",
  yesterday: "yesterday",
  this_week: "this-week",
  last_week: "last-week",
  this_month: "this-month",
  last_month: "last-month",
};

function intentToStatus(intent: NaturalLanguageQuery["intent"]): StatusFilter | null {
  switch (intent) {
    case "late":
      return "late";
    case "absent":
      return "absent";
    case "present":
      return "present";
    default:
      return null;
  }
}

interface Suggestion {
  status?: StatusFilter;
  dateRange?: { from: Date; to: Date };
  departmentId?: Id<"departments">;
  person?: string;
  description: string;
}

interface MatchableDept {
  _id: Id<"departments">;
  name: string;
}

function findDepartmentMatch(
  text: string,
  departments: MatchableDept[] | undefined,
): MatchableDept | null {
  if (!departments) return null;
  const normText = normalize(text);
  for (const d of departments) {
    if (normText.includes(normalize(d.name))) return d;
  }
  return null;
}

function computeSuggestion(
  query: string,
  departments: MatchableDept[] | undefined,
): Suggestion | null {
  if (!query.trim()) return null;
  const nl = TurkishNlpParser.parse(query);
  const status = intentToStatus(nl.intent);
  const presetKey = NL_TIME_TO_PRESET[nl.timeRange.type];
  const dateRange = presetKey ? getDateRange(presetKey) : null;
  const deptMatch = findDepartmentMatch(query, departments);
  const personMatch = nl.filters.employee?.trim();

  if (!status && !dateRange && !deptMatch && !personMatch) return null;

  const bits: string[] = [];
  if (presetKey) bits.push(PRESET_LABELS[presetKey]);
  if (deptMatch) bits.push(`Departman: ${deptMatch.name}`);
  if (status) bits.push(STATUS_FILTER_LABELS[status]);
  if (personMatch) bits.push(`Personel: ${personMatch}`);

  return {
    status: status ?? undefined,
    dateRange: dateRange ?? undefined,
    departmentId: deptMatch?._id,
    person: personMatch,
    description: bits.join(" · ") || "Filtre önerisi",
  };
}

interface PDKSInlineQueryProps {
  filters: FilterValues;
  onApplyFilters: (next: FilterValues) => void;
  onOpenChat: (seedInput?: string) => void;
}

export function PDKSInlineQuery({
  filters,
  onApplyFilters,
  onOpenChat,
}: PDKSInlineQueryProps) {
  const [input, setInput] = useState("");
  const departments = useQuery(api.departments.list);
  const suggestion = useMemo(
    () => computeSuggestion(input, departments),
    [input, departments],
  );

  const handleApply = () => {
    if (!suggestion) return;
    onApplyFilters({
      ...filters,
      dateRange: suggestion.dateRange ?? filters.dateRange,
      statusFilter: suggestion.status ?? filters.statusFilter,
      departmentId: suggestion.departmentId ?? filters.departmentId,
      person: suggestion.person ?? filters.person,
      reportType: suggestion.dateRange ? "custom" : filters.reportType,
    });
    setInput("");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary shrink-0" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (suggestion) handleApply();
              else onOpenChat(input);
            }
          }}
          placeholder="AI'a sor: Bugün kimler geç kaldı?"
          className="h-9 flex-1"
        />
        {suggestion ? (
          <Button onClick={handleApply} size="sm" className="gap-1.5">
            <Check className="h-4 w-4" />
            Filtreyi uygula
          </Button>
        ) : (
          <Button
            onClick={() => onOpenChat(input)}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Send className="h-4 w-4" />
            Sor
          </Button>
        )}
        <Button
          onClick={() => onOpenChat()}
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          title="Tüm sohbeti aç"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>

      {suggestion ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Önerilen filtre:</span>
          <Badge variant="secondary">{suggestion.description}</Badge>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUERIES.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px] rounded-full"
              onClick={() => setInput(q)}
            >
              {q}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
