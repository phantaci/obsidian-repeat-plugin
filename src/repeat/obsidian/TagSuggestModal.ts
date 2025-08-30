import { App, SuggestModal } from 'obsidian';
import { getAPI } from 'obsidian-dataview';

interface TagSuggestion {
  tag: string;
  count: number;
}

export class TagSuggestModal extends SuggestModal<TagSuggestion> {
  private onSelect: (tag: string) => void;
  private allTags: TagSuggestion[] = [];

  constructor(app: App, onSelect: (tag: string) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder('Type to search tags...');
    this.loadAllTags();
  }

  private loadAllTags() {
    const dv = getAPI(this.app);
    
    if (dv) {
      // Get all pages and extract tags
      const allPages = dv.pages();
      const tagCounts = new Map<string, number>();
      
      allPages.forEach((page: any) => {
        // Extract tags from page.file.tags (array of tag objects)
        if (page.file?.tags) {
          page.file.tags.forEach((tagObj: any) => {
            const tag = tagObj.tag || tagObj; // Handle different tag object formats
            if (typeof tag === 'string') {
              const cleanTag = tag.startsWith('#') ? tag.slice(1) : tag;
              tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
            }
          });
        }
        
        // Also check page.tags if available
        if (page.tags) {
          const tags = Array.isArray(page.tags) ? page.tags : [page.tags];
          tags.forEach((tag: any) => {
            const tagStr = typeof tag === 'string' ? tag : tag.toString();
            const cleanTag = tagStr.startsWith('#') ? tagStr.slice(1) : tagStr;
            tagCounts.set(cleanTag, (tagCounts.get(cleanTag) || 0) + 1);
          });
        }
      });
      
      // Convert to array and sort by usage count (descending)
      this.allTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    } else {
      // Fallback: get tags from vault files manually
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
      
      this.allTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    }
  }

  getSuggestions(query: string): TagSuggestion[] {
    const lowerQuery = query.toLowerCase();
    
    return this.allTags
      .filter(suggestion => {
        // Filter based on query - search in tag name
        return suggestion.tag.toLowerCase().includes(lowerQuery);
      })
      .slice(0, 20); // Limit to top 20 results for performance
  }

  renderSuggestion(suggestion: TagSuggestion, el: HTMLElement) {
    const container = el.createDiv({ cls: 'tag-suggestion' });
    
    // Tag name
    const tagEl = container.createSpan({ 
      text: suggestion.tag,
      cls: 'tag-suggestion-name'
    });
    tagEl.style.fontWeight = 'bold';
    
    // Usage count
    const countEl = container.createSpan({ 
      text: ` (${suggestion.count})`,
      cls: 'tag-suggestion-count'
    });
    countEl.style.color = 'var(--text-muted)';
    countEl.style.fontSize = '0.9em';
  }

  onChooseSuggestion(suggestion: TagSuggestion, evt: MouseEvent | KeyboardEvent) {
    this.onSelect(suggestion.tag);
  }
}
