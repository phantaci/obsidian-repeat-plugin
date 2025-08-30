import { DataviewApi, DataArray, Literal } from 'obsidian-dataview';
import { Deck, TagCondition } from '../settings';
import { getNotesDue } from './queries';
import { RepeatPluginSettings } from '../settings';

export interface DeckStatistics {
  deckId: string;
  deckName: string;
  newNotesCount: number; // Notes without memory_level (never reviewed)
  dueNotesCount: number; // Notes with due_at <= current time
  buttonLevelCounts: number[]; // Count for each button level
  totalCount: number;
}

export function generateDeckName(tagConditions: TagCondition[]): string {
  if (tagConditions.length === 0) {
    return 'All Notes';
  }
  
  const parts: string[] = [];
  for (let i = 0; i < tagConditions.length; i++) {
    const condition = tagConditions[i];
    if (i === 0) {
      parts.push(condition.tag);
    } else {
      const operator = condition.operator === 'OR' ? '|' : '&';
      parts.push(operator + condition.tag);
    }
  }
  
  return parts.join('');
}

export function matchesTagConditions(noteTags: string[], tagConditions: TagCondition[]): boolean {
  if (tagConditions.length === 0) {
    return true; // Default deck matches all notes
  }
  
  // Convert note tags to lowercase for case-insensitive matching
  const lowerNoteTags = noteTags.map(tag => tag.toLowerCase());
  
  
  let result = false;
  let currentOperator: 'AND' | 'OR' = 'AND';
  
  for (let i = 0; i < tagConditions.length; i++) {
    const condition = tagConditions[i];
    const tagMatch = lowerNoteTags.includes(condition.tag.toLowerCase());
    
    
    if (i === 0) {
      result = tagMatch;
    } else {
      if (currentOperator === 'AND') {
        result = result && tagMatch;
      } else {
        result = result || tagMatch;
      }
    }
    
    
    // Set operator for next iteration
    if (i < tagConditions.length - 1) {
      currentOperator = tagConditions[i + 1].operator || 'AND';
    }
  }
  
  return result;
}

