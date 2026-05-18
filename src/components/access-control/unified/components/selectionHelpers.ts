export const areAllSelected = (
  items: ReadonlyArray<{ _id: unknown }>,
  selectedIds: ReadonlyArray<string>,
): boolean => {
  if (items.length === 0) return false;
  const selected = new Set(selectedIds);
  return items.every((item) => selected.has(String(item._id)));
};
