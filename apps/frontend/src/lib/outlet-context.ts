import type { User } from '../contexts/auth-types';
import type { Project } from './types';

export type AppOutletContext = {
  selectedProjectId: string | number | null;
  setSelectedProjectId: (id: string | number | null) => void;
  projects: Project[];
  user: User | null;
  reloadProjects: () => Promise<void>;
};
