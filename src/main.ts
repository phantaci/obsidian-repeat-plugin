import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  Notice,
  PluginManifest,
  debounce,
  MarkdownView,
} from 'obsidian';

import RepeatView, { REPEATING_NOTES_DUE_VIEW } from './repeat/obsidian/RepeatView';
import RepeatNoteSetupModal from './repeat/obsidian/RepeatNoteSetupModal';
import { RepeatPluginSettings, DEFAULT_SETTINGS } from './settings';
import { updateRepetitionMetadata } from './frontmatter';
import { getAPI } from 'obsidian-dataview';
import { getNotesDue } from './repeat/queries';
import { parseHiddenFieldFromMarkdown, parseRepeat, parseRepetitionFromMarkdown } from './repeat/parsers';
import { serializeRepeat, serializeRepetition } from './repeat/serializers';
import { incrementRepeatDueAt } from './repeat/choices';
import { PeriodUnit, Repetition, Strategy, TimeOfDay } from './repeat/repeatTypes';

const COUNT_DEBOUNCE_MS = 5 * 1000;

export default class RepeatPlugin extends Plugin {
  settings: RepeatPluginSettings;
  statusBarItem: HTMLElement | undefined;
  ribbonIcon: HTMLElement | undefined;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.updateNotesDueCount = debounce(
      this.updateNotesDueCount, COUNT_DEBOUNCE_MS).bind(this);
    this.manageStatusBarItem = this.manageStatusBarItem.bind(this);
    this.registerCommands = this.registerCommands.bind(this);
    this.makeRepeatRibbonIcon = this.makeRepeatRibbonIcon.bind(this);
  }

  async activateRepeatNotesDueView() {
    // Allow only one repeat view.
    this.app.workspace.detachLeavesOfType(REPEATING_NOTES_DUE_VIEW);

    // Create a new leaf for the view.
    await this.app.workspace.getLeaf(true).setViewState({
      type: REPEATING_NOTES_DUE_VIEW,
      active: true,
    });
    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(REPEATING_NOTES_DUE_VIEW)[0]
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    if (!this.settings.showDueCountInStatusBar && this.statusBarItem) {
      this.statusBarItem.remove();
      this.statusBarItem = undefined;
    }
    if (this.settings.showDueCountInStatusBar) {
      this.updateNotesDueCount();
    }
    if (!this.settings.showRibbonIcon && this.ribbonIcon) {
      this.ribbonIcon.remove();
      this.ribbonIcon = undefined;
    }
    if (this.settings.showRibbonIcon && !this.ribbonIcon) {
      this.makeRepeatRibbonIcon();
    }
  }

  updateNotesDueCount() {
    if (this.settings.showDueCountInStatusBar) {
      if (!this.statusBarItem) {
        this.statusBarItem = this.addStatusBarItem();
      }
      const dueNoteCount = getNotesDue(
        getAPI(this.app),
        this.settings.ignoreFolderPath,
        undefined,
        this.settings.enqueueNonRepeatingNotes,
        this.settings.defaultRepeat)?.length;
      if (dueNoteCount != undefined && this.statusBarItem) {
        this.statusBarItem.setText(
          `${dueNoteCount} repeat notes due`);
      }
    }
  }

  manageStatusBarItem() {
    // Update due note count when the DataView index populates.
    this.registerEvent(
      this.app.metadataCache.on(
        // @ts-ignore: event is added by DataView.
        'dataview:index-ready',
        () => {
          this.updateNotesDueCount();
          // Update due note count whenever metadata changes.
          setTimeout(() => {
            this.registerEvent(
              this.app.metadataCache.on(
                // @ts-ignore: event is added by DataView.
                'dataview:metadata-change',
                this.updateNotesDueCount
              )
            );
          }, COUNT_DEBOUNCE_MS);
        })
    );
    // Periodically update due note count as notes become due.
    const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
    this.registerInterval(
      window.setInterval(this.updateNotesDueCount, FIVE_MINUTES_IN_MS)
    )
  }

  makeRepeatRibbonIcon() {
    if (this.settings.showRibbonIcon) {
      this.ribbonIcon = this.addRibbonIcon(
        'clock', 'Repeat due notes', () => {
          this.activateRepeatNotesDueView();
        }
      );
    }
  }

  registerCommands() {
    this.addCommand({
      id: 'setup-repeat-note',
      name: 'Repeat this note...',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        const onSubmit = (result: Repetition) => {
          if (!markdownView || !markdownView.file) {
            return;
          }
          const { editor, file } = markdownView;
          const content = editor.getValue();
          const newContent = updateRepetitionMetadata(
            content, serializeRepetition(result));
          this.app.vault.modify(file, newContent);
        };
        if (markdownView) {
          if (!checking) {
            let repetition;
            if (markdownView) {
              const { editor } = markdownView;
              const content = editor.getValue();
              repetition = parseRepetitionFromMarkdown(content);
            }
            new RepeatNoteSetupModal(
              this.app,
              onSubmit,
              this.settings,
              repetition,
            ).open();
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'open-repeat-view',
      name: 'Review due notes',
      callback: () => {
        this.activateRepeatNotesDueView();
      },
    });

    ['day', 'week', 'month', 'year'].map((unit) => {
      this.addCommand({
        id: `repeat-every-${unit}`,
        name: `Repeat this note every ${unit}`,
        checkCallback: (checking: boolean) => {
          const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (markdownView && !!markdownView.file) {
            if (!checking) {
              const { editor, file } = markdownView;
              const content = editor.getValue();
              const repeat = {
                repeatStrategy: 'PERIODIC' as Strategy,
                repeatPeriod: 1,
                repeatPeriodUnit: unit.toUpperCase() as PeriodUnit,
                repeatTimeOfDay: 'AM' as TimeOfDay,
              };
              const repeatDueAt = incrementRepeatDueAt({
                ...repeat,
                repeatDueAt: undefined,
              } as any, this.settings);
              const newContent = updateRepetitionMetadata(content, serializeRepetition({
                ...repeat,
                hidden: parseHiddenFieldFromMarkdown(content),
                repeatDueAt,
                virtual: false,
              }));
              this.app.vault.modify(file, newContent);
            }
            return true;
          }
          return false;
        }
      });
    });

    this.addCommand({
      id: 'repeat-never',
      name: 'Never repeat this note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView && !!markdownView.file) {
          if (!checking) {
            const { editor, file } = markdownView;
            const content = editor.getValue();
            const newContent = updateRepetitionMetadata(content, {
              repeat: 'never',
              due_at: undefined,
              hidden: undefined,
            });
            this.app.vault.modify(file, newContent);
          }
          return true;
        }
        return false;
      }
    });

    this.addCommand({
      id: 'repeat-never',
      name: 'Never repeat this note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView && !!markdownView.file) {
          if (!checking) {
            const { editor, file } = markdownView;
            const content = editor.getValue();
            const newContent = updateRepetitionMetadata(content, {
              repeat: 'never',
              due_at: undefined,
              hidden: undefined,
            });
            this.app.vault.modify(file, newContent);
          }
          return true;
        }
        return false;
      }
    });
  }

  async onload() {
    await this.loadSettings();
    this.makeRepeatRibbonIcon();
    this.manageStatusBarItem();
    this.registerCommands();
    this.registerView(
      REPEATING_NOTES_DUE_VIEW,
      (leaf) => new RepeatView(leaf, this.settings),
      );
    this.addSettingTab(new RepeatPluginSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(REPEATING_NOTES_DUE_VIEW);
  }
}

