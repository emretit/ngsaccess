
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { roleLabel } from "@/lib/roleLabels";
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileFormProps {
  email: string;
  fullName: string;
  role: string;
  userId: string;
  onProfileUpdated: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export default function ProfileForm({ email, fullName, role, userId: _userId, onProfileUpdated, onSignOut }: ProfileFormProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? fullName;
  const [nameError, setNameError] = useState("");
  const navigate = useNavigate();
  const updateProfile = useMutation(api.users.updateProfile);

  const { run, pending: isUpdating } = useAsyncAction(async () => {
    await updateProfile({ fullName: name.trim() });
    setDraft(null);
    await onProfileUpdated();
  }, { success: "Profil güncellendi", error: "Profil güncellenemedi" });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError("Ad soyad boş bırakılamaz."); return; }
    setNameError("");
    await run();
  };

  const handleSignOut = async () => {
    await onSignOut();
    navigate('/login');
  };

  return (
    <Card className="md:col-span-2">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Hesap Bilgileri</CardTitle>
          <CardDescription>
            Kişisel bilgilerinizi buradan güncelleyebilirsiniz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              name="email"
              value={email}
              disabled
            />
            <p className="text-xs text-muted-foreground">
              E-posta adresi değiştirilemez
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              name="fullName"
              value={name}
              onChange={(e) => setDraft(e.target.value)}
              aria-invalid={!!nameError}
              aria-describedby="profile-name-error"
              placeholder="Ad Soyad"
              disabled={isUpdating}
            />
          </div>

          {nameError && <p id="profile-name-error" role="alert" className="text-sm text-destructive">{nameError}</p>}
          <Separator className="my-4" />

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Input
              id="role"
              value={roleLabel(role)}
              disabled
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between flex-col sm:flex-row gap-4">
          <Button
            variant="destructive"
            type="button"
            onClick={handleSignOut}
          >
            Çıkış Yap
          </Button>
          <Button
            type="submit"
            disabled={isUpdating}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Güncelleniyor
              </>
            ) : 'Bilgileri Güncelle'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
