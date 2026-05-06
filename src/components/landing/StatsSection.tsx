import { motion } from 'framer-motion';

const STATS = [
  { value: '200+', label: 'Aktif Şirket' },
  { value: '50.000+', label: 'Takip Edilen Personel' },
  { value: '99.9%', label: 'Uptime Garantisi' },
  { value: '24/7', label: 'Türkçe Destek' },
];

const StatsSection = () => {
  return (
    <section className="relative burgundy-gradient text-white py-14 md:py-16 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 50%, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="relative w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold tabular-nums tracking-tight">
                {stat.value}
              </div>
              <div className="mt-2 text-sm md:text-base text-white/80">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