class RepeatPluginSettingTab extends PluginSettingTab {
  plugin: RepeatPlugin;

  constructor(app: App, plugin: RepeatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl('h2', { text: 'Repeat Plugin Settings' });

    new Setting(containerEl)
      .setName('Show due count in status bar')
      .setDesc('Whether to display how many notes are due in Obsidian\'s status bar.')
      .addToggle(component => component
        .setValue(this.plugin.settings.showDueCountInStatusBar)
        .onChange(async (value) => {
          this.plugin.settings.showDueCountInStatusBar = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
        .setName('Ignore folder path')
        .setDesc('Notes in this folder and its subfolders will not become due. Useful to avoid reviewing templates.')
        .addText((component) => component
          .setValue(this.plugin.settings.ignoreFolderPath)
          .onChange(async (value) => {
            const trimmedValue = value.trim();
            this.plugin.settings.ignoreFolderPath = trimmedValue;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
        .setName('Morning review time')
        .setDesc('When morning and long-term notes become due in the morning.')
        .addText((component) => {
          component.inputEl.type = 'time';
          component.inputEl.addClass('repeat-date_picker');
          component.setValue(this.plugin.settings.morningReviewTime);
          component.onChange(async (value) => {
            const usedValue = value >= '12:00' ? '11:59' : value;
            this.plugin.settings.morningReviewTime = usedValue;
            component.setValue(usedValue);
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName('Evening review time')
        .setDesc('When evening notes become due in the afternoon.')
        .addText((component) => {
          component.inputEl.type = 'time';
          component.inputEl.addClass('repeat-date_picker');
          component.setValue(this.plugin.settings.eveningReviewTime);
          component.onChange(async (value) => {
            const usedValue = value < '12:00' ? '12:00' : value;
            this.plugin.settings.eveningReviewTime = usedValue;
            component.setValue(usedValue);
            await this.plugin.saveSettings();
          });
        });

      new Setting(containerEl)
        .setName('Default `repeat` property')
        .setDesc('Used to populate "Repeat this note..." command\'s modal. Ignored if the supplied value is not parsable.')
        .addText((component) => {
          return component
            .setValue(serializeRepeat(this.plugin.settings.defaultRepeat))
            .onChange(async (value) => {
              const newRepeat = parseRepeat(value);
              this.plugin.settings.defaultRepeat = newRepeat;
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName('Enqueue non-repeating notes')
        .setDesc('Add notes without a repeat field to the end of the queue. Useful to quickly make new notes repeating during reviews.')
        .addToggle(component => component
          .setValue(this.plugin.settings.enqueueNonRepeatingNotes)
          .onChange(async (value) => {
            this.plugin.settings.enqueueNonRepeatingNotes = value;
            await this.plugin.saveSettings();
          }));

    new Setting(containerEl)
      .setName('Auto-play audio in review')
      .setDesc('Automatically play the first audio file found in notes during spaced repetition review.')
      .addToggle(component => component
        .setValue(this.plugin.settings.autoPlayAudio)
        .onChange(async (value) => {
          this.plugin.settings.autoPlayAudio = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Use custom interval buttons')
      .setDesc('Enable custom interval buttons for spaced repetition instead of the default algorithm.')
      .addToggle(component => component
        .setValue(this.plugin.settings.useCustomIntervals)
        .onChange(async (value) => {
          this.plugin.settings.useCustomIntervals = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide custom interval settings
        }));

    if (this.plugin.settings.useCustomIntervals) {
      this.displayCustomIntervalSettings(containerEl);
    }

  }

  displayCustomIntervalSettings(containerEl: HTMLElement) {
    const customIntervalContainer = containerEl.createEl('div', {
      cls: 'custom-interval-container'
    });

    customIntervalContainer.createEl('h3', {
      text: 'Custom Interval Buttons'
    });

    customIntervalContainer.createEl('p', {
      text: 'Configure custom buttons for spaced repetition. Each button must have a longer interval than the previous one.',
      cls: 'setting-item-description'
    });

    // Display existing buttons
    this.plugin.settings.customIntervalButtons.forEach((button, index) => {
      this.createCustomIntervalButtonSetting(customIntervalContainer, button, index);
    });

    // Add button
    new Setting(customIntervalContainer)
      .setName('Add new button')
      .setDesc('Add a new custom interval button')
      .addButton(component => component
        .setButtonText('Add Button')
        .onClick(async () => {
          const newButton = { amount: 1, unit: 'm' as const, label: 'New', color: 'gray' as const };
          this.plugin.settings.customIntervalButtons.push(newButton);
          await this.plugin.saveSettings();
          this.display(); // Refresh to show new button
        }));
  }

  createCustomIntervalButtonSetting(container: HTMLElement, button: any, index: number) {
    const setting = new Setting(container)
      .setName(`Button ${index + 1}`)
      .setDesc(`${button.amount}${button.unit} ${button.label}`);

    // Amount input
    setting.addText(component => {
      const textComponent = component
        .setPlaceholder('Amount')
        .setValue(button.amount.toString());
      
      let timeoutId: NodeJS.Timeout;
      
      textComponent.onChange(async (value) => {
        const amount = parseInt(value);
        if (!isNaN(amount) && amount > 0) {
          button.amount = amount;
          await this.plugin.saveSettings();
          
          // Debounce the display refresh
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (this.validateCustomIntervalOrder()) {
              this.updateButtonDescription(setting, button);
            }
          }, 500);
        }
      });
      
      // Update on blur (when user finishes editing)
      textComponent.inputEl.addEventListener('blur', async () => {
        clearTimeout(timeoutId);
        if (this.validateCustomIntervalOrder()) {
          this.updateButtonDescription(setting, button);
        }
      });
      
      return textComponent;
    });

    // Unit dropdown
    setting.addDropdown(component => component
      .addOption('s', 'seconds')
      .addOption('m', 'minutes')
      .addOption('h', 'hours')
      .addOption('d', 'days')
      .setValue(button.unit)
      .onChange(async (value) => {
        button.unit = value as any;
        if (this.validateCustomIntervalOrder()) {
          await this.plugin.saveSettings();
          this.updateButtonDescription(setting, button);
        }
      }));

    // Label input
    setting.addText(component => {
      const textComponent = component
        .setPlaceholder('Label')
        .setValue(button.label);
      
      let timeoutId: NodeJS.Timeout;
      
      textComponent.onChange(async (value) => {
        button.label = value;
        await this.plugin.saveSettings();
        
        // Debounce the display refresh
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          this.updateButtonDescription(setting, button);
        }, 500);
      });
      
      // Update on blur (when user finishes editing)
      textComponent.inputEl.addEventListener('blur', async () => {
        clearTimeout(timeoutId);
        this.updateButtonDescription(setting, button);
      });
      
      return textComponent;
    });

    // Color dropdown
    setting.addDropdown(component => component
      .addOption('red', '暗红色')
      .addOption('orange', '橙色')
      .addOption('green', '绿色')
      .addOption('blue', '蓝色')
      .addOption('purple', '紫色')
      .addOption('cyan', '青色')
      .addOption('gray', '灰色')
      .setValue(button.color || 'gray')
      .onChange(async (value) => {
        button.color = value as any;
        await this.plugin.saveSettings();
        this.updateButtonDescription(setting, button);
      }));

    // Delete button
    setting.addButton(component => component
      .setButtonText('Delete')
      .setWarning()
      .onClick(async () => {
        this.plugin.settings.customIntervalButtons.splice(index, 1);
        await this.plugin.saveSettings();
        this.display(); // Refresh to remove deleted button
      }));
  }

  updateButtonDescription(setting: Setting, button: any) {
    setting.setDesc(`${button.amount}${button.unit} ${button.label} (${this.getColorDisplayName(button.color)})`);
  }

  getColorDisplayName(color: string): string {
    const colorNames: Record<string, string> = {
      'red': '暗红色',
      'orange': '橙色', 
      'green': '绿色',
      'blue': '蓝色',
      'purple': '紫色',
      'cyan': '青色',
      'gray': '灰色'
    };
    return colorNames[color] || '灰色';
  }

  validateCustomIntervalOrder(): boolean {
    const buttons = this.plugin.settings.customIntervalButtons;
    
    // Convert all intervals to seconds for comparison
    const getSecondsFromButton = (button: any) => {
      const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
      return button.amount * multipliers[button.unit];
    };

    for (let i = 1; i < buttons.length; i++) {
      const prevSeconds = getSecondsFromButton(buttons[i - 1]);
      const currentSeconds = getSecondsFromButton(buttons[i]);
      
      if (currentSeconds <= prevSeconds) {
        // Show error message
        new Notice(`Button ${i + 1} interval must be longer than Button ${i} interval`);
        return false;
      }
    }
    
    return true;
  }
}
