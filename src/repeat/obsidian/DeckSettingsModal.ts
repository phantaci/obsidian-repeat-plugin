import { App, Modal, Setting, Notice } from 'obsidian';
import { Deck, TagCondition, TagLogicOperator } from '../../settings';
import { generateDeckName } from '../deck';
import { TagInputWithSuggestions } from './TagInputWithSuggestions';

export class DeckSettingsModal extends Modal {
  private deck: Deck;
  private onSave: (deck: Deck) => void;
  private isNewDeck: boolean;
  private tagInputInstances: TagInputWithSuggestions[] = [];

  constructor(app: App, deck: Deck | null, onSave: (deck: Deck) => void) {
    super(app);
    this.onSave = onSave;
    this.isNewDeck = deck === null;
    
    this.deck = deck || {
      id: this.generateId(),
      name: '',
      tagConditions: [{ tag: '' }],
      isDefault: false
    };
  }

  private generateId(): string {
    return 'deck_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: this.isNewDeck ? 'Create New Deck' : 'Edit Deck' });

    // Deck name setting
    new Setting(contentEl)
      .setName('Deck Name')
      .setDesc('Leave empty to auto-generate from tag conditions')
      .addText(text => {
        text.setValue(this.deck.name);
        text.onChange(value => {
          this.deck.name = value;
        });
      });

    // Tag conditions container
    const tagContainer = contentEl.createDiv();
    this.renderTagConditions(tagContainer);

    // Add tag condition button
    new Setting(contentEl)
      .addButton(button => {
        button.setButtonText('Add Tag Condition');
        button.onClick(() => {
          this.deck.tagConditions.push({ tag: '', operator: 'AND' });
          this.renderTagConditions(tagContainer);
        });
      });

    // Save and Cancel buttons
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.marginTop = '20px';

    const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelButton.onclick = () => this.close();

    const saveButton = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
    saveButton.onclick = () => this.save();
  }

  private renderTagConditions(container: HTMLElement) {
    container.empty();
    
    // Clean up existing tag input instances
    this.tagInputInstances.forEach(instance => instance.destroy());
    this.tagInputInstances = [];
    
    this.deck.tagConditions.forEach((condition, index) => {
      const conditionDiv = container.createDiv({ cls: 'deck-tag-condition' });
      conditionDiv.style.display = 'flex';
      conditionDiv.style.alignItems = 'center';
      conditionDiv.style.gap = '10px';
      conditionDiv.style.marginBottom = '10px';

      // Logic operator (for non-first conditions)
      if (index > 0) {
        const operatorSelect = conditionDiv.createEl('select');
        operatorSelect.style.width = '60px';
        
        const andOption = operatorSelect.createEl('option', { value: 'AND', text: 'AND' });
        const orOption = operatorSelect.createEl('option', { value: 'OR', text: 'OR' });
        
        operatorSelect.value = condition.operator || 'AND';
        operatorSelect.onchange = () => {
          condition.operator = operatorSelect.value as TagLogicOperator;
        };
      }

      // Tag input with suggestions
      const tagInputContainer = conditionDiv.createDiv();
      tagInputContainer.style.flex = '1';
      
      const tagInput = new TagInputWithSuggestions(
        this.app,
        tagInputContainer,
        condition.tag,
        (selectedTag: string) => {
          condition.tag = selectedTag;
        }
      );
      
      // Store instance for cleanup
      this.tagInputInstances.push(tagInput);

      // Remove button
      if (this.deck.tagConditions.length > 1) {
        const removeButton = conditionDiv.createEl('button', { text: '×' });
        removeButton.style.width = '30px';
        removeButton.style.height = '30px';
        removeButton.style.borderRadius = '50%';
        removeButton.style.backgroundColor = '#ff4757';
        removeButton.style.color = 'white';
        removeButton.style.border = 'none';
        removeButton.style.cursor = 'pointer';
        removeButton.onclick = () => {
          this.deck.tagConditions.splice(index, 1);
          this.renderTagConditions(container);
        };
      }
    });
  }

  private save() {
    // Validate input
    const validConditions = this.deck.tagConditions.filter(c => c.tag.trim() !== '');
    
    if (validConditions.length === 0) {
      new Notice('At least one tag condition is required');
      return;
    }

    this.deck.tagConditions = validConditions;

    // Auto-generate name if empty
    if (!this.deck.name.trim()) {
      this.deck.name = generateDeckName(this.deck.tagConditions);
    }

    this.onSave(this.deck);
    this.close();
  }

  onClose() {
    // Clean up tag input instances
    this.tagInputInstances.forEach(instance => instance.destroy());
    this.tagInputInstances = [];
    
    const { contentEl } = this;
    contentEl.empty();
  }
}
