import type { ReactNode } from 'react';

import { useAuth } from '@/contexts/use-auth';

interface PrivateRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const PrivateRoute = ({ children, fallback = null }: PrivateRouteProps) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
