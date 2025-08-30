import { App } from 'obsidian';
import { getAPI } from 'obsidian-dataview';

interface TagSuggestion {
  tag: string;
  count: number;
}

export class TagInputWithSuggestions {
  private app: App;
  private inputEl: HTMLInputElement;
  private dropdownEl: HTMLElement;
  private allTags: TagSuggestion[] = [];
  private filteredTags: TagSuggestion[] = [];
  private selectedIndex: number = -1;
  private isDropdownVisible: boolean = false;
  private onTagSelect: (tag: string) => void;
  private boundClickOutside: (e: Event) => void;

  constructor(
    app: App, 
    container: HTMLElement, 
    initialValue: string = '',
    onTagSelect: (tag: string) => void
  ) {
    this.app = app;
    this.onTagSelect = onTagSelect;
    
    this.createElements(container, initialValue);
    this.loadAllTags();
    this.setupEventListeners();
  }

  private createElements(container: HTMLElement, initialValue: string) {
    // Create wrapper for input and dropdown
    const wrapper = container.createDiv({ cls: 'tag-input-wrapper' });
    wrapper.style.position = 'relative';
    wrapper.style.flex = '1';

    // Create input element
    this.inputEl = wrapper.createEl('input', { 
      type: 'text', 
      placeholder: 'Enter tag name',
      value: initialValue
    });
    this.inputEl.style.width = '100%';
    this.inputEl.style.boxSizing = 'border-box';

    // Create dropdown element
    this.dropdownEl = wrapper.createDiv({ cls: 'tag-dropdown' });
    this.dropdownEl.style.position = 'absolute';
    this.dropdownEl.style.top = '100%';
    this.dropdownEl.style.left = '0';
    this.dropdownEl.style.right = '0';
    this.dropdownEl.style.backgroundColor = 'var(--background-primary)';
    this.dropdownEl.style.border = '1px solid var(--background-modifier-border)';
    this.dropdownEl.style.borderRadius = '4px';
    this.dropdownEl.style.maxHeight = '200px';
    this.dropdownEl.style.overflowY = 'auto';
    this.dropdownEl.style.zIndex = '1000';
    this.dropdownEl.style.display = 'none';
    this.dropdownEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
  }

  private async loadAllTags() {
    // Try Obsidian API first - scan all files for tags
    try {
      const files = this.app.vault.getMarkdownFiles();
      const tagCounts = new Map<string, number>();
      
      files.forEach(file => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.tags) {
          cache.tags.forEach(tagCache => {
            const tag = tagCache.tag.startsWith('#') ? tagCache.tag.slice(1) : tagCache.tag;
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          });
        }
      });
      
