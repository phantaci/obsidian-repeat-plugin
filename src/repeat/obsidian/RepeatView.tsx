import { Component, TFile, WorkspaceLeaf } from 'obsidian';
import { ItemView } from 'obsidian';
import { getAPI } from 'obsidian-dataview';
import { DataviewApi } from 'obsidian-dataview';
import { debounce } from 'obsidian';

import { RepeatPluginSettings } from '../../settings';
import { Deck } from '../../settings';
import { getNextDueNote } from '../queries';
import { getNextDueNoteFromDeck } from '../deck';
import { getRepeatChoices } from '../choices';
import { RepeatChoice } from '../repeatTypes';
import { renderTitleElement, renderMarkdown } from '../../markdown';
import { updateRepetitionMetadata } from '../../frontmatter';
import { determineFrontmatterBounds, replaceOrInsertField } from '../../frontmatter';
import { serializeRepetition } from '../serializers';
import { getNotesForDeck } from '../deck';

const MODIFY_DEBOUNCE_MS = 1 * 1000;
export const REPEATING_NOTES_DUE_VIEW = 'repeating-notes-due-view';

class RepeatView extends ItemView {
  buttonsContainer: HTMLElement;
  component: Component;
  currentDueFilePath: string | undefined;
  dv: DataviewApi | undefined;
  icon = 'clock';
  indexPromise: Promise<null> | undefined;
  messageContainer: HTMLElement;
  previewContainer: HTMLElement;
  root: Element;
  settings: RepeatPluginSettings;
  buttonElements: HTMLButtonElement[] = [];
  selectedDeck: Deck | undefined;

  constructor(leaf: WorkspaceLeaf, settings: RepeatPluginSettings) {
    super(leaf);
    this.addRepeatButton = this.addRepeatButton.bind(this);
    this.disableExternalHandlers = this.disableExternalHandlers.bind(this);
    this.enableExternalHandlers = this.enableExternalHandlers.bind(this);
    this.handleExternalModifyOrDelete = debounce(
      this.handleExternalModifyOrDelete,
      MODIFY_DEBOUNCE_MS).bind(this);
    this.handleExternalRename = debounce(
      this.handleExternalRename,
      MODIFY_DEBOUNCE_MS).bind(this);
    this.promiseMetadataChangeOrTimeOut = (
      this.promiseMetadataChangeOrTimeOut.bind(this));
    this.setMessage = this.setMessage.bind(this);
    this.setPage = this.setPage.bind(this);
    this.resetView = this.resetView.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    this.component = new Component();

    this.dv = getAPI(this.app);
    this.settings = settings;

    this.root = this.containerEl.children[1];
    this.indexPromise = new Promise((resolve, reject) => {
      const resolver = () => resolve(null);
      if (!this.dv) {
        return reject(null);
      }
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:index-ready', resolver));
      if (this.dv.index.initialized) {
        // Not invoked on initial open if the index is loading.
        this.app.metadataCache.off('dataview:index-ready', resolver);
        resolve(null);
      }
    });

    this.resetView();
    this.setMessage('Loading...');
  }

  getViewType() {
    return REPEATING_NOTES_DUE_VIEW;
  }

  getDisplayText() {
    return 'Repeat';
  }

  async onOpen() {
    if (!this.dv) {
      this.setMessage(
        'Repeat Plugin requires DataView Plugin to work. ' +
        'Make sure that the DataView Plugin is installed and enabled.'
      );
      return;
    }
    this.enableExternalHandlers();
    this.setPage();
  }

  async onClose() {
    this.disableExternalHandlers();
  }

  enableExternalHandlers() {
    this.registerEvent(
      this.app.vault.on('modify', this.handleExternalModifyOrDelete));
    this.registerEvent(
      this.app.vault.on('delete', this.handleExternalModifyOrDelete));
    this.registerEvent(
      this.app.vault.on('rename', this.handleExternalRename));
    
    // Add keyboard event listener for shortcuts
    this.registerDomEvent(document, 'keydown', this.handleKeyDown);
  }

  disableExternalHandlers () {
    this.app.vault.off('modify', this.handleExternalModifyOrDelete);
    this.app.vault.off('delete', this.handleExternalModifyOrDelete);
    this.app.vault.off('rename', this.handleExternalRename);
  }

  handleKeyDown(event: KeyboardEvent) {
    // Only handle shortcuts when the repeat view is active and has focus
    if (!this.containerEl.contains(document.activeElement) && 
        document.activeElement !== document.body) {
      return;
    }

    // Handle number keys 1-9 for button shortcuts
    const keyNumber = parseInt(event.key);
    if (keyNumber >= 1 && keyNumber <= 9) {
      const buttonIndex = keyNumber - 1;
      if (buttonIndex < this.buttonElements.length) {
        event.preventDefault();
        this.buttonElements[buttonIndex].click();
      }
    }
  }

