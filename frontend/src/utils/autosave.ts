import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

const STORAGE_KEYS = {
  CURRENT_PROJECT: 'rainstorms_current_project',
  CHARACTERS: 'rainstorms_characters',
  PAGES: 'rainstorms_pages',
  PENDING_SAVES: 'rainstorms_pending_saves',
};

export interface PendingSave {
  type: 'project' | 'character' | 'page';
  id: string;
  data: any;
  timestamp: number;
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Save current state to AsyncStorage for persistence
export async function saveStateToStorage(
  project: any,
  characters: any[],
  pages: any[]
): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, JSON.stringify(project)),
      AsyncStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(characters)),
      AsyncStorage.setItem(STORAGE_KEYS.PAGES, JSON.stringify(pages)),
    ]);
  } catch (error) {
    console.error('Failed to save state to storage:', error);
  }
}

// Load state from AsyncStorage
export async function loadStateFromStorage(): Promise<{
  project: any | null;
  characters: any[];
  pages: any[];
}> {
  try {
    const [projectStr, charsStr, pagesStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT),
      AsyncStorage.getItem(STORAGE_KEYS.CHARACTERS),
      AsyncStorage.getItem(STORAGE_KEYS.PAGES),
    ]);

    return {
      project: projectStr ? JSON.parse(projectStr) : null,
      characters: charsStr ? JSON.parse(charsStr) : [],
      pages: pagesStr ? JSON.parse(pagesStr) : [],
    };
  } catch (error) {
    console.error('Failed to load state from storage:', error);
    return { project: null, characters: [], pages: [] };
  }
}

// Clear stored state
export async function clearStoredState(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT),
      AsyncStorage.removeItem(STORAGE_KEYS.CHARACTERS),
      AsyncStorage.removeItem(STORAGE_KEYS.PAGES),
      AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SAVES),
    ]);
  } catch (error) {
    console.error('Failed to clear stored state:', error);
  }
}

// Save project to backend
export async function saveProjectToBackend(projectId: string, updates: any): Promise<boolean> {
  try {
    await api.put(`/projects/${projectId}`, updates);
    return true;
  } catch (error) {
    console.error('Failed to save project:', error);
    return false;
  }
}

// Save character to backend
export async function saveCharacterToBackend(characterId: string, updates: any): Promise<boolean> {
  try {
    await api.put(`/characters/${characterId}`, updates);
    return true;
  } catch (error) {
    console.error('Failed to save character:', error);
    return false;
  }
}

// Save page to backend
export async function savePageToBackend(pageId: string, updates: any): Promise<boolean> {
  try {
    await api.put(`/pages/${pageId}`, updates);
    return true;
  } catch (error) {
    console.error('Failed to save page:', error);
    return false;
  }
}

// Queue a pending save for retry
export async function queuePendingSave(save: PendingSave): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SAVES);
    const saves: PendingSave[] = existing ? JSON.parse(existing) : [];
    
    // Replace existing save for same item or add new
    const index = saves.findIndex(s => s.type === save.type && s.id === save.id);
    if (index >= 0) {
      saves[index] = save;
    } else {
      saves.push(save);
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SAVES, JSON.stringify(saves));
  } catch (error) {
    console.error('Failed to queue pending save:', error);
  }
}

// Process pending saves
export async function processPendingSaves(): Promise<number> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SAVES);
    if (!existing) return 0;
    
    const saves: PendingSave[] = JSON.parse(existing);
    const remaining: PendingSave[] = [];
    let successCount = 0;
    
    for (const save of saves) {
      let success = false;
      
      switch (save.type) {
        case 'project':
          success = await saveProjectToBackend(save.id, save.data);
          break;
        case 'character':
          success = await saveCharacterToBackend(save.id, save.data);
          break;
        case 'page':
          success = await savePageToBackend(save.id, save.data);
          break;
      }
      
      if (success) {
        successCount++;
      } else {
        remaining.push(save);
      }
    }
    
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SAVES, JSON.stringify(remaining));
    return successCount;
  } catch (error) {
    console.error('Failed to process pending saves:', error);
    return 0;
  }
}
