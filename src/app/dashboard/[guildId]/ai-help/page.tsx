"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { Trash2Icon, PlusIcon, CheckIcon, SparklesIcon } from "lucide-react";

interface AIModel {
  id: string;
  name: string;
  recommended: boolean;
}

export default function AIHelpPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [saving, setSaving] = useState(false);
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelObj, setNewChannelObj] = useState<any>(null);

  useEffect(() => {
    console.log("[AI Help] Component mounted, loading config...");
    // Load AI config
    fetchApi("/ai_help")
      .then((data) => {
        console.log("[AI Help] Config loaded:", data);
        setConfig(data || {});
      })
      .catch((err) => toast("Failed to load AI Help Config", "error"));
    
    // Load available models
    fetchApi("/ai_help/models")
      .then((data) => {
        console.log("[AI Help] Models loaded:", data?.models);
        setAvailableModels(data?.models || []);
      })
      .catch((err) => console.error("Failed to load models", err));
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

  const toggleModel = (modelId: string) => {
    const currentModels = guildConfig.models || [];
    const isSelected = currentModels.includes(modelId);
    
    if (isSelected) {
      // Remove model
      updateGuildConfig("models", currentModels.filter((m: string) => m !== modelId));
    } else {
      // Add model
      updateGuildConfig("models", [...currentModels, modelId]);
    }
  };

  const isModelSelected = (modelId: string) => {
    const currentModels = guildConfig.models || [];
    return currentModels.includes(modelId);
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
            placeholder="e.g. qwen/qwen3.6-plus-preview:free"
            value={config.default_model || ""}
            onChange={(e) => setConfig({ ...config, default_model: e.target.value })}
          />
          <p className="mt-1 text-xs text-discord-text-muted">
            This is the primary model used globally. Leave blank to use bot defaults.
          </p>
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

            <div className="w-full md:w-1/2">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4 text-yellow-400" />
                  AI Models (Multi-Select)
                </h4>
                <p className="text-xs text-discord-text-muted mb-4">
                  Select multiple models to use as fallbacks. The bot will try them in order until one succeeds.
                </p>
                
                <div className="flex flex-col gap-2">
                    {availableModels.length > 0 ? (
                      availableModels.map((model) => {
                        const selected = isModelSelected(model.id);
                        return (
                          <button
                            key={model.id}
                            onClick={() => toggleModel(model.id)}
                            className={`flex items-center justify-between p-3 rounded border transition-all ${
                              selected 
                                ? 'bg-discord-blurple/20 border-discord-blurple text-white' 
                                : 'bg-[#2B2D31] border-[#1E1F22] text-discord-text hover:border-discord-blurple/50'
                            }`}
                          >
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-sm font-medium flex items-center gap-2">
                                {model.name}
                                {model.recommended && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    Recommended
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-discord-text-muted font-mono">{model.id}</span>
                            </div>
                            {selected && (
                              <div className="flex items-center justify-center w-5 h-5 rounded bg-discord-blurple">
                                <CheckIcon className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-xs text-discord-text-muted italic py-2">Loading models...</div>
                    )}
                </div>
                
                {(guildConfig.models?.length || 0) > 0 && (
                  <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400">
                    ✓ {guildConfig.models.length} model{guildConfig.models.length > 1 ? 's' : ''} selected
                  </div>
                )}
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
