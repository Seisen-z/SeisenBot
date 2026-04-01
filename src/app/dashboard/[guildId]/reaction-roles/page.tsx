"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Trash2Icon, PlusIcon, EyeIcon, CodeIcon, Send, ListIcon } from "lucide-react";
import { DiscordMessagePreview } from "@/components/ui/discord-message";

interface SelectOption {
  label: string;
  value: string;  // This will be the role ID
  description: string;
  emoji?: string;
}

interface SelectMenuMessage {
  guild_id: number;
  channel_id: number;
  message_id?: string;
  title: string;
  description: string[];
  color: number;
  placeholder: string;
  min_values: number;
  max_values: number;
  options: SelectOption[];
  custom_id: string;
}

export default function SelectMenuRolesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  
  // State for all messages
  const [messages, setMessages] = useState<{[messageId: string]: SelectMenuMessage}>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Current editing message
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<SelectMenuMessage>({
    guild_id: parseInt(guildId),
    channel_id: 0,
    title: "📢 Stay Updated on Scripts!",
    description: [
      "Select a game below to get instant pings whenever its script receives a new update! ⚡🎮",
      "",
      "> Only subscribe to the scripts you care about never miss a new feature, fix, or event again!"
    ],
    color: 5814783,
    placeholder: "Select a game to get pinged 📣",
    min_values: 1,
    max_values: 1,
    options: [],
    custom_id: "SelectRoles"
  });
  
  // UI State
  const [viewMode, setViewMode] = useState<"config" | "preview" | "raw">("config");
  const [channelId, setChannelId] = useState("");
  const [channelObj, setChannelObj] = useState<any>(null);
  
  // New option form
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionDescription, setNewOptionDescription] = useState("");
  const [newOptionEmoji, setNewOptionEmoji] = useState("");
  const [newRoleId, setNewRoleId] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const data = await fetchApi(`/guilds/${guildId}/select_menu_roles`);
      setMessages(data);
      
      // If there are messages, select the first one
      const messageIds = Object.keys(data);
      if (messageIds.length > 0 && !selectedMessageId) {
        setSelectedMessageId(messageIds[0]);
        setCurrentMessage(data[messageIds[0]]);
        setChannelId(String(data[messageIds[0]].channel_id || ""));
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      // Don't show error on first load since this is a new feature
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentMessage = async () => {
    if (!channelObj && !selectedMessageId) {
      toast("Please select a channel", "error");
      return;
    }

    setSaving(true);
    try {
      const messageData = {
        ...currentMessage,
        channel_id: parseInt(channelId) || currentMessage.channel_id,
      };

      if (selectedMessageId) {
        // Update existing message
        await fetchApi(`/guilds/${guildId}/select_menu_roles/${selectedMessageId}`, undefined, {
          method: "PUT",
          body: JSON.stringify(messageData),
        });
        toast("Message updated!", "success");
      } else {
        // Create new message
        const result = await fetchApi(`/guilds/${guildId}/select_menu_roles`, undefined, {
          method: "POST",
          body: JSON.stringify(messageData),
        });
        toast("Message created!", "success");
        setSelectedMessageId(result.message_id);
      }

      await loadMessages();
    } catch (err) {
      console.error("Save error:", err);
      toast("Failed to save message", "error");
    } finally {
      setSaving(false);
    }
  };

  const selectMessage = (messageId: string) => {
    setSelectedMessageId(messageId);
    setCurrentMessage(messages[messageId]);
    setChannelId(messages[messageId].channel_id.toString());
  };

  const createNewMessage = () => {
    setSelectedMessageId(null);
    setCurrentMessage({
      guild_id: parseInt(guildId),
      channel_id: 0,
      title: "Select Menu Roles",
      description: ["Choose your roles from the dropdown below!"],
      color: 5814783,
      placeholder: "Select roles...",
      min_values: 1,
      max_values: 1,
      options: [],
      custom_id: "SelectRoles"
    });
    setChannelId("");
    setChannelObj(null);
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/select_menu_roles/${messageId}`, undefined, {
        method: "DELETE",
      });
      
      // Clear selection if this was the selected message
      if (selectedMessageId === messageId) {
        setSelectedMessageId(null);
        createNewMessage();
      }
      
      await loadMessages();
      toast("Message deleted!", "success");
    } catch (err) {
      toast("Failed to delete message", "error");
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    if (!newOptionLabel.trim() || !newRoleId) {
      toast("Please enter a label and select a role", "error");
      return;
    }

    const newOption: SelectOption = {
      label: newOptionLabel.trim(),
      value: newRoleId,
      description: newOptionDescription.trim() || `Get the ${newOptionLabel} role`,
      emoji: newOptionEmoji || undefined,
    };

    setCurrentMessage(prev => ({
      ...prev,
      options: [...prev.options, newOption]
    }));

    // Clear form
    setNewOptionLabel("");
    setNewOptionDescription("");
    setNewOptionEmoji("");
    setNewRoleId("");
  };

  const removeOption = (index: number) => {
    setCurrentMessage(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index: number, field: keyof SelectOption, value: string) => {
    setCurrentMessage(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => 
        i === index ? { ...opt, [field]: value } : opt
      )
    }));
  };

  const generateRawJSON = () => {
    return {
      content: null,
      embeds: [{
        title: currentMessage.title,
        description: currentMessage.description,
        color: currentMessage.color,
        fields: []
      }],
      components: currentMessage.options.length > 0 ? [{
        type: 1,
        components: [{
          type: 3,
          custom_id: currentMessage.custom_id,
          options: currentMessage.options.map(opt => ({
            label: opt.label,
            value: opt.value,
            description: opt.description,
            emoji: opt.emoji,
            default: false
          })),
          placeholder: currentMessage.placeholder,
          min_values: currentMessage.min_values,
          max_values: currentMessage.max_values
        }]
      }] : []
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-discord-text-muted">Loading select menu roles...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Select Menu Roles</h1>
        <Button onClick={saveCurrentMessage} disabled={saving}>
          {saving ? "Saving..." : "Save Config"}
        </Button>
      </div>

      <div className="flex gap-6">
        <div className="w-60 shrink-0 flex flex-col gap-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-3 h-fit">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-discord-text-muted uppercase tracking-wider">Messages</span>
            <button
              title="New Message"
              onClick={createNewMessage}
              className="flex items-center gap-1 text-xs text-discord-text-muted hover:text-white bg-[#1E1F22] hover:bg-discord-blurple rounded-md px-2 py-1 transition"
            >
              <PlusIcon className="w-3 h-3" /> Message
            </button>
          </div>

          {Object.entries(messages).map(([messageId, message]) => (
            <div key={messageId} className="flex items-center group/item">
              <button
                onClick={() => selectMessage(messageId)}
                className={`flex-1 text-left text-sm px-2 py-1.5 rounded-md transition-colors truncate ${
                  selectedMessageId === messageId
                    ? "bg-discord-blurple text-white font-medium"
                    : "text-discord-text hover:bg-[#383A40]"
                }`}
              >
                {message.title || "Untitled Message"}
              </button>
              <button
                onClick={() => deleteMessage(messageId)}
                className="opacity-0 group-hover/item:opacity-100 ml-1 text-red-400 hover:text-red-300 shrink-0 p-0.5 rounded"
                title="Delete message"
              >
                <Trash2Icon className="w-3 h-3" />
              </button>
            </div>
          ))}

          {Object.keys(messages).length === 0 && (
            <div className="text-center py-8 text-discord-text-muted opacity-70">
              <ListIcon className="w-8 h-8 mx-auto mb-2" />
              <p className="text-xs">No messages yet.</p>
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex-1 rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6 relative h-full">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-xs text-discord-text-muted">Configuration</p>
                  <h2 className="text-xl font-bold text-white">{currentMessage.title || "New Message"}</h2>
                </div>
                <Button variant="discord" onClick={saveCurrentMessage} disabled={saving} size="sm">
                  <Send className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : selectedMessageId ? "Update Message" : "Send Message"}
                </Button>
              </div>

              <div className="flex border-b border-[#1E1F22] rounded-t-xl overflow-hidden bg-[#1E1F22]">
                {[
                  { key: "config", label: "VISUAL" },
                  { key: "raw", label: "RAW" },
                  { key: "preview", label: "PREVIEW" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setViewMode(tab.key as "config" | "preview" | "raw")}
                    className={`flex-1 py-3 text-[13px] tracking-wide font-bold uppercase transition ${
                      viewMode === tab.key
                        ? "bg-[#2B2D31] text-discord-blurple border-t-2 border-discord-blurple shadow-sm"
                        : "bg-[#2B2D31] hover:bg-[#313338] text-discord-text-muted border-t-2 border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-[#2B2D31] rounded-b-xl border border-t-0 border-[#1E1F22] p-6 shadow-sm min-h-[450px]">
                {viewMode === "config" && (
                  <div className="flex flex-col gap-5">
                    <div className="rounded-xl border border-[#1E1F22] bg-[#313338] p-5">
                      <h3 className="text-lg font-bold text-white mb-4">Message Settings</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Title</label>
                          <Input
                            value={currentMessage.title}
                            onChange={(e) => setCurrentMessage(prev => ({ ...prev, title: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Embed Color</label>
                          <Input
                            type="number"
                            value={currentMessage.color}
                            onChange={(e) => setCurrentMessage(prev => ({ ...prev, color: parseInt(e.target.value) || 0 }))}
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-discord-text-muted">Description</label>
                        <Textarea
                          className="h-32 font-mono text-sm"
                          value={currentMessage.description.join("\n")}
                          onChange={(e) => setCurrentMessage(prev => ({ ...prev, description: e.target.value.split("\n") }))}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-discord-text-muted">Target Channel</label>
                        <ChannelSelect
                          guildId={guildId}
                          value={channelId}
                          onChange={setChannelId}
                          onChannelSelect={setChannelObj}
                          placeholder="Select channel..."
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#1E1F22] bg-[#313338] p-5">
                      <h3 className="text-lg font-bold text-white mb-4">Dropdown Configuration</h3>
                      <div className="grid grid-cols-3 gap-4 mb-5">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Placeholder</label>
                          <Input
                            value={currentMessage.placeholder}
                            onChange={(e) => setCurrentMessage(prev => ({ ...prev, placeholder: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Min Select</label>
                          <Input
                            type="number"
                            min="0"
                            max="25"
                            value={currentMessage.min_values}
                            onChange={(e) => setCurrentMessage(prev => ({ ...prev, min_values: parseInt(e.target.value) || 1 }))}
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-discord-text-muted">Max Select</label>
                          <Input
                            type="number"
                            min="1"
                            max="25"
                            value={currentMessage.max_values}
                            onChange={(e) => setCurrentMessage(prev => ({ ...prev, max_values: parseInt(e.target.value) || 1 }))}
                          />
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-discord-text-muted">Options ({currentMessage.options.length}/25)</label>
                        <div className="space-y-2">
                          {currentMessage.options.map((option, index) => (
                            <div key={index} className="rounded-lg border border-[#1E1F22] bg-[#2B2D31] p-3">
                              <div className="grid grid-cols-4 gap-2">
                                <Input value={option.label} onChange={(e) => updateOption(index, "label", e.target.value)} placeholder="Label" />
                                <Input value={option.description} onChange={(e) => updateOption(index, "description", e.target.value)} placeholder="Description" />
                                <Input value={option.emoji || ""} onChange={(e) => updateOption(index, "emoji", e.target.value)} placeholder="Emoji" />
                                <div className="flex items-center justify-between rounded-md bg-[#1E1F22] px-3 py-2 text-xs text-discord-text-muted">
                                  <span className="truncate">Role: {option.value}</span>
                                  <button onClick={() => removeOption(index)} className="ml-2 text-red-400 hover:text-red-300" title="Remove option">
                                    <Trash2Icon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {currentMessage.options.length < 25 && (
                        <div className="rounded-lg border border-[#1E1F22] bg-[#2B2D31] p-4">
                          <h4 className="text-sm font-semibold text-white mb-3">Add Option</h4>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            <Input value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} placeholder="Option Label" />
                            <Input value={newOptionDescription} onChange={(e) => setNewOptionDescription(e.target.value)} placeholder="Description" />
                            <Input value={newOptionEmoji} onChange={(e) => setNewOptionEmoji(e.target.value)} placeholder="Emoji" />
                            <RoleSelect guildId={guildId} value={newRoleId} onChange={setNewRoleId} placeholder="Select role..." />
                          </div>
                          <Button onClick={addOption} size="sm">
                            <PlusIcon className="w-4 h-4 mr-2" />
                            Add Option
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {viewMode === "preview" && (
                  <div className="flex justify-center items-start bg-[#313338] p-8 rounded border border-[#1E1F22] shadow-inner min-h-[400px]">
                    <div className="w-full max-w-[500px]">
                      <DiscordMessagePreview
                        message={generateRawJSON()}
                        botUser={{
                          username: "Seisen Hub",
                          avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
                          discriminator: "0000",
                        }}
                      />
                    </div>
                  </div>
                )}

                {viewMode === "raw" && (
                  <div className="flex flex-col h-full space-y-3">
                    <div>
                      <h4 className="text-white text-md font-bold">Raw JSON Source</h4>
                    </div>
                    <Textarea
                      className="flex-1 font-mono text-[13px] bg-[#1E1F22] border-[#111214] min-h-[400px] leading-relaxed text-[#DBDEE1]"
                      value={JSON.stringify(generateRawJSON(), null, 2)}
                      readOnly
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
