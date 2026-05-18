import { Clock } from "lucide-react";

const TemporaryAccess = () => {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">
                Geçici Erişim
              </h2>
              <p className="text-xs text-muted-foreground">
                Geçici erişim izinlerini düzenle
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs p-8 text-center text-sm text-muted-foreground">
        Geçici erişim yönetimi henüz yapım aşamasında.
      </div>
    </div>
  );
};

export default TemporaryAccess;