export function getNotesForDeck(
  dv: DataviewApi | undefined,
  deck: Deck,
  ignoreFolderPath: string,
  enqueueNonRepeatingNotes: boolean,
  defaultRepeat: any
): DataArray<Record<string, Literal>> | undefined {
  const allNotes = getNotesDue(dv, ignoreFolderPath, undefined, enqueueNonRepeatingNotes, defaultRepeat);
  
  if (!allNotes) {
    return undefined;
  }
  
  // Filter notes based on deck's tag conditions
  return allNotes.filter((note: any) => {
    // Get tags from different sources
    const fileTags = note.file?.tags || [];
    const etags = note.file?.etags || [];
    const frontmatterTags = note.tags || [];
    
    // Combine all possible tag sources and clean them
    const allTagSources = [...fileTags, ...etags, ...frontmatterTags];
    const cleanTags = allTagSources
      .filter(tag => tag && typeof tag === 'string')
      .map(tag => tag.replace(/^#/, '')); // Remove # prefix if present
    
    return matchesTagConditions(cleanTags, deck.tagConditions);
  });
}

export function getAllNotesForDeck(
  dv: DataviewApi | undefined,
  deck: Deck,
  ignoreFolderPath: string
): DataArray<Record<string, Literal>> | undefined {
  if (!dv) {
    return undefined;
  }
  
  
  // For default deck (no conditions), return only pages with repeat property
  if (deck.tagConditions.length === 0) {
    let allPages = dv.pages()
      .where((page: any) => {
        const { repeat } = page.file.frontmatter || {};
        // Include pages that have a repeat property and it's not disabled
        return repeat && repeat !== 'never';
      });
    if (ignoreFolderPath) {
      allPages = allPages.where((page: any) => !page.file.folder.startsWith(ignoreFolderPath));
    }
    return allPages;
  }
  
  // For tag-based decks, first filter by repeat property, then by tags
  let allPages = dv.pages()
    .where((page: any) => {
      const { repeat } = page.file.frontmatter || {};
      // Include pages that have a repeat property and it's not disabled
      return repeat && repeat !== 'never';
    });
  
  // Filter by ignore folder if specified
  if (ignoreFolderPath) {
    allPages = allPages.where((page: any) => !page.file.folder.startsWith(ignoreFolderPath));
  }
  
  // Apply tag filtering
  const filteredPages = allPages.filter((page: any) => {
    // Get all tags from the page using various possible field names
    const fileTags = page.file?.tags || [];
    const etags = page.file?.etags || [];
    const frontmatterTags = page.tags || [];
    
    const allTags = [
      ...fileTags,
      ...etags,
      ...frontmatterTags
    ].filter(tag => tag && typeof tag === 'string')
     .map(tag => tag.replace(/^#/, ''));
    
    const matches = matchesTagConditions(allTags, deck.tagConditions);
    
    return matches;
  });
  
  return filteredPages;
}


export function calculateDeckStatistics(
  dv: DataviewApi | undefined,
  deck: Deck,
  settings: RepeatPluginSettings
): DeckStatistics {
  
  // Use getAllNotesForDeck to get all matching notes, not just due ones
  const allNotes = getAllNotesForDeck(dv, deck, settings.ignoreFolderPath);
  
  // Determine button count dynamically based on settings
  let buttonCount = 4; // Default for spaced repetition (0.5x, 1x, 1.5x, 2x)
  
  if (settings.useCustomIntervals && settings.customIntervalButtons.length > 0) {
    buttonCount = settings.customIntervalButtons.length;
  }
  
  
  const stats: DeckStatistics = {
    deckId: deck.id,
    deckName: deck.name,
    newNotesCount: 0,
    dueNotesCount: 0,
    buttonLevelCounts: new Array(buttonCount).fill(0),
    totalCount: 0
  };
  
  if (!allNotes) {
    return stats;
  }
  
  stats.totalCount = allNotes.length;
  
  // Count due notes separately
  const dueNotes = getNotesForDeck(
    dv,
    deck,
    settings.ignoreFolderPath,
    settings.enqueueNonRepeatingNotes,
    settings.defaultRepeat
  );
  
  // Calculate Due notes count - notes with due_at <= current time
  const dueCount = dueNotes ? dueNotes.length : 0;
  stats.dueNotesCount = dueCount;
  
  // Count "New" notes as those without memory_level property (never reviewed)
  let newCount = 0;
  allNotes.forEach((note: any) => {
    // Only count notes that truly don't have memory_level property
    if (note.memory_level === undefined || note.memory_level === null) {
      newCount++;
    }
  });
  
  stats.newNotesCount = newCount;
  
  // Count memory levels for ALL notes in the deck (not just due ones)
  allNotes.forEach((note: any) => {
    const memoryLevel = note.memory_level || 1; // Default to 1 (first button level)
    
    // Convert 1-based memory_level to 0-based array index
    const arrayIndex = memoryLevel - 1;
    if (arrayIndex >= 0 && arrayIndex < stats.buttonLevelCounts.length) {
      stats.buttonLevelCounts[arrayIndex]++;
    }
  });
  
  return stats;
}

export function formatDeckStatistics(stats: DeckStatistics): string {
  const buttonCounts = stats.buttonLevelCounts.join('/');
  return `${stats.deckName} (New: ${stats.newNotesCount}, Due: ${stats.dueNotesCount}, Levels: ${buttonCounts}, Total: ${stats.totalCount})`;
}

export function getNextDueNoteFromDeck(
  dv: DataviewApi | undefined,
  deck: Deck,
  ignoreFolderPath: string,
  ignoreFilePath: string | undefined,
  enqueueNonRepeatingNotes: boolean,
  defaultRepeat: any
): any {
  const deckNotes = getNotesForDeck(dv, deck, ignoreFolderPath, enqueueNonRepeatingNotes, defaultRepeat);
  
  if (!deckNotes || deckNotes.length === 0) {
    return undefined;
  }

  // Filter out the ignored file path
  const filteredNotes = ignoreFilePath 
    ? deckNotes.filter((note: any) => note.file?.path !== ignoreFilePath)
    : deckNotes;

  if (filteredNotes.length === 0) {
    return undefined;
  }

  // Return the first note (they should already be sorted by due date in the original query)
  return filteredNotes[0];
}
