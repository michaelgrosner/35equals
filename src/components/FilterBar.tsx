import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { useParserWorker } from "@/worker/useParserWorker";
import { useMessagesStore } from "@/state/messages";
import { AdvancedFilterPanel } from "./AdvancedFilterPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FilterTree } from "@/parser/filter/types";

export function FilterBar() {
  const [globalRegex, setGlobalRegex] = useState("");
  const [tree, setTree] = useState<FilterTree | null>(null);
  const [combineWithSearch, setCombineWithSearch] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { filter } = useParserWorker();
  const { messages, filteredIndices } = useMessagesStore();
  
  const applyFilter = useCallback(() => {
    if (!messages.length) return;
    const finalTree = combineWithSearch ? tree : null;
    const finalRegex = combineWithSearch ? globalRegex : (tree ? undefined : globalRegex);
    
    filter(finalTree, finalRegex);
  }, [tree, globalRegex, combineWithSearch, messages.length, filter]);

  // '/' focuses the search input from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const tag = (e.target as Element).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Debounce filter application
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilter();
    }, 150);
    return () => clearTimeout(timer);
  }, [applyFilter]);

  const activeRuleCount = tree ? countRules(tree) : 0;
  
  const matchCount = filteredIndices ? filteredIndices.length : messages.length;

  return (
    <div className="flex flex-col border-b border-border bg-muted/20">
      <div className="flex h-10 shrink-0 items-center px-2 gap-2">
        <div className="relative flex-1 flex items-center max-w-md">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search raw FIX (e.g. 35=D|35=8 or AAPL)"
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={globalRegex}
            onChange={(e) => setGlobalRegex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setGlobalRegex('');
                inputRef.current?.blur();
                document.getElementById('grid-scroll')?.focus();
              }
            }}
          />
          {globalRegex && (
            <button
              onClick={() => setGlobalRegex("")}
              className="absolute right-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-1.5 relative"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>Advanced</span>
          {activeRuleCount > 0 && (
            <Badge variant="secondary" className="px-1 py-0 ml-1 text-[10px] h-4 min-w-4 flex items-center justify-center">
              {activeRuleCount}
            </Badge>
          )}
        </Button>
        
        <div className="ml-auto text-xs text-muted-foreground px-2">
          {matchCount.toLocaleString()} / {messages.length.toLocaleString()} matches
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t bg-background">
          <AdvancedFilterPanel 
            tree={tree}
            onChangeTree={setTree}
            combineWithSearch={combineWithSearch}
            onChangeCombine={setCombineWithSearch}
            activeRuleCount={activeRuleCount}
          />
        </div>
      )}
    </div>
  );
}

function countRules(node: FilterTree): number {
  if (node.kind === "rule") return 1;
  return node.children.reduce((acc, child) => acc + countRules(child), 0);
}
