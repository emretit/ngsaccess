export type SelectionInput<Id extends string> = {
  visibleIds: readonly Id[];
  selected: ReadonlySet<Id>;
  onChange: (next: Set<Id>) => void;
};

export function toggleListSelection<Id extends string>(selected: ReadonlySet<Id>, id: Id): Set<Id> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function selectAllListSelection<Id extends string>(visibleIds: readonly Id[], value: boolean): Set<Id> {
  return new Set(value ? visibleIds : []);
}

export function listSelectionChecked<Id extends string>(visibleIds: readonly Id[], selected: ReadonlySet<Id>): boolean | "indeterminate" {
  if (visibleIds.length === 0) return false;
  const count = visibleIds.filter(id => selected.has(id)).length;
  return count === visibleIds.length ? true : count > 0 ? "indeterminate" : false;
}

export function useListSelection<Id extends string>({ visibleIds, selected, onChange }: SelectionInput<Id>) {
  return {
    toggle: (id: Id) => onChange(toggleListSelection(selected, id)),
    selectAll: (value: boolean) => onChange(selectAllListSelection(visibleIds, value)),
    checked: listSelectionChecked(visibleIds, selected),
  };
}
