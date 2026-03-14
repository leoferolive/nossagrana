import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth.store';

interface PrivateRouteProps {
  children: ReactNode;
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};
