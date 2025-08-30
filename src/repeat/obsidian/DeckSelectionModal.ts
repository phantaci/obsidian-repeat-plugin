import { Modal, App, Setting } from 'obsidian';
import { Deck, RepeatPluginSettings } from '../../settings';
import { calculateDeckStatistics, formatDeckStatistics } from '../deck';
import { getAPI } from 'obsidian-dataview';

export class DeckSelectionModal extends Modal {
  private decks: Deck[];
  private settings: RepeatPluginSettings;
  private onSelect: (deck: Deck) => void;

  constructor(app: App, decks: Deck[], settings: RepeatPluginSettings, onSelect: (deck: Deck) => void) {
    super(app);
    this.decks = decks;
    this.settings = settings;
    this.onSelect = onSelect;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Deck for Review' });

    const dv = getAPI(this.app);

    this.decks.forEach((deck) => {
      const deckContainer = contentEl.createDiv({ cls: 'deck-selection-item' });
      deckContainer.style.marginBottom = '15px';
      deckContainer.style.padding = '10px';
      deckContainer.style.border = '1px solid var(--background-modifier-border)';
      deckContainer.style.borderRadius = '5px';
      deckContainer.style.cursor = 'pointer';

      // Deck name
      const nameEl = deckContainer.createEl('div', { 
        text: deck.name,
        cls: 'deck-name'
      });
      nameEl.style.fontWeight = 'bold';
      nameEl.style.marginBottom = '5px';

      // Deck description
      if (deck.tagConditions.length > 0) {
        const descEl = deckContainer.createEl('div', {
          text: this.getDeckDescription(deck),
          cls: 'deck-description'
        });
        descEl.style.fontSize = '0.9em';
        descEl.style.color = 'var(--text-muted)';
        descEl.style.marginBottom = '5px';
      }

      // Deck statistics
      if (dv) {
        const stats = calculateDeckStatistics(dv, deck, this.settings);
        const statsEl = deckContainer.createEl('div', {
          text: `New: ${stats.newNotesCount}, Due: ${stats.dueNotesCount}, Levels: ${stats.buttonLevelCounts.join('/')}, Total: ${stats.totalCount}`,
          cls: 'deck-stats'
        });
        statsEl.style.fontSize = '0.8em';
        statsEl.style.color = 'var(--text-accent)';
      }

      // Click handler
      deckContainer.onclick = () => {
        this.onSelect(deck);
        this.close();
      };

      // Hover effect
      deckContainer.onmouseenter = () => {
        deckContainer.style.backgroundColor = 'var(--background-modifier-hover)';
      };
      deckContainer.onmouseleave = () => {
        deckContainer.style.backgroundColor = '';
      };
    });

    // Cancel button
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '20px';

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.onclick = () => this.close();
  }

  private getDeckDescription(deck: Deck): string {
    if (deck.tagConditions.length === 0) {
      return 'All notes';
    }

    const parts: string[] = [];
    for (let i = 0; i < deck.tagConditions.length; i++) {
      const condition = deck.tagConditions[i];
      if (i === 0) {
        parts.push(`#${condition.tag}`);
      } else {
        const operator = condition.operator === 'OR' ? ' OR ' : ' AND ';
        parts.push(`${operator}#${condition.tag}`);
      }
    }

    return parts.join('');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
