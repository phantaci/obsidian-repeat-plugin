import { App, SuggestModal } from 'obsidian';
import { Deck, RepeatPluginSettings } from '../../settings';
import { calculateDeckStatistics } from '../deck';
import { getAPI } from 'obsidian-dataview';

interface DeckSuggestion {
  deck: Deck;
  displayText: string;
}

export class DeckSuggestModal extends SuggestModal<DeckSuggestion> {
  private decks: Deck[];
  private settings: RepeatPluginSettings;
  private onSelect: (deck: Deck) => void;

  constructor(app: App, decks: Deck[], settings: RepeatPluginSettings, onSelect: (deck: Deck) => void) {
    super(app);
    this.decks = decks;
    this.settings = settings;
    this.onSelect = onSelect;
    
    // Set placeholder text
    this.setPlaceholder('Type to search decks...');
  }

  getSuggestions(query: string): DeckSuggestion[] {
    const dv = getAPI(this.app);
    
    return this.decks
      .map(deck => {
        // Calculate statistics for display
        let statsText = '';
        if (dv) {
          const stats = calculateDeckStatistics(dv, deck, this.settings);
          statsText = `(New: ${stats.newNotesCount}, Due: ${stats.dueNotesCount}, Levels: ${stats.buttonLevelCounts.join('/')}, Total: ${stats.totalCount})`;
        }
        
        const displayText = `${deck.name} ${statsText}`;
        
        return {
          deck,
          displayText
        };
      })
      .filter(suggestion => {
        // Filter based on query - search in deck name
        const searchText = suggestion.deck.name.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });
  }

  renderSuggestion(suggestion: DeckSuggestion, el: HTMLElement) {
    el.createEl('div', { text: suggestion.displayText });
  }

  onChooseSuggestion(suggestion: DeckSuggestion, evt: MouseEvent | KeyboardEvent) {
    this.onSelect(suggestion.deck);
  }
}
