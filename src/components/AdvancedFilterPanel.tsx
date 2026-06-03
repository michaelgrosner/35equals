import { Filter, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { FilterTree, FilterGroup, FilterRule, FilterOperator } from "@/parser/filter/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TagInput } from "./TagInput";

interface Props {
  tree: FilterTree | null;
  onChangeTree: (tree: FilterTree | null) => void;
  combineWithSearch: boolean;
  onChangeCombine: (val: boolean) => void;
  activeRuleCount: number;
}

export function AdvancedFilterPanel({ tree, onChangeTree, combineWithSearch, onChangeCombine }: Props) {
  const defaultTree: FilterGroup = { kind: "group", combinator: "AND", children: [] };
  const currentTree = tree?.kind === "group" ? tree : (tree ? { kind: "group", combinator: "AND", children: [tree] } as FilterGroup : defaultTree);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">Advanced Query Builder</h4>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { onChangeTree(null); }}>Reset rules</Button>
      </div>
      
      <GroupEditor 
        group={currentTree} 
        onChange={(g) => { onChangeTree(g.children.length === 0 ? null : g); }}
      />
      
      <div className="flex items-center space-x-2 pt-2 border-t">
        <Checkbox 
          id="combine" 
          checked={combineWithSearch}
          onCheckedChange={(c) => { onChangeCombine(!!c); }}
        />
        <label
          htmlFor="combine"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
        >
          Combine with search box (AND)
        </label>
      </div>
    </div>
  );
}

function GroupEditor({ group, onChange }: { group: FilterGroup, onChange: (g: FilterGroup) => void }) {
  const setCombinator = (val: "AND" | "OR") => { onChange({ ...group, combinator: val }); };
  
  const updateChild = (idx: number, child: FilterTree) => {
    const newChildren = [...group.children];
    newChildren[idx] = child;
    onChange({ ...group, children: newChildren });
  };
  
  const deleteChild = (idx: number) => {
    onChange({ ...group, children: group.children.filter((_, i) => i !== idx) });
  };
  
  const addRule = () => {
    onChange({
      ...group,
      children: [...group.children, { kind: "rule", tag: 35, op: "equals", value: "" }]
    });
  };
  
  const addGroup = () => {
    onChange({
      ...group,
      children: [...group.children, { kind: "group", combinator: "AND", children: [] }]
    });
  };

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/10">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Match</span>
        <Select value={group.combinator} onValueChange={setCombinator}>
          <SelectTrigger className="h-7 w-[80px] text-xs font-bold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">ALL</SelectItem>
            <SelectItem value="OR">ANY</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">of the following:</span>
      </div>
      
      <div className="space-y-2 pl-4 border-l-2 border-primary/20">
        {group.children.map((child, idx) => (
          <div key={idx} className="relative group/item">
            {child.kind === "group" ? (
              <GroupEditor group={child} onChange={(g) => { updateChild(idx, g); }} />
            ) : (
              <RuleEditor rule={child} onChange={(r) => { updateChild(idx, r); }} />
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute -right-2 -top-2 h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity bg-background border shadow-sm hover:text-destructive"
              onClick={() => { deleteChild(idx); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRule}>
            <Plus className="h-3 w-3 mr-1" /> Add rule
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addGroup}>
            <Plus className="h-3 w-3 mr-1" /> Add group
          </Button>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange }: { rule: FilterRule, onChange: (r: FilterRule) => void }) {
  const setTag = (tag: number) => { onChange({ ...rule, tag }); };
  const setOp = (val: string) => { onChange({ ...rule, op: val as FilterOperator }); };
  const setValue = (val: string) => { onChange({ ...rule, value: val }); };

  return (
    <div className="flex items-center gap-2 bg-background border rounded p-1.5 pr-6 shadow-sm">
      <TagInput 
        value={rule.tag} 
        onChange={setTag}
        className="w-[180px]"
      />
      <Select value={rule.op} onValueChange={setOp}>
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="equals">equals</SelectItem>
          <SelectItem value="contains">contains</SelectItem>
          <SelectItem value="regex">regex</SelectItem>
          <SelectItem value=">">&gt;</SelectItem>
          <SelectItem value="<">&lt;</SelectItem>
          <SelectItem value="is set">is set</SelectItem>
          <SelectItem value="is empty">is empty</SelectItem>
        </SelectContent>
      </Select>
      {rule.op !== "is empty" && rule.op !== "is set" && (
        <Input 
          value={typeof rule.value === "string" ? rule.value : ""} 
          onChange={(e) => { setValue(e.target.value); }}
          className="h-7 flex-1 text-xs"
          placeholder="Value"
        />
      )}
    </div>
  );
}