  async promiseMetadataChangeOrTimeOut() {
    let resolver: (...data: any) => any;
    return new Promise((resolve) => {
      resolver = (_, eventFile, previousPath) => {
        if (eventFile?.path === this.currentDueFilePath
            || previousPath === this.currentDueFilePath) {
          resolve(null);
        }
      };
      this.registerEvent(
        // @ts-ignore: event is added by DataView.
        this.app.metadataCache.on('dataview:metadata-change', resolver));
      setTimeout(resolve, 100);
    }).then(() => {
      this.app.metadataCache.off('dataview:metadata-change', resolver);
    });
  }

  async handleExternalModifyOrDelete(file: TFile) {
    // Current note might be swapped if user edits it to be due later.
    // However, this shouldn't happen when *other* notes are edited.
    if (file.path === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetView();
      this.setPage();
    }
  }

  async handleExternalRename(file: TFile, oldFilePath: string) {
    // This only has to handle renames of this file because automatically
    // updated embedded links emit their own modify event.
    if (oldFilePath === this.currentDueFilePath) {
      await this.promiseMetadataChangeOrTimeOut();
      this.resetView();
      this.setPage();
    }
  }

  async setPage(ignoreFilePath?: string | undefined) {
    await this.indexPromise;
    // Reset the message container so that loading message is hidden.
    this.setMessage('');
    this.messageContainer.style.display = 'none';
    
    let page;
    if (this.selectedDeck) {
      // Use deck-specific query
      page = getNextDueNoteFromDeck(
        this.dv,
        this.selectedDeck,
        this.settings.ignoreFolderPath,
        ignoreFilePath,
        this.settings.enqueueNonRepeatingNotes,
        this.settings.defaultRepeat);
    } else {
      // Use default query (all notes)
      page = getNextDueNote(
        this.dv,
        this.settings.ignoreFolderPath,
        ignoreFilePath,
        this.settings.enqueueNonRepeatingNotes,
        this.settings.defaultRepeat);
    }
    
    if (!page) {
      const deckName = this.selectedDeck ? this.selectedDeck.name : 'All Notes';
      this.setMessage(`All done for ${deckName}!`);
      this.buttonsContainer.createEl('button', {
        text: 'Refresh',
      },
      (buttonElement) => {
        buttonElement.onclick = () => {
          this.resetView();
          this.setPage();
        }
      });
      return;
    }
    const dueFilePath = (page?.file as any).path;
    this.currentDueFilePath = dueFilePath;
    const choices = getRepeatChoices(page.repetition as any, this.settings);
    const matchingMarkdowns = this.app.vault.getMarkdownFiles()
      .filter((file) => file?.path === dueFilePath);
    if (!matchingMarkdowns) {
      this.setMessage(
        `Error: Could not find due note ${dueFilePath}. ` +
        'Reopen this view to retry.');
      return;
    }
    const file = matchingMarkdowns[0];

    // Render the repeat control buttons.
    choices.forEach(choice => this.addRepeatButton(choice, file));

    // .markdown-embed adds undesirable borders while loading,
    // so we only add the class when the note is about to be rendered.
    this.previewContainer.addClass('markdown-embed');

    // Render the title and link that opens note being reviewed.
    renderTitleElement(
      this.previewContainer,
      file,
      this.app.vault);

    // Add container for markdown content.
    const markdownContainer = createEl('div', {
      cls: 'markdown-embed-content',
    });
    if ((page?.repetition as any)?.hidden) {
      markdownContainer.addClass('repeat-markdown_blurred');
      const onBlurredClick = (event) => {
        event.preventDefault();
        markdownContainer.removeClass('repeat-markdown_blurred');
      }
      markdownContainer.addEventListener(
        'click', onBlurredClick, { once: true });
    }

    // Clear any existing content first
    markdownContainer.empty();
    this.previewContainer.appendChild(markdownContainer);

    // Render the note contents.
    const markdown = await this.app.vault.cachedRead(file);
    const delimitedFrontmatterBounds = determineFrontmatterBounds(markdown, true);
    const contentMarkdown = markdown.slice(
      delimitedFrontmatterBounds ? delimitedFrontmatterBounds[1] : 0);
    
    await renderMarkdown(
      this.app,
      contentMarkdown,
      markdownContainer,
      file.path,
      this.component,
      this.app.vault);

    // Auto-play first audio if enabled and we have a valid current file
    if (this.settings.autoPlayAudio && this.currentDueFilePath) {
      // Add a small delay to ensure DOM is fully updated
      setTimeout(() => {
        this.autoPlayFirstAudio(contentMarkdown, markdownContainer);
      }, 100);
    }
  }

