"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { Trash2Icon, PlusIcon } from "lucide-react";

export default function AIHelpPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelObj, setNewChannelObj] = useState<any>(null);

  useEffect(() => {
    fetchApi("/ai_help")
      .then((data) => setConfig(data || {}))
      .catch((err) => toast("Failed to load AI Help Config", "error"));
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi("/ai_help", undefined, {
        method: "PUT",
        body: JSON.stringify(config),
      });
      toast("AI Help Config Saved!");
    } catch (e) {
      toast("Failed to save AI configuration.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!config) return <div className="text-white">Loading...</div>;

  const guildConfig = config.guilds?.[guildId] || { enabled: false, targets: [], system_instructions: "" };

  const updateGuildConfig = (key: string, val: any) => {
    const newConfig = { ...config };
    if (!newConfig.guilds) newConfig.guilds = {};
    if (!newConfig.guilds[guildId]) newConfig.guilds[guildId] = { ...guildConfig };
    newConfig.guilds[guildId][key] = val;
    setConfig(newConfig);
  };

  const addTargetChannel = () => {
    if (!newChannelObj) return;
    const currentTargets = [...(guildConfig.targets || [])];
    if (currentTargets.some((t: any) => String(t.id) === String(newChannelObj.id))) {
      toast("Channel already added.", "error");
      return;
    }
    
    currentTargets.push({
      id: newChannelObj.id,
      name: newChannelObj.name,
      is_category: newChannelObj.type === 4
    });
    
    updateGuildConfig("targets", currentTargets);
    setNewChannelId("");
    setNewChannelObj(null);
  };

  const removeTargetChannel = (targetId: string) => {
    const currentTargets = [...(guildConfig.targets || [])];
    const newTargets = currentTargets.filter(t => String(t.id) !== String(targetId));
    updateGuildConfig("targets", newTargets);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">AI Help Assistant</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm font-bold text-white uppercase tracking-wider">Global AI Switch:</label>
          <input 
            type="checkbox" 
            checked={config.global_enabled} 
            onChange={e => setConfig({...config, global_enabled: e.target.checked})} 
            className="h-5 w-5 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple focus:ring-2 focus:ring-discord-blurple"
          />
          <span className="text-xs text-discord-text-muted">Master switch to entirely disable AI bot-wide.</span>
        </div>

        <hr className="border-[#1E1F22] my-4" />

        <h2 className="text-xl font-bold text-white">Global Settings</h2>
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-discord-text-muted">OpenRouter Default Model</label>
          <Input 
            placeholder="e.g. nvidia/nemotron-3-super-120b-a12b:free (leave blank to let bot.py decide fallback defaults)"
            value={config.default_model || ""}
            onChange={(e) => setConfig({ ...config, default_model: e.target.value })}
          />
        </div>

        <hr className="border-[#1E1F22] my-4" />

        <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Guild AI Settings</h2>
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-discord-text-muted">Enable on this server:</span>
                <input 
                type="checkbox" 
                checked={guildConfig.enabled} 
                onChange={e => updateGuildConfig("enabled", e.target.checked)} 
                className="h-5 w-5 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple focus:ring-2 focus:ring-discord-blurple"
                />
            </div>
        </div>
        
        <div className="mt-6 flex flex-col md:flex-row gap-8 items-start border border-[#1E1F22] rounded p-4 bg-discord-darkest/50">
            <div className="w-full md:w-1/2">
                <h4 className="text-sm font-bold text-white mb-2">Monitored Support Channels</h4>
                <p className="text-xs text-discord-text-muted mb-4">The AI will seamlessly reply to any messages sent inside these channels or categories.</p>
                
                <div className="flex flex-col gap-2 mb-4">
                    {(guildConfig.targets || []).map((t: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-[#2B2D31] p-2 rounded border border-[#1E1F22]">
                            <span className="text-sm text-discord-text font-medium flex items-center gap-2">
                                <span className="opacity-50 text-xs font-mono">[{t.is_category ? 'CAT' : 'TXT'}]</span>
                                {t.name}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => removeTargetChannel(t.id)}>
                                <Trash2Icon className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                    {(guildConfig.targets?.length || 0) === 0 && (
                        <div className="text-xs text-discord-text-muted italic py-2">No channels monitored.</div>
                    )}
                </div>

                <div className="flex gap-2">
                    <div className="flex-1">
                        <ChannelSelect
                            guildId={guildId}
                            value={newChannelId}
                            onChange={setNewChannelId}
                            onChannelSelect={setNewChannelObj}
                            placeholder="Select channel or category..."
                            includeCategories={true}
                            types={[0, 4, 15]} // Text, Category, Forum
                        />
                    </div>
                    <Button variant="discord" onClick={addTargetChannel} disabled={!newChannelObj}>
                        <PlusIcon className="w-4 h-4 mr-1"/> Add
                    </Button>
                </div>
            </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold text-white">
            System Instructions (Knowledge Base)
          </label>
          <span className="text-xs text-discord-text-muted font-normal block mb-2">Configure what knowledge the AI draws from. Paste the rule context, specific executor lists, Premium pricing structures, and game statuses here.</span>
          <Textarea 
            className="h-96 w-full p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap rounded-xl"
            value={guildConfig.system_instructions || ""}
            onChange={(e) => updateGuildConfig("system_instructions", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
