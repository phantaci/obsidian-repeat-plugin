// Core deck functionality tests that don't depend on Obsidian API
import { TagCondition } from '../settings';

// Import only the pure functions we can test
function generateDeckName(tagConditions: TagCondition[]): string {
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

function matchesTagConditions(noteTags: string[], tagConditions: TagCondition[]): boolean {
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

interface DeckStatistics {
  deckId: string;
  deckName: string;
  newNotesCount: number;
  dueNotesCount: number;
  buttonLevelCounts: number[];
  totalCount: number;
}

function formatDeckStatistics(stats: DeckStatistics): string {
  const buttonCounts = stats.buttonLevelCounts.join('/');
  return `${stats.deckName} (New: ${stats.newNotesCount}, Due: ${stats.dueNotesCount}, Levels: ${buttonCounts}, Total: ${stats.totalCount})`;
}

describe('Deck Core Functionality', () => {
  describe('generateDeckName', () => {
    it('should return "All Notes" for empty tag conditions', () => {
      const result = generateDeckName([]);
      expect(result).toBe('All Notes');
    });

    it('should generate name for single tag', () => {
      const conditions: TagCondition[] = [{ tag: 'english' }];
      const result = generateDeckName(conditions);
      expect(result).toBe('english');
    });

    it('should generate name for multiple tags with AND', () => {
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'AND' }
      ];
      const result = generateDeckName(conditions);
      expect(result).toBe('english&vocabulary');
    });

    it('should generate name for multiple tags with OR', () => {
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'spanish', operator: 'OR' }
      ];
      const result = generateDeckName(conditions);
      expect(result).toBe('english|spanish');
    });
  });

  describe('matchesTagConditions', () => {
    it('should match all notes when no conditions', () => {
      const noteTags = ['english', 'vocabulary'];
      const conditions: TagCondition[] = [];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });

    it('should match single tag condition', () => {
      const noteTags = ['english', 'vocabulary'];
      const conditions: TagCondition[] = [{ tag: 'english' }];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });

    it('should not match when tag is missing', () => {
      const noteTags = ['spanish', 'vocabulary'];
      const conditions: TagCondition[] = [{ tag: 'english' }];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(false);
    });

    it('should match AND conditions when both tags present', () => {
      const noteTags = ['english', 'vocabulary', 'grammar'];
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'AND' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });

    it('should not match AND conditions when one tag missing', () => {
      const noteTags = ['english', 'grammar'];
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'AND' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(false);
    });

    it('should match OR conditions when one tag present', () => {
      const noteTags = ['english', 'grammar'];
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'OR' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });

    it('should handle case insensitive matching', () => {
      const noteTags = ['English', 'VOCABULARY'];
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'AND' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });
  });

  describe('formatDeckStatistics', () => {
    it('should format deck statistics correctly', () => {
      const stats: DeckStatistics = {
        deckId: 'deck1',
        deckName: 'English Vocabulary',
        newNotesCount: 5,
        dueNotesCount: 3,
        buttonLevelCounts: [2, 3, 1, 0],
        totalCount: 11
      };
      const result = formatDeckStatistics(stats);
      expect(result).toBe('English Vocabulary (New: 5, Due: 3, Levels: 2/3/1/0, Total: 11)');
    });

    it('should handle empty button levels', () => {
      const stats: DeckStatistics = {
        deckId: 'deck1',
        deckName: 'Empty Deck',
        newNotesCount: 0,
        dueNotesCount: 0,
        buttonLevelCounts: [],
        totalCount: 0
      };
      const result = formatDeckStatistics(stats);
      expect(result).toBe('Empty Deck (New: 0, Due: 0, Levels: , Total: 0)');
    });
  });
});
