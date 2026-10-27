interface NamedRow {
  _id: string;
  name: string;
}
interface DepartmentRow extends NamedRow {
  companyId?: string | null;
}

/**
 * Aynı departman adı birden çok şirkette (şubede) olabilir: etiketin önüne şirket adı eklenir
 * ("NGS / Yönetim"). `name` departman adını değiştirmek için (ör. üst departman yolu).
 */
export function departmentLabels<D extends DepartmentRow>(
  departments: readonly D[] | undefined,
  companies: readonly NamedRow[] | undefined,
  name: (department: D) => string = (department) => department.name,
): Map<string, string> {
  const companyNames = new Map((companies ?? []).map((company) => [company._id, company.name]));
  return new Map((departments ?? []).map((department) => {
    const companyName = department.companyId ? companyNames.get(department.companyId) : undefined;
    return [department._id, companyName ? `${companyName} / ${name(department)}` : name(department)];
  }));
}
