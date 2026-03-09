import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { api } from '../utils/api';
import {
  debounce,
  saveStateToStorage,
  loadStateFromStorage,
  clearStoredState,
  saveProjectToBackend,
  saveCharacterToBackend,
  savePageToBackend,
  processPendingSaves,
  queuePendingSave,
} from '../utils/autosave';

export interface Character {
  id: string;
  project_id: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  special_trait: string;
  notes: string;
  // Visual profile fields (Character Consistency Engine)
  color_palette: string;
  clothing: string;
  unique_traits: string;
  reference_sheet_url: string;
  appearance_locked: boolean;
}

export interface Page {
  id: string;
  project_id: string;
  page_number: number;
  outline_beat: string;
  page_text: string;
  illustration_prompt: string;
  illustration_url: string;
  emotional_beat: string;
}

export interface Project {
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
  illustration_style: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ProjectContextType {
  currentProject: Project | null;
  characters: Character[];
  pages: Page[];
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  setCurrentProject: (project: Project | null) => void;
  setCharacters: (characters: Character[]) => void;
  setPages: (pages: Page[]) => void;
  loadProject: (projectId: string) => Promise<void>;
  loadDemoProject: () => Promise<void>;
  clearProject: () => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  // Autosave functions
  updateProject: (updates: Partial<Project>) => void;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
  saveNow: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const AUTOSAVE_DELAY = 1500; // 1.5 seconds debounce

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [characters, setCharactersState] = useState<Character[]>([]);
  const [pages, setPagesState] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Track pending changes
  const pendingProjectChanges = useRef<Partial<Project> | null>(null);
  const pendingCharacterChanges = useRef<Map<string, Partial<Character>>>(new Map());
  const pendingPageChanges = useRef<Map<string, Partial<Page>>>(new Map());

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = async () => {
      const { project, characters: chars, pages: pgs } = await loadStateFromStorage();
      if (project) {
        setCurrentProjectState(project);
        setCharactersState(chars);
        setPagesState(pgs);
      }
      // Process any pending saves from previous session
      await processPendingSaves();
    };
    loadPersistedState();
  }, []);

  // Save state to storage whenever it changes
  useEffect(() => {
    if (currentProject) {
      saveStateToStorage(currentProject, characters, pages);
    }
  }, [currentProject, characters, pages]);

  // Debounced save to backend
  const debouncedSaveToBackend = useCallback(
    debounce(async () => {
      setSaveStatus('saving');
      let hasError = false;

      try {
        // Save project changes
        if (pendingProjectChanges.current && currentProject) {
          const success = await saveProjectToBackend(currentProject.id, pendingProjectChanges.current);
          if (!success) {
            await queuePendingSave({
              type: 'project',
              id: currentProject.id,
              data: pendingProjectChanges.current,
              timestamp: Date.now(),
            });
            hasError = true;
          }
          pendingProjectChanges.current = null;
        }

        // Save character changes
        for (const [charId, updates] of pendingCharacterChanges.current) {
          const success = await saveCharacterToBackend(charId, updates);
          if (!success) {
            await queuePendingSave({
              type: 'character',
              id: charId,
              data: updates,
              timestamp: Date.now(),
            });
            hasError = true;
          }
        }
        pendingCharacterChanges.current.clear();

        // Save page changes
        for (const [pageId, updates] of pendingPageChanges.current) {
          const success = await savePageToBackend(pageId, updates);
          if (!success) {
            await queuePendingSave({
              type: 'page',
              id: pageId,
              data: updates,
              timestamp: Date.now(),
            });
            hasError = true;
          }
        }
        pendingPageChanges.current.clear();

        setSaveStatus(hasError ? 'error' : 'saved');
        if (!hasError) {
          setLastSaved(new Date());
        }
        
        // Reset status after a delay
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, AUTOSAVE_DELAY),
    [currentProject]
  );

  // Set project and trigger autosave
  const setCurrentProject = useCallback((project: Project | null) => {
    setCurrentProjectState(project);
    if (!project) {
      clearStoredState();
    }
  }, []);

  const setCharacters = useCallback((chars: Character[]) => {
    setCharactersState(chars);
  }, []);

  const setPages = useCallback((pgs: Page[]) => {
    setPagesState(pgs);
  }, []);

  // Update project with autosave
  const updateProject = useCallback((updates: Partial<Project>) => {
    setCurrentProjectState(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      pendingProjectChanges.current = { ...pendingProjectChanges.current, ...updates };
      debouncedSaveToBackend();
      return updated;
    });
  }, [debouncedSaveToBackend]);

  // Update character with autosave
  const updateCharacter = useCallback((characterId: string, updates: Partial<Character>) => {
    setCharactersState(prev => {
      const updated = prev.map(c => 
        c.id === characterId ? { ...c, ...updates } : c
      );
      const existing = pendingCharacterChanges.current.get(characterId) || {};
      pendingCharacterChanges.current.set(characterId, { ...existing, ...updates });
      debouncedSaveToBackend();
      return updated;
    });
  }, [debouncedSaveToBackend]);

  // Update page with autosave
  const updatePage = useCallback((pageId: string, updates: Partial<Page>) => {
    setPagesState(prev => {
      const updated = prev.map(p => 
        p.id === pageId ? { ...p, ...updates } : p
      );
      const existing = pendingPageChanges.current.get(pageId) || {};
      pendingPageChanges.current.set(pageId, { ...existing, ...updates });
      debouncedSaveToBackend();
      return updated;
    });
  }, [debouncedSaveToBackend]);

  // Force immediate save
  const saveNow = useCallback(async () => {
    setSaveStatus('saving');
    try {
      if (pendingProjectChanges.current && currentProject) {
        await saveProjectToBackend(currentProject.id, pendingProjectChanges.current);
        pendingProjectChanges.current = null;
      }
      for (const [charId, updates] of pendingCharacterChanges.current) {
        await saveCharacterToBackend(charId, updates);
      }
      pendingCharacterChanges.current.clear();
      for (const [pageId, updates] of pendingPageChanges.current) {
        await savePageToBackend(pageId, updates);
      }
      pendingPageChanges.current.clear();
      
      setSaveStatus('saved');
      setLastSaved(new Date());
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [currentProject]);

  const loadProject = async (projectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectRes, charsRes, pagesRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/characters`),
        api.get(`/projects/${projectId}/pages`),
      ]);
      setCurrentProjectState(projectRes.data);
      setCharactersState(charsRes.data);
      setPagesState(pagesRes.data);
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
      setCurrentProjectState(response.data.project);
      setCharactersState(response.data.characters);
      setPagesState(response.data.pages);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load demo project');
    } finally {
      setIsLoading(false);
    }
  };

  const clearProject = useCallback(() => {
    setCurrentProjectState(null);
    setCharactersState([]);
    setPagesState([]);
    setError(null);
    setSaveStatus('idle');
    setLastSaved(null);
    clearStoredState();
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        characters,
        pages,
        isLoading,
        error,
        saveStatus,
        lastSaved,
        setCurrentProject,
        setCharacters,
        setPages,
        loadProject,
        loadDemoProject,
        clearProject,
        setError,
        setIsLoading,
        updateProject,
        updateCharacter,
        updatePage,
        saveNow,
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
