import { optionalLocationWithin } from "../../convex/lib/checkInUx";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, MapPin } from "lucide-react";

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const checkIn = useMutation(api.employeeCheckIn.checkInWithToken);
  const running = useRef<string | null>(null);
  const [phase, setPhase] = useState("Konum bilgisi bekleniyor...");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [usedLocation, setUsedLocation] = useState(false);

  useEffect(() => {
    if (!token) {
      running.current = null;
      setStatus("error");
      setMessage("Geçersiz check-in linki");
      return;
    }

    if (running.current === token) return;
    running.current = token;
    setUsedLocation(false);
    setPhase("Konum bilgisi bekleniyor...");
    setLocationNotice("");
    setStatus("loading");

    const doCheckIn = async () => {
      try {
        let lat: number | undefined;
        let lng: number | undefined;

        if (navigator.geolocation) {
          const pos = await optionalLocationWithin(() => new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000, maximumAge: 60000 });
          }), 3000);
          if (pos) {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } else {
            setLocationNotice("Konum alınamadı; giriş kaydı konum eklenmeden oluşturuluyor.");
          }
        } else {
          setLocationNotice("Bu tarayıcı konum bilgisi sağlayamıyor; konum eklenmeden devam ediliyor.");
        }

        if (running.current !== token) return;
        setPhase("Giriş kaydediliyor...");
        const result = await checkIn({
          token,
          ...(lat != null && lng != null && { latitude: lat, longitude: lng }),
        });

        if (running.current !== token) return;
        if (result.success) {
          setUsedLocation(result.locationRecorded === true);
          setStatus("success");
          setMessage(`${result.employeeName} — Giriş kaydedildi: ${result.accessTime ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(result.accessTime)) : ""}`);
        } else {
          setStatus("error");
          setMessage(result.error ?? "Check-in başarısız");
        }
      } catch {
        if (running.current !== token) return;
        setStatus("error");
        setMessage("Giriş sonucu alınamadı. Yeni kod taramadan önce mobil uygulamadaki kaydı kontrol edin.");
      }
    };

    doCheckIn();
  }, [token, checkIn]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">QR Check-In</CardTitle>
        </CardHeader>
        <CardContent aria-live="polite" className="flex flex-col items-center gap-4">
          {locationNotice && <p className="text-center text-sm text-muted-foreground">{status === "success" ? "Konum bilgisi eklenemedi." : locationNotice}</p>}
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-muted-foreground">{phase}</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-16 w-16 text-primary" />
              <p className="text-center font-medium text-foreground">{message}</p>
              {usedLocation && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Konum bilgisi kayda eklendi
                </p>
              )}
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <p className="text-center font-medium text-destructive">{message}</p>
              <p className="text-center text-sm text-muted-foreground">Mobil uygulamada yeni bir QR kodu açıp tekrar tarayın.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
