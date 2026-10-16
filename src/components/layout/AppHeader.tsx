import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import { capabilities } from "@/lib/capabilities";
import { Link } from "react-router-dom";
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

type UserProfile = FunctionReturnType<typeof api.users.currentUser>;

function getUserDisplayName(profile: UserProfile) {
  return profile?.fullName || profile?.name || profile?.email?.split("@")[0] || "Kullanıcı";
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
  const typedProfile = profile;
  const typedUser = user;

  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 border-b bg-card/95 backdrop-blur-sm px-3 md:px-4",
        className
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      {title && (
        <h1 className="text-sm font-semibold truncate">{title}</h1>
      )}

      {children}

      {/* Sağ taraf: Kullanıcı */}
      <div className="ml-auto flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="Hesap menüsü" className="h-8 w-8 rounded-full p-0">
              <Avatar className="h-7 w-7">
                <AvatarImage src={typedProfile?.photoUrl || typedProfile?.image || ""} alt={getUserDisplayName(typedProfile)} />
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
            {capabilities(profile?.role).admin && <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">Ayarlar</Link>
            </DropdownMenuItem>}
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
