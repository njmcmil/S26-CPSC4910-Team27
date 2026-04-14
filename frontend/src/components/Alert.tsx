import type { ReactNode } from 'react';

export type AlertVariant = 'error' | 'success' | 'info' | 'warning';

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert" aria-live="polite">
      <span>{children}</span>
    </div>
  );
}
