"use client";

import { useCallback, useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { useDebouncedAutoSave } from "@/hooks/use-debounced-auto-save";
import { 
  SmileIcon,
  SparklesIcon,
  MessageCircleIcon,
  LightbulbIcon,
  QuoteIcon,
  BrainIcon,
  FlameIcon,
  HeartIcon
} from "lucide-react";

interface FunConfig {
  eight_ball: string[];
  roasts: string[];
  compliments: string[];
  jokes: string[];
  fun_facts: string[];
  riddles: string[];
  quotes: string[];
  hello_greetings: string[];
}

const commandCategories = [
  {
    key: "eight_ball" as keyof FunConfig,
    label: "🎱 8Ball Responses",
    icon: SparklesIcon,
    description: "Custom responses for the /8ball command",
    placeholder: "Enter one response per line...\n\nExample:\n🎱 Absolutely yes!\n🎱 Maybe later...\n🎱 Don't count on it"
  },
  {
    key: "roasts" as keyof FunConfig,
    label: "🔥 Roasts",
    icon: FlameIcon,
    description: "Fun roast messages for the /roast command",
    placeholder: "Enter one roast per line...\n\nExample:\nYou're like a cloud... when you disappear, it's a beautiful day! ☁️\nI'd roast you, but my mom told me not to burn trash 🗑️"
  },
  {
    key: "compliments" as keyof FunConfig,
    label: "❤️ Compliments",
    icon: HeartIcon,
    description: "Sweet compliment messages for the /compliment command",
    placeholder: "Enter one compliment per line...\n\nExample:\nYou're absolutely amazing! ✨\nYour smile could light up the whole world! 😊"
  },
  {
    key: "jokes" as keyof FunConfig,
    label: "😄 Jokes",
    icon: SmileIcon,
    description: "Funny jokes for the /joke command",
    placeholder: "Enter one joke per line...\n\nExample:\nWhy don't scientists trust atoms? Because they make up everything! 🔬\nWhat do you call a bear with no teeth? A gummy bear! 🐻"
  },
  {
    key: "fun_facts" as keyof FunConfig,
    label: "💡 Fun Facts",
    icon: LightbulbIcon,
    description: "Interesting facts for the /funfact command",
    placeholder: "Enter one fun fact per line...\n\nExample:\nHoney never spoils! 🍯\nOctopuses have three hearts! 🐙"
  },
  {
    key: "riddles" as keyof FunConfig,
    label: "🧩 Riddles",
    icon: BrainIcon,
    description: "Brain teasers and riddles for the /riddle command",
    placeholder: "Enter one riddle per line...\n\nExample:\nWhat has keys but no locks? A keyboard! ⌨️\nWhat gets wetter the more it dries? A towel! 🧺"
  },
  {
    key: "quotes" as keyof FunConfig,
    label: "💬 Quotes",
    icon: QuoteIcon,
    description: "Inspirational quotes for the /quote command",
    placeholder: "Enter one quote per line...\n\nExample:\nThe only way to do great work is to love what you do. - Steve Jobs\nBelieve you can and you're halfway there. - Theodore Roosevelt"
  },
  {
    key: "hello_greetings" as keyof FunConfig,
    label: "👋 Hello Greetings",
    icon: MessageCircleIcon,
    description: "Greetings for the /hello command",
    placeholder: "Enter one greeting per line...\n\nExample:\nHello there! 👋\nHey! What's up? 🌟\nGreetings, friend! ✨"
  }
];

export default function FunCommandsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const { toast } = useToast();
  const [config, setConfig] = useState<FunConfig>({
    eight_ball: [],
    roasts: [],
    compliments: [],
    jokes: [],
    fun_facts: [],
    riddles: [],
    quotes: [],
    hello_greetings: []
  });
  const [activeCategory, setActiveCategory] = useState<keyof FunConfig>("eight_ball");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/fun-commands`)
      .then((data) => {
        setConfig(data || {
          eight_ball: [],
          roasts: [],
          compliments: [],
          jokes: [],
          fun_facts: [],
          riddles: [],
          quotes: [],
          hello_greetings: []
        });
      })
      .catch((err) => toast({ title: "Failed to load Fun Commands", variant: "destructive" }))
      .finally(() => setInitialLoadComplete(true));
  }, [guildId, toast]);

  const persistConfig = useCallback(async (nextConfig: FunConfig) => {
    await fetchApi(`/guilds/${guildId}/fun-commands`, undefined, {
      method: "PUT",
      body: JSON.stringify(nextConfig),
    });
    setLastSaved(new Date());
  }, [guildId]);

  useDebouncedAutoSave({
    value: config,
    enabled: initialLoadComplete,
    contextKey: guildId,
    delay: 1400,
    onSave: persistConfig,
    onError: () => toast({ title: "Auto-save failed for fun commands", variant: "destructive" }),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await persistConfig(config);
      toast({ title: "Saved Fun Commands Successfully!" });
    } catch (e) {
      toast({ title: "Failed to save fun commands.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateCategory = (text: string) => {
    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    setConfig(prev => ({
      ...prev,
      [activeCategory]: lines
    }));
  };

  const activeData = config[activeCategory] || [];
  const activeInfo = commandCategories.find(c => c.key === activeCategory);

  return (
    <div className="space-y-6 p-6">
      <DashboardPageHero
        icon={SparklesIcon}
        title="Fun Commands"
        description="Customize responses for fun interaction commands across your server"
      />

      <div className="glass-card rounded-2xl border border-white/10 bg-discord-dark/60 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Category List */}
          <div className="space-y-2">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-discord-text-muted">
              Command Categories
            </h3>
            {commandCategories.map((category) => {
              const Icon = category.icon;
              const count = config[category.key]?.length || 0;
              const isActive = activeCategory === category.key;

              return (
                <button
                  key={category.key}
                  onClick={() => setActiveCategory(category.key)}
                  className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${
                    isActive
                      ? "bg-discord-blurple/20 text-white shadow-lg shadow-discord-blurple/20"
                      : "text-discord-text-muted hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "text-discord-blurple" : "text-discord-text-muted group-hover:text-discord-blurple"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{category.label}</p>
                    <p className="text-xs text-discord-text-muted">{count} responses</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <div className="lg:col-span-3 space-y-4">
            {activeInfo && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{activeInfo.label}</h2>
                    <p className="mt-1 text-sm text-discord-text-muted">{activeInfo.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {lastSaved && (
                      <p className="text-xs text-discord-text-muted">
                        Saved {lastSaved.toLocaleTimeString()}
                      </p>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-discord-blurple hover:bg-discord-blurple/90"
                    >
                      {saving ? "Saving..." : "Save Now"}
                    </Button>
                  </div>
                </div>

                <Textarea
                  value={activeData.join("\n")}
                  onChange={(e) => updateCategory(e.target.value)}
                  placeholder={activeInfo.placeholder}
                  className="min-h-[400px] font-mono text-sm"
                />

                <div className="flex items-center gap-2 rounded-xl bg-discord-blurple/10 px-4 py-3 text-sm text-discord-text-muted border border-discord-blurple/20">
                  <SparklesIcon className="h-4 w-4 text-discord-blurple" />
                  <p>
                    <strong className="text-white">{activeData.length}</strong> custom responses configured
                    {activeData.length > 0 && " · One response per line"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
