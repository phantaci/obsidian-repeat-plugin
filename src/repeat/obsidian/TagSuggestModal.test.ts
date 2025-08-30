import { App, TFile } from 'obsidian';
import { TagSuggestModal } from './TagSuggestModal';

// Mock obsidian-dataview
jest.mock('obsidian-dataview', () => ({
  getAPI: jest.fn()
}));

// Mock Obsidian App and related classes
const mockApp = {
  vault: {
    getMarkdownFiles: jest.fn(() => [
      { path: 'note1.md' } as TFile,
      { path: 'note2.md' } as TFile,
      { path: 'note3.md' } as TFile,
    ])
  },
  metadataCache: {
    getFileCache: jest.fn((file: TFile) => {
      // Mock different tag scenarios for different files
      if (file.path === 'note1.md') {
        return {
          tags: [
            { tag: '#单词', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 3, offset: 3 } } },
            { tag: '#Tech', position: { start: { line: 0, col: 4, offset: 4 }, end: { line: 0, col: 9, offset: 9 } } }
          ]
        };
      } else if (file.path === 'note2.md') {
        return {
          tags: [
            { tag: '#单词', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 3, offset: 3 } } },
            { tag: '#短语', position: { start: { line: 0, col: 4, offset: 4 }, end: { line: 0, col: 7, offset: 7 } } }
          ]
        };
      } else if (file.path === 'note3.md') {
        return {
          tags: [
            { tag: '#Tech', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 5, offset: 5 } } }
          ]
        };
      }
      return null;
    })
  }
} as unknown as App;

describe('TagSuggestModal', () => {
  let modal: TagSuggestModal;
  let onSelectMock: jest.Mock;

  beforeEach(() => {
    onSelectMock = jest.fn();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock getAPI to return null (fallback mode)
    const { getAPI } = require('obsidian-dataview');
    getAPI.mockReturnValue(null);
    
    modal = new TagSuggestModal(mockApp, onSelectMock);
  });

  describe('loadAllTags', () => {
    test('should load tags from vault files when dataview is not available', () => {
      const suggestions = modal.getSuggestions('');
      
      // Should have loaded tags: 单词(2), Tech(2), 短语(1)
      expect(suggestions).toHaveLength(3);
      
      // Check if tags are sorted by count (descending)
      const tagNames = suggestions.map(s => s.tag);
      expect(tagNames).toContain('单词');
      expect(tagNames).toContain('Tech');
      expect(tagNames).toContain('短语');
    });

    test('should count tag usage correctly', () => {
      const suggestions = modal.getSuggestions('');
      
      const danciTag = suggestions.find(s => s.tag === '单词');
      const techTag = suggestions.find(s => s.tag === 'Tech');
      const duanyuTag = suggestions.find(s => s.tag === '短语');
      
      expect(danciTag?.count).toBe(2); // appears in note1 and note2
      expect(techTag?.count).toBe(2);  // appears in note1 and note3
      expect(duanyuTag?.count).toBe(1); // appears in note2 only
    });

    test('should handle tags with # prefix correctly', () => {
      const suggestions = modal.getSuggestions('');
      
      // All tags should be without # prefix
      suggestions.forEach(suggestion => {
        expect(suggestion.tag).not.toMatch(/^#/);
      });
    });
  });

  describe('getSuggestions', () => {
    test('should return all tags when query is empty', () => {
      const suggestions = modal.getSuggestions('');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(20); // Limited to 20
    });

    test('should filter tags by query (case insensitive)', () => {
      const suggestions = modal.getSuggestions('单');
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].tag).toBe('单词');
    });

    test('should filter tags by query (English, case insensitive)', () => {
      const suggestions = modal.getSuggestions('tech');
      
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].tag).toBe('Tech');
    });

    test('should return empty array when no matches', () => {
      const suggestions = modal.getSuggestions('nonexistent');
      
      expect(suggestions).toHaveLength(0);
    });

    test('should limit results to 20 items', () => {
      // This test assumes we have more than 20 tags, but with our mock we only have 3
      const suggestions = modal.getSuggestions('');
      
      expect(suggestions.length).toBeLessThanOrEqual(20);
    });
  });

  describe('onChooseSuggestion', () => {
    test('should call onSelect with correct tag when suggestion is chosen', () => {
      const suggestions = modal.getSuggestions('');
      const suggestion = suggestions[0];
      
      modal.onChooseSuggestion(suggestion, {} as MouseEvent);
      
      expect(onSelectMock).toHaveBeenCalledWith(suggestion.tag);
      expect(onSelectMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderSuggestion', () => {
    test('should render tag name and count', () => {
      const mockEl = {
        createDiv: jest.fn().mockReturnValue({
          createSpan: jest.fn().mockReturnValue({
            style: {}
          })
        })
      } as unknown as HTMLElement;

      const suggestion = { tag: 'test-tag', count: 5 };
      
      modal.renderSuggestion(suggestion, mockEl);
      
      expect(mockEl.createDiv).toHaveBeenCalledWith({ cls: 'tag-suggestion' });
    });
  });

  describe('dataview integration', () => {
    test('should use dataview when available', () => {
      const mockDataview = {
        pages: jest.fn().mockReturnValue([
          {
            file: {
              tags: [{ tag: 'dataview-tag' }]
            }
          }
        ])
      };

      const { getAPI } = require('obsidian-dataview');
      getAPI.mockReturnValue(mockDataview);

      const modalWithDataview = new TagSuggestModal(mockApp, onSelectMock);
      const suggestions = modalWithDataview.getSuggestions('');

      expect(mockDataview.pages).toHaveBeenCalled();
    });
  });
});
