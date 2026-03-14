import { type ReactNode, useEffect, useState } from 'react';

import { Navigate } from 'react-router-dom';

import { refreshStoredSession } from './auth-service';
import { isAccessTokenExpired, useAuthSession } from './auth-session';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const session = useAuthSession();
  const accessTokenExpired = session
    ? isAccessTokenExpired(session.accessToken)
    : false;
  const [restoreFailed, setRestoreFailed] = useState(false);

  useEffect(() => {
    if (!session || !accessTokenExpired) {
      setRestoreFailed(false);
      return;
    }

    let cancelled = false;
    void refreshStoredSession().catch(() => {
      if (!cancelled) {
        setRestoreFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [accessTokenExpired, session]);

  if (!session || restoreFailed) {
    return <Navigate to="/login" replace />;
  }

  if (accessTokenExpired) {
    return <div>Restoring session...</div>;
  }

  return <>{children}</>;
}
