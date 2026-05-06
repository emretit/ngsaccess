import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Check,
  QrCode,
  ShieldCheck,
  Sparkles,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TRUST_ITEMS = [
  'Kredi kartı gerekmez',
  'KVKK uyumlu',
  'Türkçe destek',
];

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-linear-to-b from-background via-background to-muted/40 py-20 md:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 0%, rgba(113, 26, 26, 0.12), transparent 50%), radial-gradient(circle at 80% 100%, rgba(113, 26, 26, 0.08), transparent 50%)',
        }}
      />

      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <Badge
              variant="outline"
              className="mb-6 bg-primary/5 text-primary border-primary/20 px-3 py-1.5 text-xs font-medium"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Türkiye'nin modern PDKS platformu
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              Personel devam takibini{' '}
              <span className="text-primary">5 dakikada</span> kurun.
            </h1>

            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
              QR kod, kart okuyucu ve mobil uygulama tek bir bulut platformda.
              Vardiya, izin ve raporlama dahil — kurulum gerektirmez.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="text-base shadow-lg shadow-primary/20" asChild>
                <Link to="/demo-request">
                  14 Gün Ücretsiz Dene
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base" asChild>
                <a href="#features">Özellikleri İncele</a>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_ITEMS.map((item) => (
                <li
                  key={item}
                  className="flex items-center text-sm text-muted-foreground"
                >
                  <Check className="h-4 w-4 mr-2 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <HeroMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const HeroMockup = () => {
  return (
    <div className="relative">
      {/* Background dashboard card */}
      <div className="rounded-2xl border bg-card shadow-2xl p-6 relative">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Bugün</div>
            <div className="font-semibold text-lg">Devam Özeti</div>
          </div>
          <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
            Canlı
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Giriş', value: '142', icon: TrendingUp, color: 'text-emerald-600' },
            { label: 'Geç Kalan', value: '3', icon: Clock, color: 'text-amber-600' },
            { label: 'İzinli', value: '8', icon: ShieldCheck, color: 'text-primary' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-muted/30 p-3"
            >
              <stat.icon className={`h-4 w-4 mb-2 ${stat.color}`} />
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {[
            { name: 'Ahmet Yılmaz', dept: 'Üretim', time: '08:42', status: 'in' },
            { name: 'Elif Kaya', dept: 'Muhasebe', time: '08:55', status: 'in' },
            { name: 'Mehmet Can', dept: 'Lojistik', time: '17:30', status: 'out' },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {row.name.split(' ').map((s) => s[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{row.name}</div>
                <div className="text-xs text-muted-foreground">{row.dept}</div>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{row.time}</div>
              <Badge variant={row.status === 'in' ? 'success' : 'warning'} className="text-[10px]">
                {row.status === 'in' ? 'Giriş' : 'Çıkış'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Floating QR card */}
      <motion.div
        initial={{ opacity: 0, x: -30, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="absolute -left-8 -top-8 rounded-xl border bg-card shadow-xl p-4 w-44 hidden xl:block"
      >
        <div className="rounded-lg burgundy-gradient h-24 flex items-center justify-center mb-2">
          <QrCode className="h-12 w-12 text-white" />
        </div>
        <div className="text-xs font-semibold">Mobil QR Tarama</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">iOS · Android</div>
      </motion.div>

      {/* Floating notification toast */}
      <motion.div
        initial={{ opacity: 0, x: 30, y: 10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="absolute -right-6 -bottom-6 rounded-xl border bg-card shadow-xl p-3 w-60 flex items-center gap-3"
      >
        <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Check className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold">Yeni giriş kaydedildi</div>
          <div className="text-[11px] text-muted-foreground truncate">
            Ayşe Demir · 09:14 · A Kapısı
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HeroSection;
