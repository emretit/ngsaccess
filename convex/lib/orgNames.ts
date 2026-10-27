import { ConvexError } from "convex/values";
import { normalizeEmployeeImportName } from "./employeeImportValidation";

const MAX_NAME_LENGTH = 120;

/** Şirket/pozisyon adını kırpar; boş veya çok uzunsa hata verir. */
export function orgName(value: string, label: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new ConvexError(`${label} adı zorunludur`);
  if (name.length > MAX_NAME_LENGTH) throw new ConvexError(`${label} adı en fazla ${MAX_NAME_LENGTH} karakter olabilir`);
  return name;
}

/** Aynı projede aynı adla ikinci kayıt açılmaz; Excel içe aktarma adla eşleştirir. */
export function assertUniqueOrgName<T extends { _id: string; name: string }>(
  items: ReadonlyArray<T>, name: string, label: string, exceptId?: string,
): void {
  const key = normalizeEmployeeImportName(name);
  if (items.some(item => item._id !== exceptId && normalizeEmployeeImportName(item.name) === key)) {
    throw new ConvexError(`Bu projede "${name}" adlı ${label.toLocaleLowerCase("tr-TR")} zaten var`);
  }
}
