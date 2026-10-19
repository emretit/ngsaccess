import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, CircleX, Info, LoaderCircle } from 'lucide-react';
import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { usePublicTheme } from '@/hooks/usePublicTheme';

type PublicAction = { label: string; disabled?: boolean } & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);
type StatusScreenProps = {
  title: string;
  description?: string;
  tone: 'loading' | 'success' | 'error' | 'info';
  children?: ReactNode;
  iconSize?: 'default' | 'large';
  primaryAction?: PublicAction;
  secondaryAction?: PublicAction;
};

function Action({ action, secondary = false }: { action: PublicAction; secondary?: boolean }) {
  const className = 'min-h-12 w-full shadow-none text-[15px] font-semibold border-control';
  const variant = secondary ? 'outline' : 'default';
  if (action.href && !action.disabled) {
    return (
      <Button asChild variant={variant} className={className}>
        {action.href.startsWith('/') ? (
          <Link to={action.href}>{action.label}</Link>
        ) : (
          <a href={action.href}>{action.label}</a>
        )}
      </Button>
    );
  }
  return (
    <Button variant={variant} className={className} disabled={action.disabled} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export function StatusScreen({
  title,
  description,
  tone,
  children,
  primaryAction,
  secondaryAction,
  iconSize = 'default',
}: StatusScreenProps) {
  usePublicTheme();
  const Icon = { loading: LoaderCircle, success: CircleCheck, error: CircleX, info: Info }[tone];
  const iconClass =
    tone === 'success' ? 'text-success' : tone === 'error' ? 'text-danger' : 'text-muted-foreground';
  return (
    <>
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:bg-surface focus:p-3"
      >
        İçeriğe geç
      </a>
      <main
        id="main"
        tabIndex={-1}
        className="outline-none flex min-h-screen items-start justify-center bg-canvas px-[var(--public-gutter)] py-8 text-text [color-scheme:light] sm:items-center sm:py-12"
      >
        <section
          aria-labelledby="status-title"
          className="w-full max-w-[var(--public-status-max)] rounded-lg border border-line bg-surface p-6 sm:p-8 [&_input]:min-h-12 [&_input]:border-control [&_input]:text-base [&_button]:shadow-none [&_button]:font-semibold [&_button[type=submit]]:min-h-12 [&_label]:text-sm"
        >
          <Link
            to="/"
            aria-label="NGS Plus ana sayfa"
            className="mb-8 inline-flex min-h-11 items-center sm:mb-10"
          >
            <Logo
              variant="compact"
              tone="dark"
              size="md"
              className="[&_img]:h-[30px] [&_img]:w-[30px] [&_span]:text-[19px]"
            />
          </Link>
          <Icon
            aria-hidden={tone === 'loading' && !description ? undefined : true}
            role={tone === 'loading' && !description ? 'status' : undefined}
            aria-label={tone === 'loading' && !description ? title : undefined}
            className={`mb-[18px] ${iconSize === 'large' ? 'h-12 w-12' : 'h-7 w-7'} ${iconClass}`}
          />
          <h1 id="status-title" className="mb-4 text-[26px] font-semibold leading-[1.18] tracking-[-.025em]">
            {title}
          </h1>
          {description && (
            <p
              role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined}
              aria-live={tone === 'success' ? 'polite' : undefined}
              aria-busy={tone === 'loading' || undefined}
              className="mb-6 text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          )}
          {children}
          {(primaryAction || secondaryAction) && (
            <div className="mt-6 flex flex-col gap-3">
              {primaryAction && <Action action={primaryAction} />}
              {secondaryAction && <Action action={secondaryAction} secondary />}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
