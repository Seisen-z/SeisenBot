"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Trash2Icon, PlusIcon, EditIcon, SparklesIcon, EyeIcon, CodeIcon, Settings, Send, ListIcon } from "lucide-react";
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
        fields: null
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
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 bg-discord-secondary border-r border-discord-tertiary flex flex-col">
        <div className="p-4 border-b border-discord-tertiary">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Select Menu Roles</h2>
            <Button onClick={createNewMessage} size="sm">
              <PlusIcon className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Message List */}
          <div className="space-y-2">
            {Object.entries(messages).map(([messageId, message]) => (
              <div
                key={messageId}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  selectedMessageId === messageId 
                    ? "bg-discord-primary text-white" 
                    : "bg-discord-tertiary hover:bg-discord-darkest text-discord-text"
                }`}
                onClick={() => selectMessage(messageId)}
              >
                <div className="font-medium text-sm truncate">{message.title}</div>
                <div className="text-xs text-discord-text-muted mt-1">
                  {message.options.length} options • #{message.channel_id}
                </div>
              </div>
            ))}
            
            {Object.keys(messages).length === 0 && (
              <div className="text-center py-8 text-discord-text-muted">
                <ListIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 space-y-2">
          <Button 
            onClick={saveCurrentMessage} 
            disabled={saving}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : selectedMessageId ? "Update Message" : "Send Message"}
          </Button>
          
          {selectedMessageId && (
            <Button 
              onClick={() => deleteMessage(selectedMessageId)} 
              variant="destructive"
              size="sm"
              className="w-full"
            >
              <Trash2Icon className="w-4 h-4 mr-2" />
              Delete Message
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* View Mode Tabs */}
        <div className="border-b border-discord-tertiary bg-discord-secondary">
          <div className="flex">
            <button
              onClick={() => setViewMode("config")}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === "config"
                  ? "border-discord-primary text-white bg-discord-tertiary"
                  : "border-transparent text-discord-text-muted hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              Configure
            </button>
            <button
              onClick={() => setViewMode("preview")}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === "preview"
                  ? "border-discord-primary text-white bg-discord-tertiary"
                  : "border-transparent text-discord-text-muted hover:text-white"
              }`}
            >
              <EyeIcon className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setViewMode("raw")}
              className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === "raw"
                  ? "border-discord-primary text-white bg-discord-tertiary"
                  : "border-transparent text-discord-text-muted hover:text-white"
              }`}
            >
              <CodeIcon className="w-4 h-4" />
              Raw JSON
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === "config" && (
            <div className="max-w-4xl space-y-6">
              {/* Basic Settings */}
              <div className="bg-discord-secondary rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Message Settings</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Title</label>
                    <Input
                      value={currentMessage.title}
                      onChange={(e) => setCurrentMessage(prev => ({...prev, title: e.target.value}))}
                      placeholder="Message title..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Embed Color</label>
                    <Input
                      type="number"
                      value={currentMessage.color}
                      onChange={(e) => setCurrentMessage(prev => ({...prev, color: parseInt(e.target.value) || 0}))}
                      placeholder="5814783"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-discord-text mb-2">Description (one line per array item)</label>
                  <Textarea
                    value={currentMessage.description.join('\n')}
                    onChange={(e) => setCurrentMessage(prev => ({...prev, description: e.target.value.split('\n')}))}
                    rows={4}
                    placeholder="Line 1&#10;&#10;> Quote text"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-discord-text mb-2">Channel</label>
                  <ChannelSelect
                    guildId={guildId}
                    value={channelId}
                    onChange={setChannelId}
                    onChannelSelect={setChannelObj}
                    placeholder="Select channel to send to..."
                  />
                </div>
              </div>

              {/* Select Menu Settings */}
              <div className="bg-discord-secondary rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Dropdown Configuration</h3>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Placeholder</label>
                    <Input
                      value={currentMessage.placeholder}
                      onChange={(e) => setCurrentMessage(prev => ({...prev, placeholder: e.target.value}))}
                      placeholder="Select an option..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Min Select</label>
                    <Input
                      type="number"
                      min="0"
                      max="25"
                      value={currentMessage.min_values}
                      onChange={(e) => setCurrentMessage(prev => ({...prev, min_values: parseInt(e.target.value) || 1}))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Max Select</label>
                    <Input
                      type="number"
                      min="1"
                      max="25"
                      value={currentMessage.max_values}
                      onChange={(e) => setCurrentMessage(prev => ({...prev, max_values: parseInt(e.target.value) || 1}))}
                    />
                  </div>
                </div>

                {/* Options List */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-discord-text mb-2">Options ({currentMessage.options.length}/25)</label>
                  <div className="space-y-2">
                    {currentMessage.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2 bg-discord-tertiary p-3 rounded">
                        <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                          <Input
                            value={option.label}
                            onChange={(e) => updateOption(index, 'label', e.target.value)}
                            placeholder="Label"
                            className="text-xs"
                          />
                          <Input
                            value={option.description}
                            onChange={(e) => updateOption(index, 'description', e.target.value)}
                            placeholder="Description"
                            className="text-xs"
                          />
                          <Input
                            value={option.emoji || ""}
                            onChange={(e) => updateOption(index, 'emoji', e.target.value)}
                            placeholder="📝 (optional)"
                            className="text-xs"
                          />
                          <div className="text-xs text-discord-text-muted truncate">
                            Role: {option.value}
                          </div>
                        </div>
                        <Button
                          onClick={() => removeOption(index)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2Icon className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Option */}
                {currentMessage.options.length < 25 && (
                  <div className="bg-discord-tertiary p-4 rounded">
                    <h4 className="text-sm font-medium text-discord-text mb-3">Add New Option</h4>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <Input
                        value={newOptionLabel}
                        onChange={(e) => setNewOptionLabel(e.target.value)}
                        placeholder="Option Label"
                        className="text-sm"
                      />
                      <Input
                        value={newOptionDescription}
                        onChange={(e) => setNewOptionDescription(e.target.value)}
                        placeholder="Description"
                        className="text-sm"
                      />
                      <Input
                        value={newOptionEmoji}
                        onChange={(e) => setNewOptionEmoji(e.target.value)}
                        placeholder="📝 Emoji"
                        className="text-sm"
                      />
                      <RoleSelect
                        guildId={guildId}
                        value={newRoleId}
                        onChange={setNewRoleId}
                        placeholder="Select role..."
                        className="text-sm"
                      />
                    </div>
                    <Button onClick={addOption} size="sm" className="w-full">
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {viewMode === "preview" && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">Message Preview</h3>
              <DiscordMessagePreview 
                message={generateRawJSON()}
                botUser={{
                  username: "Seisen Hub",
                  avatar: "/bot-avatar.png",
                  discriminator: "0000"
                }}
              />
            </div>
          )}

          {viewMode === "raw" && (
            <div className="max-w-4xl">
              <h3 className="text-lg font-semibold text-white mb-4">Raw JSON</h3>
              <div className="bg-discord-tertiary rounded-lg p-4">
                <pre className="text-sm text-discord-text overflow-auto">
                  {JSON.stringify(generateRawJSON(), null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}