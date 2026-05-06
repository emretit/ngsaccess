import { motion } from 'framer-motion';
import { UploadCloud, Cable, Activity, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    number: '01',
    icon: UploadCloud,
    title: 'Kur',
    description:
      'Çalışanlarınızı Excel ile içe aktarın veya tek tek ekleyin. Departmanlar, vardiyalar ve roller dakikalar içinde hazır.',
  },
  {
    number: '02',
    icon: Cable,
    title: 'Bağla',
    description:
      'Mevcut kart okuyucularınızı veya QR kodunu cihazlara eşleştirin. Hikvision uyumlu — yeni donanım almanız gerekmez.',
  },
  {
    number: '03',
    icon: Activity,
    title: 'Takip Et',
    description:
      'Real-time dashboard\'dan giriş çıkışları izleyin. Bordro için Excel/PDF raporları tek tıkla hazır.',
  },
];

const HowItWorksSection = () => {
  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 bg-muted/30 relative overflow-hidden"
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Kurulum 3 adımda biter
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            IT ekibinize gerek yok. Tek başınıza kurabilir, ilk gün veri toplamaya başlayabilirsiniz.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line - desktop only */}
          <div
            aria-hidden
            className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-linear-to-r from-transparent via-primary/30 to-transparent"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
            {STEPS.map((step, idx) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="relative"
              >
                <div className="rounded-2xl border bg-card p-8 h-full shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative inline-flex">
                    <div className="rounded-2xl burgundy-gradient w-14 h-14 flex items-center justify-center shadow-lg shadow-primary/20">
                      <step.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-3 bg-card border border-primary/20 rounded-full px-2 py-0.5 text-xs font-bold text-primary shadow-sm">
                      {step.number}
                    </div>
                  </div>

                  <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow between cards - desktop only */}
                {idx < STEPS.length - 1 && (
                  <div
                    aria-hidden
                    className="hidden md:flex absolute top-12 -right-3 w-6 h-6 items-center justify-center"
                  >
                    <div className="bg-card rounded-full p-1 border border-primary/20 shadow-sm">
                      <ArrowRight className="h-3 w-3 text-primary" />
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
