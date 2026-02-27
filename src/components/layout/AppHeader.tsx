import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface AppHeaderProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

type UserProfile = { email?: string; photo_url?: string } | null;

function getUserDisplayName(profile: UserProfile) {
  return profile?.email?.split("@")[0] || "Kullanıcı";
}

function getUserInitials(profile: UserProfile, user: UserProfile) {
  return (
    profile?.email?.substring(0, 2).toUpperCase() ||
    user?.email?.substring(0, 2).toUpperCase() ||
    "KU"
  );
}

export function AppHeader({ title, className, children }: AppHeaderProps) {
  const { user, profile, signOut } = useAuth();
  const typedProfile = profile as UserProfile;
  const typedUser = user as UserProfile;

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 md:h-16",
        className
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      {title && (
        <h1 className="text-sm font-semibold truncate">{title}</h1>
      )}

      {children}

      {/* Sağ taraf: Bildirimler + Kullanıcı */}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
          <span className="sr-only">Bildirimler</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 rounded-full p-0">
              <Avatar className="h-7 w-7">
                <AvatarImage src={typedProfile?.photo_url || ""} alt={getUserDisplayName(typedProfile)} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {getUserInitials(typedProfile, typedUser)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-2">
              <p className="text-sm font-medium">{getUserDisplayName(typedProfile)}</p>
              <p className="text-xs text-muted-foreground truncate">{typedUser?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="cursor-pointer">Profil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">Ayarlar</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
