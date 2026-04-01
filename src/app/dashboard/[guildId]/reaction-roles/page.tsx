"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Trash2Icon, PlusIcon, EditIcon, SparklesIcon } from "lucide-react";

interface ReactionRoleMessage {
  guild_id: number;
  channel_id: number;
  title: string;
  description: string;
  roles: {
    [emoji: string]: {
      role_id: number;
      label: string;
    };
  };
}

export default function ReactionRolesPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  
  const [messages, setMessages] = useState<{[messageId: string]: ReactionRoleMessage}>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  
  // New message form
  const [newTitle, setNewTitle] = useState("Reaction Roles");
  const [newDescription, setNewDescription] = useState("Select a role below by reacting with the corresponding emoji!");
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelObj, setNewChannelObj] = useState<any>(null);
  
  // Editing form
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRoles, setEditRoles] = useState<{[emoji: string]: {role_id: number, label: string}}>({});
  
  // New role form
  const [newEmoji, setNewEmoji] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleObj, setNewRoleObj] = useState<any>(null);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      const data = await fetchApi(`/guilds/${guildId}/reaction_roles`);
      setMessages(data);
    } catch (err) {
      toast("Failed to load reaction role messages", "error");
    } finally {
      setLoading(false);
    }
  };

  const createMessage = async () => {
    if (!newChannelObj) {
      toast("Please select a channel", "error");
      return;
    }

    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/reaction_roles`, undefined, {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          channel_id: newChannelId,
        }),
      });

      toast("Reaction role message created!", "success");
      setNewTitle("Reaction Roles");
      setNewDescription("Select a role below by reacting with the corresponding emoji!");
      setNewChannelId("");
      setNewChannelObj(null);
      await loadMessages();
    } catch (err) {
      toast("Failed to create message", "error");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (messageId: string) => {
    const message = messages[messageId];
    setEditingMessage(messageId);
    setEditTitle(message.title);
    setEditDescription(message.description);
    setEditRoles({...message.roles});
  };

  const saveMessage = async () => {
    if (!editingMessage) return;

    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/reaction_roles/${editingMessage}`, undefined, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          roles: editRoles,
        }),
      });

      toast("Message updated!", "success");
      setEditingMessage(null);
      await loadMessages();
    } catch (err) {
      toast("Failed to update message", "error");
    } finally {
      setSaving(false);
    }
  };

  const addRole = () => {
    if (!newEmoji || !newRoleId) {
      toast("Please enter an emoji and select a role", "error");
      return;
    }

    const roleInfo = {
      role_id: parseInt(newRoleId),
      label: newLabel || `Role ${newRoleId}`,
    };

    setEditRoles(prev => ({
      ...prev,
      [newEmoji]: roleInfo
    }));

    setNewEmoji("");
    setNewRoleId("");
    setNewRoleObj(null);
    setNewLabel("");
  };

  const removeRole = (emoji: string) => {
    setEditRoles(prev => {
      const updated = {...prev};
      delete updated[emoji];
      return updated;
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this reaction role message?")) return;

    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/reaction_roles/${messageId}`, undefined, {
        method: "DELETE",
      });

      toast("Message deleted!", "success");
      await loadMessages();
    } catch (err) {
      toast("Failed to delete message", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-discord-text-muted">Loading reaction roles...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reaction Roles</h1>
        <p className="text-discord-text-muted mt-2">
          Create interactive messages where users can react with emojis to get roles automatically.
        </p>
      </div>

      {/* Create New Message */}
      <div className="bg-discord-secondary rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5" />
          Create New Reaction Role Message
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-discord-text mb-2">Title</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Reaction Roles"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-discord-text mb-2">Description</label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Select a role below by reacting with the corresponding emoji!"
              rows={3}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-discord-text mb-2">Channel</label>
            <ChannelSelect
              guildId={guildId}
              value={newChannelId}
              onChange={setNewChannelId}
              onChannelSelect={setNewChannelObj}
              placeholder="Select a channel..."
              className="w-full"
            />
          </div>

          <Button
            onClick={createMessage}
            disabled={saving || !newChannelObj}
            className="w-full"
          >
            {saving ? "Creating..." : "Create Message"}
          </Button>
        </div>
      </div>

      {/* Existing Messages */}
      <div className="space-y-4">
        {Object.entries(messages).length === 0 ? (
          <div className="bg-discord-secondary rounded-lg p-8 text-center">
            <SparklesIcon className="w-12 h-12 text-discord-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No reaction role messages yet</h3>
            <p className="text-discord-text-muted">Create your first reaction role message to get started!</p>
          </div>
        ) : (
          Object.entries(messages).map(([messageId, message]) => (
            <div key={messageId} className="bg-discord-secondary rounded-lg p-6">
              {editingMessage === messageId ? (
                // Editing Form
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Title</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Description</label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-discord-text mb-2">Roles</label>
                    
                    {/* Existing Roles */}
                    <div className="space-y-2 mb-4">
                      {Object.entries(editRoles).map(([emoji, roleInfo]) => (
                        <div key={emoji} className="flex items-center gap-3 bg-discord-tertiary p-3 rounded">
                          <span className="text-2xl">{emoji}</span>
                          <span className="text-discord-text flex-1">{roleInfo.label}</span>
                          <Button
                            onClick={() => removeRole(emoji)}
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2Icon className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {/* Add New Role */}
                    <div className="bg-discord-tertiary p-4 rounded space-y-3">
                      <h4 className="text-sm font-medium text-discord-text">Add Role</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="📝"
                          value={newEmoji}
                          onChange={(e) => setNewEmoji(e.target.value)}
                          className="w-20"
                        />
                        <RoleSelect
                          guildId={guildId}
                          value={newRoleId}
                          onChange={(roleId) => {
                            setNewRoleId(roleId);
                            // Find the role object for the label
                            const role = roleId ? { id: roleId, name: "Role" } : null;
                            setNewRoleObj(role);
                          }}
                          placeholder="Select role..."
                          className="flex-1"
                        />
                        <Input
                          placeholder="Label (optional)"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          className="flex-1"
                        />
                        <Button onClick={addRole}>
                          <PlusIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveMessage} disabled={saving}>
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button
                      onClick={() => setEditingMessage(null)}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{message.title}</h3>
                      <p className="text-discord-text-muted text-sm">
                        Channel: <span className="text-discord-text">#{message.channel_id}</span> • 
                        Message ID: <span className="font-mono text-xs">{messageId}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startEditing(messageId)}
                        size="sm"
                        variant="secondary"
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => deleteMessage(messageId)}
                        size="sm"
                        variant="destructive"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-discord-tertiary p-4 rounded mb-4">
                    <p className="text-discord-text">{message.description}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-discord-text mb-2">
                      Roles ({Object.keys(message.roles).length})
                    </h4>
                    {Object.keys(message.roles).length === 0 ? (
                      <p className="text-discord-text-muted text-sm italic">No roles configured yet</p>
                    ) : (
                      <div className="space-y-2">
                        {Object.entries(message.roles).map(([emoji, roleInfo]) => (
                          <div key={emoji} className="flex items-center gap-3 text-sm">
                            <span className="text-lg">{emoji}</span>
                            <span className="text-discord-text">{roleInfo.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}