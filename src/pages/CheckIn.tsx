import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, MapPin } from "lucide-react";

export default function CheckIn() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const checkIn = useMutation(api.employeeCheckIn.checkInWithToken);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [usedLocation, setUsedLocation] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Geçersiz check-in linki");
      return;
    }

    const doCheckIn = async () => {
      try {
        let lat: number | undefined;
        let lng: number | undefined;

        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                maximumAge: 60000,
              });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            setUsedLocation(true);
          } catch {
            // Konum alınamazsa devam et
          }
        }

        const result = await checkIn({
          token,
          ...(lat != null && lng != null && { latitude: lat, longitude: lng }),
        });

        if (result.success) {
          setStatus("success");
          setMessage(`${result.employeeName} — Giriş kaydedildi: ${result.accessTime}`);
        } else {
          setStatus("error");
          setMessage(result.error ?? "Check-in başarısız");
        }
      } catch {
        setStatus("error");
        setMessage("Bir hata oluştu");
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
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p className="text-muted-foreground">Giriş kaydediliyor...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <p className="text-center font-medium text-green-700">{message}</p>
              {usedLocation && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Konum doğrulaması yapıldı
                </p>
              )}
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <p className="text-center font-medium text-destructive">{message}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