      if (tagCounts.size > 0) {
        this.allTags = Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count);
        return;
      }
    } catch (error) {
    }

    // Fallback to dataview
    const dv = getAPI(this.app);
    if (dv) {
      try {
        const allPages = dv.pages();
        const tagCounts = new Map<string, number>();
        
        allPages.forEach((page: any) => {
          // Extract tags from page.file.tags
          if (page.file?.tags) {
            page.file.tags.forEach((tagObj: any) => {
              const tag = tagObj.tag || tagObj;
              if (typeof tag === 'string') {
                const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
                tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
              }
            });
          }
          
          // Also check page.tags
          if (page.tags) {
            const tags = Array.isArray(page.tags) ? page.tags : [page.tags];
            tags.forEach((tag: any) => {
              const tagStr = typeof tag === 'string' ? tag : tag.toString();
              const cleanTag = tagStr.startsWith('#') ? tagStr.slice(1) : tagStr;
              tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
            });
          }
        });
        
        this.allTags = Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count);
      } catch (error) {
      }
    }

    // If still no tags found, initialize empty array
    if (this.allTags.length === 0) {
      this.allTags = [];
    }
  }

  private setupEventListeners() {
    // Focus event - show dropdown
    this.inputEl.addEventListener('focus', () => {
      this.showDropdown();
    });

    // Input event - filter tags
    this.inputEl.addEventListener('input', () => {
      this.filterTags();
      this.onTagSelect(this.inputEl.value); // Update the condition immediately
    });

    // Keydown event - handle navigation
    this.inputEl.addEventListener('keydown', (e) => {
      if (!this.isDropdownVisible) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredTags.length - 1);
          this.updateSelection();
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
          this.updateSelection();
          break;
        case 'Enter':
          e.preventDefault();
          if (this.selectedIndex >= 0) {
            this.selectTag(this.filteredTags[this.selectedIndex].tag);
          }
          break;
        case 'Escape':
          e.preventDefault();
          this.hideDropdown();
          break;
      }
    });

    // Click outside to close dropdown
    this.boundClickOutside = (e: Event) => {
      if (!this.inputEl.contains(e.target as Node) && !this.dropdownEl.contains(e.target as Node)) {
        this.hideDropdown();
      }
    };
    document.addEventListener('click', this.boundClickOutside);
  }

  private showDropdown() {
    this.filterTags();
    this.dropdownEl.style.display = 'block';
    this.isDropdownVisible = true;
  }

  private hideDropdown() {
    this.dropdownEl.style.display = 'none';
    this.isDropdownVisible = false;
    this.selectedIndex = -1;
  }

  private filterTags() {
    const query = this.inputEl.value.toLowerCase();
    this.filteredTags = this.allTags
      .filter(tag => tag.tag.toLowerCase().includes(query))
      .slice(0, 10); // Limit to 10 results
    
    this.selectedIndex = -1;
    this.renderDropdown();
  }

  private renderDropdown() {
    this.dropdownEl.empty();
    
    if (this.filteredTags.length === 0) {
      const noResultsEl = this.dropdownEl.createDiv({ cls: 'tag-dropdown-item' });
      noResultsEl.textContent = 'No tags found';
      noResultsEl.style.padding = '8px 12px';
      noResultsEl.style.color = 'var(--text-muted)';
      noResultsEl.style.fontStyle = 'italic';
      return;
    }

    this.filteredTags.forEach((tag, index) => {
      const itemEl = this.dropdownEl.createDiv({ cls: 'tag-dropdown-item' });
      itemEl.style.padding = '8px 12px';
      itemEl.style.cursor = 'pointer';
      itemEl.style.borderBottom = '1px solid var(--background-modifier-border-hover)';
      
      if (index === this.selectedIndex) {
        itemEl.style.backgroundColor = 'var(--background-modifier-hover)';
      }
      
      // Tag name
      const tagNameEl = itemEl.createSpan({ text: tag.tag });
      tagNameEl.style.fontWeight = '500';
      
      // Usage count
      const countEl = itemEl.createSpan({ text: ` (${tag.count})` });
      countEl.style.color = 'var(--text-muted)';
      countEl.style.fontSize = '0.9em';
      countEl.style.marginLeft = '4px';
      
      // Click handler
      itemEl.addEventListener('click', () => {
        this.selectTag(tag.tag);
      });

      // Hover effect
      itemEl.addEventListener('mouseenter', () => {
        this.selectedIndex = index;
        this.updateSelection();
      });
    });
  }

  private updateSelection() {
    const items = this.dropdownEl.querySelectorAll('.tag-dropdown-item');
    items.forEach((item, index) => {
      const itemEl = item as HTMLElement;
      if (index === this.selectedIndex) {
        itemEl.style.backgroundColor = 'var(--background-modifier-hover)';
      } else {
        itemEl.style.backgroundColor = '';
      }
    });
  }

  private selectTag(tag: string) {
    this.inputEl.value = tag;
    this.onTagSelect(tag);
    this.hideDropdown();
  }

  public getValue(): string {
    return this.inputEl.value;
  }

  public setValue(value: string) {
    this.inputEl.value = value;
  }

  public destroy() {
    // Clean up event listeners
    if (this.boundClickOutside) {
      document.removeEventListener('click', this.boundClickOutside);
    }
  }
}
