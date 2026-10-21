import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { authpackService } from '../services/voxconpack/authpackService';

export type AuthRole = 'OPERATOR' | 'SUPERVISOR' | 'SYSTEM';

interface AuthContextType {
  activeRole: AuthRole;
  setActiveRole: (role: AuthRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<AuthRole>('OPERATOR');

  useEffect(() => {
    authpackService.setRole(activeRole);
  }, [activeRole]);

  return (
    <AuthContext.Provider value={{ activeRole, setActiveRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
