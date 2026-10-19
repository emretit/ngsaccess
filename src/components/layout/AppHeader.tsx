import { useState } from "react";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { CommandPalette } from "./CommandPalette";
import { capabilities } from "@/lib/capabilities";
import { roleLabel } from "@/lib/roleLabels";
import { Link } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface AppHeaderProps { title?: string; className?: string; children?: React.ReactNode }
export function AppHeader({ title, className, children }: AppHeaderProps) {
  const { user, profile, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = profile?.fullName || profile?.name || "Kullanıcı";
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toLocaleUpperCase("tr-TR");
  const logout = async () => {
    setPending(true); setError(null);
    try { await signOut(); }
    catch { setError("Çıkış yapılamadı. Lütfen tekrar deneyin."); }
    finally { setPending(false); }
  };
  return <header className={cn("flex h-16 shrink-0 items-center gap-3 border-b bg-surface px-4 min-[761px]:gap-4 min-[761px]:px-8", className)}>
    <SidebarTrigger className="h-11 w-11 shrink-0 min-[761px]:hidden" />
    <div className="min-w-0 flex-1 min-[761px]:max-w-[240px]"><ProjectSwitcher /></div>
    {title && title !== "Ana Sayfa" && <nav aria-label="İçerik yolu" className="hidden min-w-0 items-center gap-2 border-l pl-4 text-sm min-[761px]:flex">
      {title !== "Ana Sayfa" && <><Link to="/home" className="shrink-0 text-muted-foreground hover:underline">Ana Sayfa</Link><span aria-hidden="true" className="text-muted-foreground">/</span></>}
      <span aria-current="page" className="truncate">{title}</span>
    </nav>}
    {children}
    <div className="ml-auto flex shrink-0 items-center gap-2"><CommandPalette />
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label="Hesap menüsü" className="h-11 w-11 rounded-full p-0">
        <Avatar className="h-7 w-7"><AvatarImage src={profile?.photoUrl || profile?.image || ""} alt="" /><AvatarFallback className="border bg-subtle text-[11px] font-medium text-muted-foreground">{initials}</AvatarFallback></Avatar>
      </Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-2"><p className="font-medium">{name}</p><p className="break-words text-xs text-muted-foreground">{user?.email}</p>{profile?.role && <p className="mt-1 text-xs text-muted-foreground">{roleLabel(profile.role)}</p>}</div>
        <DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/profile">Profil</Link></DropdownMenuItem>
        {capabilities(profile?.role).admin && <DropdownMenuItem asChild><Link to="/settings">Ayarlar</Link></DropdownMenuItem>}
        <DropdownMenuSeparator />
        {error && <p role="alert" className="px-2 py-2 text-xs text-destructive">{error}</p>}
        <DropdownMenuItem disabled={pending} onSelect={event => { event.preventDefault(); void logout(); }} className="text-destructive focus:text-destructive">{pending ? "Çıkış yapılıyor…" : "Çıkış yap"}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
  </header>;
}
