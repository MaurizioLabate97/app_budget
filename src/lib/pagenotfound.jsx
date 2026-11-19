import { Link, useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-6xl font-light text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">Pagina non trovata</h2>
        <p className="text-muted-foreground">La pagina “{location.pathname}” non esiste.</p>
        <Link className="text-primary underline" to="/">Torna alla Home</Link>
      </div>
    </div>
  );
}
