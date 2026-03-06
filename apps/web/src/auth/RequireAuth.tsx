import type { ReactNode } from 'react';

import { Navigate } from 'react-router-dom';

import { useAuthSession } from './auth-session';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const session = useAuthSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
