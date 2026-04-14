import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Accessible breadcrumb navigation.
 * Renders nothing when items is empty (e.g., on dashboard root pages).
 *
 * Usage:
 *   <Breadcrumbs items={[{ label: 'Dashboard', to: '/admin/dashboard' }, { label: 'Users' }]} />
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="breadcrumbs-item">
              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.to}>{item.label}</Link>
              )}
              {!isLast && (
                <span className="breadcrumbs-sep" aria-hidden="true">›</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
