import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { api, formatApiError } from '../utils/api';
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

export interface CoverData {
  cover_style: string;
  concept: string;
  front_cover_url: string;
  back_blurb: string;
  author_name: string;
  tagline: string;
  generated_at: string | null;
}

export interface PageLayoutData {
  layout_type: string;
  image_box: { x: number; y: number; width: number; height: number };
  text_box: { x: number; y: number; width: number; height: number };
  font_size: number;
  alignment: string;
  print_safe: boolean;
  gutter_safe: boolean;
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
  // Page Layout Engine
  page_layout: PageLayoutData | null;
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
  // Page Layout Engine
  page_theme: string;
  // Smart Cover Generator
  cover: CoverData | null;
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
  // We use a ref to ensure the debounced function is stable and doesn't get recreated
  // which would break the debounce timer.
  const saveDebounceRef = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    saveDebounceRef.current = debounce(async () => {
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
        const charUpdates = Array.from(pendingCharacterChanges.current.entries());
        for (const [charId, updates] of charUpdates) {
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
          pendingCharacterChanges.current.delete(charId);
        }

        // Save page changes
        const pageUpdates = Array.from(pendingPageChanges.current.entries());
        for (const [pageId, updates] of pageUpdates) {
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
          pendingPageChanges.current.delete(pageId);
        }

        setSaveStatus(hasError ? 'error' : 'saved');
        if (!hasError) {
          setLastSaved(new Date());
          // If we had no errors, try processing any older pending saves too
          await processPendingSaves();
        }
        
        // Reset status after a delay
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, AUTOSAVE_DELAY);
  }, [currentProject?.id]); // Only recreate if the project ID changes

  const triggerSave = useCallback(() => {
    if (saveDebounceRef.current) {
      saveDebounceRef.current();
    }
  }, []);

  // Periodic check for pending saves (every 30s)
  useEffect(() => {
    const interval = setInterval(async () => {
      const processedCount = await processPendingSaves();
      if (processedCount > 0) {
        console.info(`Processed ${processedCount} pending background saves.`);
        setLastSaved(new Date());
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);


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
      triggerSave();
      return updated;
    });
  }, [triggerSave]);

  // Update character with autosave
  const updateCharacter = useCallback((characterId: string, updates: Partial<Character>) => {
    setCharactersState(prev => {
      const updated = prev.map(c => 
        c.id === characterId ? { ...c, ...updates } : c
      );
      const existing = pendingCharacterChanges.current.get(characterId) || {};
      pendingCharacterChanges.current.set(characterId, { ...existing, ...updates });
      triggerSave();
      return updated;
    });
  }, [triggerSave]);

  // Update page with autosave
  const updatePage = useCallback((pageId: string, updates: Partial<Page>) => {
    setPagesState(prev => {
      const updated = prev.map(p => 
        p.id === pageId ? { ...p, ...updates } : p
      );
      const existing = pendingPageChanges.current.get(pageId) || {};
      pendingPageChanges.current.set(pageId, { ...existing, ...updates });
      triggerSave();
      return updated;
    });
  }, [triggerSave]);

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
      setError(formatApiError(err, 'Failed to load project'));
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
      setError(null); // Clear any prior error on success
    } catch (err: any) {
      setError(formatApiError(err, 'Failed to load demo project'));
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
