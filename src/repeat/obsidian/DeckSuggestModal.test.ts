import { App } from 'obsidian';
import { DeckSuggestModal } from './DeckSuggestModal';
import { Deck, RepeatPluginSettings, DEFAULT_SETTINGS } from '../../settings';

// Mock obsidian-dataview
jest.mock('obsidian-dataview', () => ({
  getAPI: jest.fn(() => ({
    pages: jest.fn(() => []),
  }))
}));

// Mock Obsidian App
const mockApp = {
  vault: {
    getMarkdownFiles: jest.fn(() => [])
  }
} as unknown as App;

describe('DeckSuggestModal', () => {
  const mockSettings: RepeatPluginSettings = {
    ...DEFAULT_SETTINGS,
    decks: [
      {
        id: 'deck1',
        name: '单词',
        isDefault: false,
        tagConditions: [{ tag: '单词', operator: 'AND' }]
      },
      {
        id: 'deck2', 
        name: '短语',
        isDefault: false,
        tagConditions: [{ tag: '短语', operator: 'AND' }]
      },
      {
        id: 'deck3',
        name: 'Tech',
        isDefault: false,
        tagConditions: [{ tag: 'Tech', operator: 'AND' }]
      }
    ]
  };

  let modal: DeckSuggestModal;
  let onSelectMock: jest.Mock;

  beforeEach(() => {
    onSelectMock = jest.fn();
    modal = new DeckSuggestModal(mockApp, mockSettings.decks, mockSettings, onSelectMock);
  });

  describe('getSuggestions', () => {
    test('should return all decks when query is empty', () => {
      const suggestions = modal.getSuggestions('');
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].deck.name).toBe('单词');
      expect(suggestions[1].deck.name).toBe('短语');
      expect(suggestions[2].deck.name).toBe('Tech');
    });

    test('should filter decks by name (case insensitive)', () => {
      const suggestions = modal.getSuggestions('单');
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].deck.name).toBe('单词');
    });

    test('should filter decks by name (case insensitive - English)', () => {
      const suggestions = modal.getSuggestions('tech');
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].deck.name).toBe('Tech');
    });

    test('should return empty array when no matches', () => {
      const suggestions = modal.getSuggestions('xyz');
      
      expect(suggestions).toHaveLength(0);
    });

    test('should include statistics in display text', () => {
      const suggestions = modal.getSuggestions('');
      
      // Each suggestion should have display text with statistics format
      suggestions.forEach(suggestion => {
        expect(suggestion.displayText).toMatch(/\(New: \d+, Levels: [\d\/]+, Total: \d+\)/);
        expect(suggestion.displayText).toContain(suggestion.deck.name);
      });
    });
  });

  describe('display format', () => {
    test('should format deck display as single line', () => {
      const suggestions = modal.getSuggestions('');
      const suggestion = suggestions[0];
      
      // Should be in format: "DeckName (New: X, Levels: X/X/X/X, Total: X)"
      expect(suggestion.displayText).toMatch(/^.+ \(New: \d+, Levels: [\d\/]+, Total: \d+\)$/);
      
      // Should not contain newlines
      expect(suggestion.displayText).not.toContain('\n');
    });

    test('should include all required statistics components', () => {
      const suggestions = modal.getSuggestions('');
      
      suggestions.forEach(suggestion => {
        expect(suggestion.displayText).toContain('New:');
        expect(suggestion.displayText).toContain('Levels:');
        expect(suggestion.displayText).toContain('Total:');
      });
    });
  });

  describe('selection behavior', () => {
    test('should call onSelect with correct deck when suggestion is chosen', () => {
      const suggestions = modal.getSuggestions('');
      const suggestion = suggestions[0];
      
      modal.onChooseSuggestion(suggestion, {} as MouseEvent);
      
      expect(onSelectMock).toHaveBeenCalledWith(suggestion.deck);
      expect(onSelectMock).toHaveBeenCalledTimes(1);
    });
  });
});
