import React, { createContext, useContext, useState, ReactNode } from 'react';
import { api } from '../utils/api';

interface Character {
  id: string;
  project_id: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  special_trait: string;
  notes: string;
}

interface Page {
  id: string;
  project_id: string;
  page_number: number;
  outline_beat: string;
  page_text: string;
  illustration_prompt: string;
  emotional_beat: string;
}

interface Project {
  id: string;
  user_id: string | null;
  title: string;
  original_idea: string;
  tone: string;
  age_range: string;
  page_count: number;
  theme: string;
  hook: string;
  summary: string;
  outline: string[];
  is_demo: boolean;
}

interface ProjectContextType {
  currentProject: Project | null;
  characters: Character[];
  pages: Page[];
  isLoading: boolean;
  error: string | null;
  setCurrentProject: (project: Project | null) => void;
  setCharacters: (characters: Character[]) => void;
  setPages: (pages: Page[]) => void;
  loadProject: (projectId: string) => Promise<void>;
  loadDemoProject: () => Promise<void>;
  clearProject: () => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProject = async (projectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectRes, charsRes, pagesRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/characters`),
        api.get(`/projects/${projectId}/pages`),
      ]);
      setCurrentProject(projectRes.data);
      setCharacters(charsRes.data);
      setPages(pagesRes.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoProject = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/demo');
      setCurrentProject(response.data.project);
      setCharacters(response.data.characters);
      setPages(response.data.pages);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load demo project');
    } finally {
      setIsLoading(false);
    }
  };

  const clearProject = () => {
    setCurrentProject(null);
    setCharacters([]);
    setPages([]);
    setError(null);
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        characters,
        pages,
        isLoading,
        error,
        setCurrentProject,
        setCharacters,
        setPages,
        loadProject,
        loadDemoProject,
        clearProject,
        setError,
        setIsLoading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
