export type SelectionState = boolean | "indeterminate";

export function selectionState(
  ids: readonly string[],
  selectedIds: readonly string[],
): SelectionState {
  if (ids.length === 0) return false;
  const selected = new Set(selectedIds);
  const count = ids.filter((id) => selected.has(id)).length;
  return count === ids.length ? true : count > 0 ? "indeterminate" : false;
}

export const areAllSelected = (
  items: ReadonlyArray<{ _id: unknown }>,
  selectedIds: readonly string[],
) =>
  selectionState(
    items.map((item) => String(item._id)),
    selectedIds,
  ) === true;

export function toggleSelection(
  selected: readonly string[],
  ids: readonly string[],
  checked: boolean,
): string[] {
  const next = new Set(selected);
  for (const id of ids) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return [...next];
}

export function departmentScope(
  departments: ReadonlyArray<{ _id: string; parentId?: string | null }>,
  departmentId: string,
  includeChildren: boolean,
): Set<string> {
  const scope = new Set([departmentId]);
  if (!includeChildren) return scope;
  const queue = [departmentId];
  for (let index = 0; index < queue.length; index++) {
    for (const child of departments) {
      if (child.parentId === queue[index] && !scope.has(child._id)) {
        scope.add(child._id);
        queue.push(child._id);
      }
    }
  }
  return scope;
}

type ScopeDoor = { _id: string; deviceId?: string };
export type DoorSelection = {
  selected_devices: string[];
  selected_doors: string[];
};

// Eski kurallarda panel seçili, kapı bağı yoksa bütün kapılar yetkilidir.
export function effectiveDoorIds(
  doors: readonly ScopeDoor[],
  selection: DoorSelection,
): string[] {
  const explicit = new Set(selection.selected_doors);
  const devicesWithDoors = new Set(
    doors.filter((door) => explicit.has(door._id)).map((door) => door.deviceId),
  );
  return doors
    .filter(
      (door) =>
        explicit.has(door._id) ||
        (door.deviceId &&
          selection.selected_devices.includes(door.deviceId) &&
          !devicesWithDoors.has(door.deviceId)),
    )
    .map((door) => door._id);
}

export function toggleDoors(
  doors: readonly ScopeDoor[],
  selection: DoorSelection,
  ids: readonly string[],
  checked: boolean,
): DoorSelection {
  const affected = new Set(
    doors.filter((door) => ids.includes(door._id)).map((door) => door.deviceId),
  );
  // Materialize whole-panel fallback only for panels the user actually changed.
  // Explicit selections absent from the candidate tree must survive untouched.
  const affectedDoors = doors.filter(door => affected.has(door.deviceId));
  const affectedDoorIds = new Set(affectedDoors.map(door => door._id));
  const selectedDoors = toggleSelection(
    [
      ...selection.selected_doors.filter(id => !affectedDoorIds.has(id)),
      ...effectiveDoorIds(affectedDoors, selection),
    ],
    ids,
    checked,
  );
  const nextDevices = new Set(selection.selected_devices);
  for (const deviceId of affected) {
    if (!deviceId) continue;
    if (
      doors.some(
        (door) =>
          door.deviceId === deviceId && selectedDoors.includes(door._id),
      )
    )
      nextDevices.add(deviceId);
    else nextDevices.delete(deviceId);
  }
  return { selected_devices: [...nextDevices], selected_doors: selectedDoors };
}

export function scopeSelectionState(
  doorIds: readonly string[],
  deviceIdsWithoutDoors: readonly string[],
  effectiveDoors: readonly string[],
  selectedDevices: readonly string[],
): SelectionState {
  return selectionState(
    [
      ...doorIds.map((id) => `door:${id}`),
      ...deviceIdsWithoutDoors.map((id) => `device:${id}`),
    ],
    [
      ...effectiveDoors.map((id) => `door:${id}`),
      ...selectedDevices.map((id) => `device:${id}`),
    ],
  );
}
