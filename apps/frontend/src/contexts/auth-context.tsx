import { createContext } from 'react';
import type { User } from './auth-types';

export type AuthContextType = {
  user: User | null;
  isReady: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);
