import type { ReactNode } from "react";
import { PageHeader } from "./PageHeader";
import { MasterDetailListLayout } from "./MasterDetailListLayout";
import { cn } from "@/lib/utils";

export interface PageTemplateProps {
  title: string;
  scope?: ReactNode;
  backLink?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  notice?: ReactNode;
  navigation?: ReactNode;
  summary?: ReactNode;
  /** Keep the existing navigation transition when a module uses a compact sidebar. */
  aside?: { label: string; content: ReactNode; breakpoint?: 761 | 1100 };
  filters?: ReactNode;
  footer?: ReactNode;
  overlays?: ReactNode;
  width?: "wide" | "form";
  children: ReactNode;
}

/** Page composition only: the shell owns main/gutters; modules own state and permissions. */
export function PageTemplate({
  title, scope, backLink, primaryAction, secondaryActions, notice, navigation,
  summary, aside, filters, footer, overlays, width = "wide", children,
}: PageTemplateProps) {
  return (
    <div className="min-w-0 space-y-6">
      {backLink}
      <PageHeader title={title} scope={scope} primaryAction={primaryAction} secondaryActions={secondaryActions} />
      {notice}
      {navigation}
      {summary}
      <MasterDetailListLayout
        className={cn("gap-6 min-[1100px]:gap-6", aside?.breakpoint === 761 && "min-[761px]:flex-row")}
        sidebar={aside && <div role="group" aria-label={aside.label} className="min-w-0 shrink-0">{aside.content}</div>}
      >
        <div className={cn("min-w-0 space-y-6", width === "form" && "max-w-[800px]")}>
          {filters}
          {children}
          {footer}
        </div>
      </MasterDetailListLayout>
      {overlays}
    </div>
  );
}
