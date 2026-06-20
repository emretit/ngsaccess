/**
 * Saf erişim karar motoru — DB bağımsız.
 *
 * Kart akışında (cardReadings.processCardReading) ve mobil token akışında AYNI mantık
 * uygulanır: cihazın bağlı olduğu kurallar ∩ çalışanın üye olduğu kurallar; bu kesişimde
 * en az BİR kural AKTİF (isActive) ise erişim verilir.
 *
 * DB gezme (groupDevices / groupMembers / accessRules okumaları) çağıranda kalır; bu modül
 * yalnız çözülmüş id kümeleri üzerinde kararı verir → hızlı, flaky olmayan birim testler.
 *
 * Generic `<T extends string>`: çağıran `Id<"accessRules">` geçer, testler düz string geçer;
 * iki tarafta da cast gerekmez.
 */
export function canEmployeeAccessDevice<T extends string>(params: {
  /** groupDevices.groupId — cihazın bağlı olduğu kurallar */
  deviceGroupIds: ReadonlyArray<T>;
  /** groupMembers.groupId — çalışanın üye olduğu kurallar */
  employeeGroupIds: ReadonlyArray<T>;
  /** isActive === true olan kural id'leri */
  activeRuleIds: ReadonlySet<T>;
}): boolean {
  const employeeSet = new Set<T>(params.employeeGroupIds);
  return params.deviceGroupIds.some(
    (gid) => employeeSet.has(gid) && params.activeRuleIds.has(gid),
  );
}
