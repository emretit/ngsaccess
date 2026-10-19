import { optionalLocationWithin } from '../../convex/lib/checkInUx';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '@/lib/convexApi';
import { StatusScreen } from '@/components/public/StatusScreen';
import { usePageTitle } from '@/hooks/usePageTitle';

type CheckInResult = {
  success: boolean;
  error?: string;
  code?: string;
  locationRecorded?: boolean;
  employeeName?: string;
  accessTime?: string | number;
};

export function checkInPresentation(result: CheckInResult) {
  if (result.success) {
    return {
      status: 'success' as const,
      usedLocation: result.locationRecorded,
      record: { name: result.employeeName ?? '', accessTime: result.accessTime },
    };
  }
  const tokenErrors = ['Geçersiz veya süresi dolmuş kod', 'Kodun süresi doldu'];
  return {
    status: 'error' as const,
    failure: (result.code !== undefined
      ? result.code === 'invalid_token' || result.code === 'expired_token'
      : tokenErrors.includes(result.error ?? '')) ? ('invalid' as const) : ('rejected' as const),
  };
}

export default function CheckIn() {
  usePageTitle('QR ile giriş');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const checkIn = useMutation(api.employeeCheckIn.checkInWithToken);
  const running = useRef<string | null>(null);
  const [phase, setPhase] = useState('Konum bilgisi bekleniyor…');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [failure, setFailure] = useState<'invalid' | 'rejected' | 'unknown'>('invalid');
  const [record, setRecord] = useState<{ name: string; accessTime?: string | number } | null>(null);
  const [locationNotice, setLocationNotice] = useState('');
  const [usedLocation, setUsedLocation] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!token) {
      running.current = null;
      setStatus('error');
      setFailure('invalid');
      return;
    }

    if (running.current === token) return;
    running.current = token;
    setUsedLocation(undefined);
    setPhase('Konum bilgisi bekleniyor…');
    setLocationNotice('');
    setStatus('loading');

    const doCheckIn = async () => {
      try {
        let lat: number | undefined;
        let lng: number | undefined;

        if (navigator.geolocation) {
          const pos = await optionalLocationWithin(
            () =>
              new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  timeout: 3000,
                  maximumAge: 60000,
                });
              }),
            3000,
          );
          if (pos) {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } else {
            setLocationNotice('Konum alınamadı; giriş kaydı konum eklenmeden oluşturuluyor.');
          }
        } else {
          setLocationNotice('Bu tarayıcı konum bilgisi sağlayamıyor; konum eklenmeden devam ediliyor.');
        }

        if (running.current !== token) return;
        setPhase('Giriş kaydediliyor…');
        const result = await checkIn({
          token,
          ...(lat != null && lng != null && { latitude: lat, longitude: lng }),
        });

        if (running.current !== token) return;
        const presentation = checkInPresentation(result);
        if (presentation.status === 'success') {
          setUsedLocation(presentation.usedLocation);
          setStatus('success');
          setRecord(presentation.record);
        } else {
          setStatus('error');
          setFailure(presentation.failure);
        }
      } catch {
        if (running.current !== token) return;
        setStatus('error');
        setFailure('unknown');
      }
    };

    doCheckIn();
  }, [token, checkIn]);

  if (status === 'loading')
    return (
      <StatusScreen iconSize="large" tone="loading" title="Girişiniz kaydediliyor." description={phase}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Konum alınamazsa kayıt, konum eklenmeden oluşturulur.
        </p>
        {locationNotice && (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {locationNotice}
          </p>
        )}
      </StatusScreen>
    );
  if (status === 'success') {
    const time = record?.accessTime ? new Date(record.accessTime) : null;
    const validTime = time && !Number.isNaN(time.getTime());
    return (
      <StatusScreen
        iconSize="large"
        tone="success"
        title="Girişiniz kaydedildi."
        description="Bu sayfayı kapatabilirsiniz."
      >
        <dl className="mb-6 space-y-3 border-y border-line py-4 text-sm [&>div]:flex [&>div]:justify-between [&>div]:gap-4 [&_dt]:text-muted-foreground [&_dd]:text-right">
          {record?.name && (
            <div>
              <dt>Personel</dt>
              <dd className="font-semibold">{record.name}</dd>
            </div>
          )}
          {validTime && (
            <>
              <div>
                <dt>Tarih</dt>
                <dd>
                  {new Intl.DateTimeFormat('tr-TR', {
                    dateStyle: 'medium',
                    timeZone: 'Europe/Istanbul',
                  }).format(time)}
                </dd>
              </div>
              <div>
                <dt>Saat</dt>
                <dd>
                  {new Intl.DateTimeFormat('tr-TR', {
                    timeStyle: 'short',
                    timeZone: 'Europe/Istanbul',
                  }).format(time)}{' '}
                  · İstanbul
                </dd>
              </div>
            </>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">
          {usedLocation === undefined
            ? 'Bu kayıt için konum bilgisi bilinmiyor.'
            : usedLocation ? 'Konum bilgisi kayda eklendi.' : 'Konum bilgisi eklenemedi.'}
        </p>
      </StatusScreen>
    );
  }
  return (
    <StatusScreen
      iconSize="large"
      tone="error"
      title={
        failure === 'unknown'
          ? 'Giriş sonucu alınamadı.'
          : failure === 'invalid'
            ? 'Giriş bağlantısı geçersiz.'
            : 'Girişiniz kaydedilemedi.'
      }
      description={
        failure === 'unknown'
          ? 'Yeni kod taramadan önce yöneticinizden giriş kaydınızı kontrol etmesini isteyin.'
          : failure === 'invalid'
            ? 'İşyerinizdeki güncel QR giriş bağlantısını kullanın. Yardım için yöneticinize başvurun.'
            : 'Giriş bağlantısını yöneticinizle kontrol edin.'
      }
      secondaryAction={{ label: 'Destek: info@ngsplus.app', href: 'mailto:info@ngsplus.app' }}
    >
      {failure === 'invalid' && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          İşyerinizde yeni QR kodu açıp tekrar tarayın.
        </p>
      )}
    </StatusScreen>
  );
}
