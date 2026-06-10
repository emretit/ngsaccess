import { motion } from 'framer-motion';
import { Check, QrCode, UserCheck, Bell, Apple, Play } from 'lucide-react';

const HIGHLIGHTS = [
  'Sahada anında QR kod tarayıp giriş çıkış kaydı oluşturun',
  'Ziyaretçileri karşılayın, geçici erişim üretin',
  'Push bildirimlerle giriş ihlallerinden anında haberdar olun',
  'Çevrimdışı çalışır, internet gelince otomatik senkron',
];

const MobileAppSection = () => {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              MOBİL UYGULAMA
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Sahada da yanınızda — iOS ve Android için ücretsiz
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              Yöneticiler ve güvenlik personeli için sahada hızlı işlem. Personel
              uygulamasından çalışan QR kodunu tarayabilir, ziyaretçi
              karşılayabilir ve gerçek zamanlı bildirimler alabilir.
            </p>

            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-1 mt-0.5 shrink-0">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <div
                aria-label="App Store — Yakında"
                className="relative flex items-center gap-3 bg-black/40 text-white/60 rounded-xl px-5 py-3 cursor-not-allowed select-none"
              >
                <Apple className="h-7 w-7" />
                <div className="text-left leading-tight">
                  <div className="text-[10px] opacity-80">İndir</div>
                  <div className="text-base font-semibold">App Store</div>
                </div>
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Yakında
                </span>
              </div>
              <div
                aria-label="Google Play — Yakında"
                className="relative flex items-center gap-3 bg-black/40 text-white/60 rounded-xl px-5 py-3 cursor-not-allowed select-none"
              >
                <Play className="h-6 w-6" fill="currentColor" />
                <div className="text-left leading-tight">
                  <div className="text-[10px] opacity-80">İndir</div>
                  <div className="text-base font-semibold">Google Play</div>
                </div>
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Yakında
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="relative flex justify-center"
          >
            <div className="relative">
              <PhoneFrame primary>
                <div className="h-full burgundy-gradient flex flex-col">
                  <div className="px-6 pt-12 pb-6 text-white">
                    <div className="text-xs opacity-80 mb-1">Hoş geldin,</div>
                    <div className="text-xl font-bold">Ahmet Yılmaz</div>
                  </div>
                  <div className="bg-white rounded-t-3xl flex-1 p-5 mt-2">
                    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 aspect-square flex flex-col items-center justify-center">
                      <QrCode className="h-16 w-16 text-primary mb-3" />
                      <div className="text-sm font-semibold text-primary">
                        QR Tara
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Çalışan veya ziyaretçi
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-lg bg-muted/50 p-3 flex flex-col items-center">
                        <UserCheck className="h-5 w-5 text-primary mb-1" />
                        <span className="text-[11px] font-medium">Ziyaretçi</span>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 flex flex-col items-center">
                        <Bell className="h-5 w-5 text-primary mb-1" />
                        <span className="text-[11px] font-medium">Bildirim</span>
                      </div>
                    </div>
                  </div>
                </div>
              </PhoneFrame>

              {/* Secondary phone behind */}
              <div className="absolute -left-12 top-8 -z-10 hidden sm:block">
                <PhoneFrame>
                  <div className="h-full bg-white p-4">
                    <div className="text-xs font-semibold mb-3">Bugün</div>
                    {[
                      { name: 'Elif Kaya', time: '08:55', tag: 'Giriş' },
                      { name: 'Mehmet Can', time: '09:02', tag: 'Giriş' },
                      { name: 'Ayşe Demir', time: '09:14', tag: 'Giriş' },
                      { name: 'Burak Şen', time: '12:30', tag: 'Çıkış' },
                    ].map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0"
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium truncate">
                            {row.name}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            {row.time}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                            row.tag === 'Giriş'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {row.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </PhoneFrame>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

interface PhoneFrameProps {
  children: React.ReactNode;
  primary?: boolean;
}

const PhoneFrame = ({ children, primary }: PhoneFrameProps) => {
  return (
    <div
      className={`w-[260px] h-[540px] rounded-[2.5rem] p-2 bg-gray-900 ${
        primary ? 'shadow-2xl shadow-primary/20' : 'shadow-xl opacity-80'
      }`}
    >
      <div className="w-full h-full rounded-[2rem] overflow-hidden bg-white relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-b-2xl z-10" />
        {children}
      </div>
    </div>
  );
};

export default MobileAppSection;
