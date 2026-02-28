import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="layout card">
      <h1>Not Found</h1>
      <p className="meta">The page does not exist.</p>
      <Link to="/">
        <button>Back Home</button>
      </Link>
    </div>
  );
}
