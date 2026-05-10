import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-md">
        The page you are looking for does not exist. It may have been moved, or the URL might be mistyped.
      </p>
      <Link to="/">
        <Button className="px-5 py-2.5">Back to Home</Button>
      </Link>
    </div>
  );
}
