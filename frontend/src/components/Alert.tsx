import type { ReactNode } from 'react';

interface AlertProps {
  variant: 'error' | 'success' | 'info';
  children: ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert" aria-live="polite">
      <span>{children}</span>
    </div>
  );
}
