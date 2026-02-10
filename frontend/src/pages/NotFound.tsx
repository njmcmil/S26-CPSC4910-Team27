import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="card text-center">
      <h2>Page Not Found</h2>
      <p className="mt-1">The page you're looking for doesn't exist.</p>
      <p className="mt-2">
        <Link to="/">Go to Home</Link>
      </p>
    </section>
  );
}
