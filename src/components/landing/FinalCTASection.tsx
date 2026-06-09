import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FinalCTASection = () => {
  return (
    <section className="py-20 md:py-28 burgundy-gradient text-white relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div
        aria-hidden
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative w-full px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Kurmak 5 dakika.
            <br />
            <span className="text-yellow-300">Faydası ömür boyu.</span>
          </h2>
          <p className="mt-6 text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
            14 gün boyunca tüm özellikleri ücretsiz deneyin. Kredi kartı bilgisi
            gerekmez, istediğiniz zaman iptal edebilirsiniz.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-card text-primary hover:bg-card/90 shadow-xl text-base font-semibold"
              asChild
            >
              <Link to="/register">
                14 Gün Ücretsiz Dene
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white text-base"
              asChild
            >
              <a href="mailto:info@ngsplus.app">
                <MessageCircle className="mr-2 h-4 w-4" />
                Satışla Konuş
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTASection;
