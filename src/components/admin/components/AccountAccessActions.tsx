import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { userName, type User } from "../types/user-types";

const dateFormat = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" });

export function AccountAccessBadges({ user }: { user: User }) {
  const disabledAt = "disabledAt" in user ? user.disabledAt : undefined;
  const expiry = "accessExpiresAt" in user ? user.accessExpiresAt : undefined;
  return <div className="flex flex-wrap gap-1">
    {disabledAt !== undefined && <StatusBadge tone="neutral">Donduruldu</StatusBadge>}
    {expiry !== undefined && <StatusBadge tone="neutral">{"accessExpired" in user && user.accessExpired ? "Erişim bitti" : `Bitiş: ${dateFormat.format(expiry)}`}</StatusBadge>}
  </div>;
}

/** Dialog lives outside the menu's unmounting subtree. */
export function AccountAccessDialog({ user, mode, onClose }: {
  user: User; mode: "freeze" | "expiry"; onClose: () => void;
}) {
  const freeze = useMutation(api.accountAccess.freezeUser);
  const unfreeze = useMutation(api.accountAccess.unfreezeUser);
  const setExpiry = useMutation(api.accountAccess.setAccessExpiry);
  const disabled = "disabledAt" in user && user.disabledAt !== undefined;
  const expiry = "accessExpiresAt" in user ? user.accessExpiresAt : undefined;
  const [value, setValue] = useState(() => expiry === undefined ? "" : new Date(expiry + 3 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const { run, pending } = useAsyncAction(async (clear = false) => {
    if (mode === "freeze") await (disabled ? unfreeze : freeze)({ userId: user._id });
    else {
      const accessExpiresAt = clear ? null : new Date(`${value}:00+03:00`).getTime();
      if (accessExpiresAt !== null && !Number.isFinite(accessExpiresAt)) throw new Error("Tarih ve saat seçin");
      await setExpiry({ userId: user._id, accessExpiresAt });
    }
  }, { success: "Kullanıcı erişimi güncellendi", error: "İşlem tamamlanamadı" });
  const save = async (clear = false) => {
    if (await run(clear)) onClose();
  };
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{mode === "expiry" ? "Erişim bitişi" : disabled ? "Kullanıcı çözülsün mü?" : "Kullanıcı dondurulsun mu?"}</DialogTitle>
        <DialogDescription>{userName(user)} · {mode === "expiry" ? "Tarih ve saat İstanbul saatine göredir." : disabled ? "Kullanıcı yeniden giriş yapabilir." : "Kullanıcının tüm oturumları kapanacak"}</DialogDescription>
      </DialogHeader>
      {mode === "expiry" && <div className="space-y-2"><Label htmlFor="access-expiry">Tarih ve saat (İstanbul)</Label><div className="flex min-w-0 gap-2"><DateInput id="access-expiry" className="min-w-0 flex-1" required value={value.slice(0, 10)} disabled={pending} onChange={day => setValue(day ? `${day}T${value.slice(11, 16) || "00:00"}` : "")} /><Input type="time" className="w-28 shrink-0" aria-label="Erişim bitiş saati" value={value.slice(11, 16)} disabled={pending || !value} onChange={event => setValue(`${value.slice(0, 10)}T${event.target.value || "00:00"}`)} /></div></div>}
      <DialogFooter>
        <Button variant="outline" disabled={pending} onClick={onClose}>Vazgeç</Button>
        {mode === "expiry" && <Button variant="outline" disabled={pending || expiry === undefined} onClick={() => void save(true)}>Kaldır</Button>}
        <Button disabled={pending || (mode === "expiry" && !value)} onClick={() => void save()}>{pending ? "Kaydediliyor…" : mode === "expiry" ? "Kaydet" : disabled ? "Çöz" : "Dondur"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function AccountAccessActions({ user, onSelectMode }: { user: User; onSelectMode: (mode: "freeze" | "expiry") => void }) {
  const { profile } = useAuth();
  const disabled = "disabledAt" in user && user.disabledAt !== undefined;
  const self = profile?._id === user._id;
  return <>
    <DropdownMenuItem disabled={self} onSelect={() => onSelectMode("freeze")}>{disabled ? "Çöz" : "Dondur"}</DropdownMenuItem>
    <DropdownMenuItem disabled={self} onSelect={() => onSelectMode("expiry")}>Erişim bitişi</DropdownMenuItem>
  </>;
}
