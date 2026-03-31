"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelMultiSelect } from "@/components/ui/discord-selects";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { MessageSquareIcon, PlusIcon, Trash2Icon } from "lucide-react";

export default function AutoReplyPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/autoreply`)
      .then((data) => {
        let r = data || [];
        // Convert any legacy object targets to strings
        r = r.map((rule: any) => {
          if (rule.targets && Array.isArray(rule.targets)) {
            rule.targets = rule.targets.map((t: any) => 
              typeof t === "object" ? String(t.id) : String(t)
            );
          }
          return rule;
        });
        setRules(r);
        if (r.length > 0) setActiveIdx(0);
      })
      .catch((err) => toast("Failed to load Auto Replies", "error"));
  }, [guildId, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/autoreply`, undefined, {
        method: "PUT",
        body: JSON.stringify(rules),
      });
      toast("Saved Auto Replies Successfully!");
    } catch (e) {
      toast("Failed to save auto replies.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (field: string, value: any) => {
    const newRules = [...rules];
    newRules[activeIdx] = { ...newRules[activeIdx], [field]: value };
    setRules(newRules);
  };

  const updateButton = (btnIdx: number, field: string, value: string) => {
    const newRules = [...rules];
    if (!newRules[activeIdx].buttons) newRules[activeIdx].buttons = [];
    if (!newRules[activeIdx].buttons[btnIdx]) newRules[activeIdx].buttons[btnIdx] = { label: "", url: "" };
    newRules[activeIdx].buttons[btnIdx][field] = value;
    setRules(newRules);
  };

  const removeButton = (btnIdx: number) => {
    const newRules = [...rules];
    newRules[activeIdx].buttons.splice(btnIdx, 1);
    setRules(newRules);
  };

  const activeRule = rules[activeIdx];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Auto Reply Configuration</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 overflow-y-auto">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Rules</span>
            <button
               onClick={() => {
                setRules([...rules, { name: "", keywords: [], targets: [], buttons: [] }]);
                setActiveIdx(rules.length);
              }}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition"
            >
              <PlusIcon className="w-3 h-3" /> Add
            </button>
          </div>

          {rules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center opacity-60">
              <MessageSquareIcon className="w-8 h-8 mb-2 text-discord-text-muted" />
              <p className="text-xs text-discord-text-muted">No rules setup.<br />Click Add to begin.</p>
            </div>
          )}

          {rules.map((rule, idx) => {
            const displayName = rule.name || (rule.keywords && rule.keywords.length > 0 
                ? rule.keywords.join(", ") 
                : "Unconfigured Rule");
            
            return (
              <button
                key={idx}
                onClick={() => setActiveIdx(idx)}
                className={`flex items-center gap-2 text-left text-sm px-3 py-2 rounded-md transition-colors truncate ${
                  activeIdx === idx 
                    ? 'bg-discord-blurple text-white font-medium shadow-sm' 
                    : 'text-discord-text hover:bg-[#383A40]'
                }`}
              >
                <MessageSquareIcon className={`w-4 h-4 shrink-0 ${activeIdx === idx ? 'text-white/80' : 'text-discord-text-muted/60'}`} />
                <span className="truncate flex-1">{displayName}</span>
              </button>
            );
          })}
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 relative overflow-y-auto">
            {activeRule ? (
              <div className="flex flex-col gap-6 h-full">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-white">
                     {activeRule.name || "Rule Configuration"}
                  </h2>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-[13px] font-semibold text-discord-text-muted">Rule Custom Name</label>
                  <Input 
                    value={activeRule.name || ""} 
                    onChange={(e) => updateRule("name", e.target.value)} 
                    placeholder="e.g. Welcome Message"
                  />
                </div>

                <AdvancedEmbedEditor
                  config={{
                    content: activeRule.reply_message,
                    title: activeRule.embed_title,
                    description: activeRule.embed_description,
                    color: activeRule.embed_color,
                    thumbnail_url: activeRule.embed_thumbnail,
                    footer: activeRule.embed_footer,
                    buttons: activeRule.buttons
                  }}
                  onChange={(k, val) => {
                    if (k === 'content') updateRule('reply_message', val);
                    else if (k === 'thumbnail_url') updateRule('embed_thumbnail', val);
                    else updateRule(`embed_${k}`, val);
                  }}
                  bottomChildren={
                    <div className="border-t border-[#1E1F22] pt-6 mt-4">
                      <h4 className="mb-2 block text-sm font-bold text-white tracking-wide">URL Buttons (Max 5)</h4>
                      <p className="text-xs text-discord-text-muted mb-4">Add clickable links that appear below the auto-reply message.</p>
                      <div className="flex flex-col gap-3 max-w-2xl">
                        {(activeRule.buttons || []).map((btn: any, btnIdx: number) => (
                          <div key={btnIdx} className="flex gap-2 items-center">
                            <Input placeholder="Button Label" value={btn.label || ""} onChange={e => updateButton(btnIdx, "label", e.target.value)} />
                            <Input placeholder="URL (https://...)" value={btn.url || ""} onChange={e => updateButton(btnIdx, "url", e.target.value)} />
                            <Button variant="destructive" size="icon" onClick={() => removeButton(btnIdx)}>
                              <Trash2Icon className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(activeRule.buttons?.length || 0) < 5 && (
                          <Button variant="outline" size="sm" className="w-fit bg-[#2B2D31] text-discord-text hover:bg-discord-blurple border-[#1E1F22] hover:text-white" onClick={() => {
                            const newRules = [...rules];
                            if (!newRules[activeIdx].buttons) newRules[activeIdx].buttons = [];
                            newRules[activeIdx].buttons.push({ label: "New Button", url: "https://" });
                            setRules(newRules);
                          }}>
                            <PlusIcon className="w-4 h-4 mr-2" /> Add Button
                          </Button>
                        )}
                      </div>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-[#1E1F22] pb-6 mb-2">
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-discord-text-muted">Keywords (comma separated)</label>
                      <Input 
                        value={activeRule.keywords?.join(", ")} 
                        onChange={(e) => updateRule("keywords", e.target.value.split(",").map(k => k.trim()))} 
                        placeholder="e.g. help, support, ticket"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-discord-text-muted whitespace-nowrap">Target Channels</label>
                      <ChannelMultiSelect
                        guildId={guildId}
                        value={activeRule.targets || []}
                        onChange={(ids) => updateRule("targets", ids)}
                        placeholder="Any Channel (leave blank)"
                        includeCategories
                        types={[0, 4, 5]}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-[13px] font-semibold text-discord-text-muted whitespace-nowrap">Delete After (seconds)</label>
                      <Input 
                        type="number"
                        value={activeRule.delete_after || ""} 
                        onChange={(e) => updateRule("delete_after", parseInt(e.target.value) || null)} 
                        placeholder="Leave blank to keep"
                      />
                    </div>
                  </div>
                </AdvancedEmbedEditor>

                <div className="flex justify-end pt-2 mt-auto">
                  <Button 
                    variant="ghost" 
                    className="text-red-400 hover:bg-red-500/10 hover:text-red-300" 
                    onClick={() => {
                      const newR = rules.filter((_, i) => i !== activeIdx);
                      setRules(newR);
                      setActiveIdx(newR.length > 0 ? 0 : -1);
                    }}
                  >
                    <Trash2Icon className="w-4 h-4 mr-1.5" /> Delete Rule
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-discord-text-muted flex h-full flex-col items-center justify-center gap-3">
                <MessageSquareIcon className="w-12 h-12 opacity-20" />
                <p className="text-sm">Select a rule to edit, or create a new one.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setRules([...rules, { keywords: [], targets: [], buttons: [] }]);
                    setActiveIdx(rules.length);
                  }}
                >
                  <PlusIcon className="w-4 h-4 mr-1" /> New Rule
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
