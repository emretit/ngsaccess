import { ACCOUNT_CTA, SETUP_DESCRIPTION } from './publicCopy';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FinalCTASection = () => {
  const reducedMotion = useReducedMotion();
  return (
    <section className="py-20 md:py-28 burgundy-gradient text-primary-foreground relative overflow-hidden">
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
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Kuruluma başlayın.
            <br />
            <span className="text-primary-foreground">Projenizi hazırlayın.</span>
          </h2>
          <p className="mt-6 text-lg md:text-xl text-primary-foreground max-w-2xl mx-auto">
            {SETUP_DESCRIPTION}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="bg-card text-primary hover:bg-card/90 shadow-xl text-base font-semibold"
              asChild
            >
              <Link to="/register">
                {ACCOUNT_CTA}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground text-base"
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
