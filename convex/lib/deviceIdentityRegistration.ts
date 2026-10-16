/** Kayıt sonucu atamadan önce saklanır; tekrar denemede yalnız atama çalışır. */
export async function completeDeviceRegistration<Id extends string>({
  registeredId,
  register,
  onRegistered,
  claim,
}: {
  registeredId: Id | null;
  register: () => Promise<Id>;
  onRegistered: (id: Id) => void;
  claim?: (id: Id) => Promise<unknown>;
}) {
  const id = registeredId ?? (await register());
  onRegistered(id);
  if (claim) await claim(id);
  return id;
}
