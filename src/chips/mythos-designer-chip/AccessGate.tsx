import React, { ReactNode } from 'react';
import { useAuth, AuthRole } from '../../contexts/AuthContext';

const ROLE_LEVELS: Record<AuthRole, number> = {
  OPERATOR: 1,
  SUPERVISOR: 2,
  SYSTEM: 3,
};

interface AccessGateProps {
  children: ReactNode;
  minRole?: AuthRole;
  allowedRoles?: AuthRole[];
  fallback?: ReactNode;
}

export const AccessGate: React.FC<AccessGateProps> = ({ children, minRole, allowedRoles, fallback = null }) => {
  const { activeRole } = useAuth();
  let hasAccess = false;

  if (allowedRoles) {
    hasAccess = allowedRoles.includes(activeRole);
  } else if (minRole) {
    hasAccess = ROLE_LEVELS[activeRole] >= ROLE_LEVELS[minRole];
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