  resetView() {
    
    // Stop any playing audio before removing containers
    if (this.previewContainer) {
      const audioElements = this.previewContainer.querySelectorAll('audio');
      audioElements.forEach((audio: HTMLAudioElement) => {
        if (!audio.paused) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
    }
    
    this.messageContainer && this.messageContainer.remove();
    this.buttonsContainer && this.buttonsContainer.remove();
    this.previewContainer && this.previewContainer.remove();
    this.messageContainer = this.root.createEl('div', { cls: 'repeat-message' });
    // Hide until there's a message to manage spacing.
    this.messageContainer.style.display = 'none';
    this.previewContainer = this.root.createEl('div', { cls: 'repeat-embedded_note' });
    this.buttonsContainer = this.root.createEl('div', { cls: 'repeat-buttons repeat-buttons-floating' });
    this.currentDueFilePath = undefined;
    // Clear button references for new set of buttons
    this.buttonElements = [];
  }

  setMessage(message: string) {
    this.messageContainer.style.display = 'block';
    this.messageContainer.setText(message);
  }

  autoPlayFirstAudio(markdown: string, container: HTMLElement) {
    
    // Extract audio file references from markdown (e.g., ![[audio.m4a]])
    const audioRegex = /!\[\[([^[\]]*\.(mp3|m4a|wav|ogg|webm|flac))\]\]/gi;
    const matches = markdown.match(audioRegex);
    
    
    if (!matches || matches.length === 0) {
      return;
    }
    
    // Wait for the DOM to be rendered, then find and play the first audio element
    setTimeout(() => {
      const audioElements = container.querySelectorAll('audio');
      
      if (audioElements.length > 0) {
        const firstAudio = audioElements[0] as HTMLAudioElement;
        
        // Try auto-play first (works on desktop && after frist play on mobile)
        firstAudio.play().then(() => {
          // Auto-play succeeded, remove any play button if it exists
          this.removeAudioPlayButton(container);
        }).catch((error) => {
          // Auto-play failed (likely mobile), show a play button
          this.showAudioPlayButton(container, firstAudio);
        });
      }
    }, 900);
  }

  showAudioPlayButton(container: HTMLElement, audioElement: HTMLAudioElement) {
    // Check if play button already exists
    const existingButton = container.querySelector('.repeat-audio-play-button');
    if (existingButton) {
      return;
    }

    // Create play button
    const playButton = document.createElement('button');
    playButton.className = 'repeat-audio-play-button';
    playButton.innerHTML = '🔊 播放音频';
    playButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--interactive-accent);
      color: var(--text-on-accent);
      border: none;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      cursor: pointer;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    // Add click handler
    playButton.onclick = () => {
      audioElement.play().then(() => {
        // Hide button after successful play
        playButton.style.display = 'none';
      }).catch((error) => {
      });
    };

    // Add to container
    container.style.position = 'relative';
    container.appendChild(playButton);
  }

  removeAudioPlayButton(container: HTMLElement) {
    const playButton = container.querySelector('.repeat-audio-play-button');
    if (playButton) {
      playButton.remove();
    }
  }

  addRepeatButton(choice: RepeatChoice, file: TFile) {
    const buttonIndex = this.buttonElements.length;
    const shortcutKey = buttonIndex + 1;
    
    return this.buttonsContainer.createEl('button', {
        cls: 'repeat-button',
        text: `${choice.text} (${shortcutKey})`,
      },
      (buttonElement) => {
        // Apply color styling if available
        if (choice.color) {
          buttonElement.addClass(`repeat-button-${choice.color}`);
        }
        
        // Store button reference for keyboard shortcuts
        this.buttonElements.push(buttonElement);
        
        buttonElement.onclick = async () => {
          this.resetView();
          const markdown = await this.app.vault.read(file);
          let newMarkdown = updateRepetitionMetadata(
            markdown, serializeRepetition(choice.nextRepetition));
          
          // Update memory level for deck statistics (1-based indexing)
          newMarkdown = this.updateMemoryLevel(newMarkdown, buttonIndex + 1);
          
          this.app.vault.modify(file, newMarkdown);
          this.setPage(file.path);
        }
      });
  }

  updateMemoryLevel(markdown: string, memoryLevel: number): string {
    // memoryLevel is now 1-based (1, 2, 3, 4...)
    
    // Use the existing frontmatter utility functions for safe manipulation
    const frontmatterBounds = determineFrontmatterBounds(markdown);
    
    if (frontmatterBounds) {
      const [start, end] = frontmatterBounds;
      let frontmatter = markdown.slice(start, end);
      const bodyContent = markdown.slice(end);
      
      // Use replaceOrInsertField to safely add/update memory_level
      frontmatter = replaceOrInsertField(frontmatter, 'memory_level', memoryLevel.toString());
      
      return markdown.slice(0, start) + frontmatter + bodyContent;
    } else {
      // No frontmatter exists, create new one using the standard approach
      return `---\nmemory_level: ${memoryLevel}\n---\n${markdown}`;
    }
  }

  setSelectedDeck(deck: Deck) {
    this.selectedDeck = deck;
    // Reset the view first to clear any existing content
    this.resetView();
    // Then refresh the view with the selected deck
    this.setPage();
  }
}

export default RepeatView;
