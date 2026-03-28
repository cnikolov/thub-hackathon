import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function ProtectedRoute() {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="h-svh w-full flex items-center justify-center bg-surface font-mono text-sm text-muted tracking-wide">
        LOADING_SYSTEM…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
