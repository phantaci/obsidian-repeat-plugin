import { 
  generateDeckName, 
  matchesTagConditions,
  formatDeckStatistics 
} from './deck';
import { TagCondition } from '../settings';

// Define DeckStatistics interface locally for testing
interface DeckStatistics {
  deckId: string;
  deckName: string;
  newNotesCount: number;
  buttonLevelCounts: number[];
  totalCount: number;
}

describe('Deck functionality', () => {
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

    it('should generate name for mixed operators', () => {
      const conditions: TagCondition[] = [
        { tag: 'language' },
        { tag: 'english', operator: 'AND' },
        { tag: 'spanish', operator: 'OR' }
      ];
      const result = generateDeckName(conditions);
      expect(result).toBe('language&english|spanish');
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

    it('should match OR conditions when second tag present', () => {
      const noteTags = ['vocabulary', 'grammar'];
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'OR' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });

    it('should not match OR conditions when neither tag present', () => {
      const noteTags = ['spanish', 'grammar'];
      const conditions: TagCondition[] = [
        { tag: 'english' },
        { tag: 'vocabulary', operator: 'OR' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(false);
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

    it('should handle complex mixed conditions', () => {
      const noteTags = ['language', 'english', 'advanced'];
      const conditions: TagCondition[] = [
        { tag: 'language' },
        { tag: 'english', operator: 'AND' },
        { tag: 'spanish', operator: 'OR' }
      ];
      const result = matchesTagConditions(noteTags, conditions);
      expect(result).toBe(true);
    });
  });

  describe('formatDeckStatistics', () => {
    it('should format deck statistics correctly', () => {
      const stats = {
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
      const stats = {
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
