import { cn } from "@/lib/utils";

interface DiscordMessageProps {
  botName?: string;
  avatarUrl?: string;
  timestamp?: string;
  content?: string;
  color?: string | number; // Hex string or decimal mapped to hex
  title?: string;
  url?: string;
  authorName?: string;
  authorUrl?: string;
  authorIcon?: string;
  description?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  buttons?: { label: string; url?: string }[];
}

interface DiscordMessage {
  content?: string | null;
  embeds?: Array<{
    title?: string;
    description?: string | string[];
    color?: number;
    author?: {
      name?: string;
      url?: string;
      icon_url?: string;
    };
    thumbnail?: {
      url?: string;
    };
    image?: {
      url?: string;
    };
    footer?: {
      text?: string;
      icon_url?: string;
    };
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>;
  components?: Array<{
    type: number;
    components: Array<{
      type: number;
      custom_id?: string;
      options?: Array<{
        label: string;
        value: string;
        description?: string;
        emoji?: string;
        default?: boolean;
      }>;
      placeholder?: string;
      min_values?: number;
      max_values?: number;
    }>;
  }>;
}

interface DiscordMessagePreviewProps {
  message?: DiscordMessage;
  botUser?: {
    username?: string;
    avatar?: string;
    discriminator?: string;
  };
  // Legacy props for backward compatibility
  botName?: string;
  avatarUrl?: string;
  timestamp?: string;
  content?: string;
  color?: string | number;
  title?: string;
  url?: string;
  authorName?: string;
  authorUrl?: string;
  authorIcon?: string;
  description?: string;
  thumbnailUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  buttons?: { label: string; url?: string }[];
}

export function DiscordMessagePreview(props: DiscordMessagePreviewProps) {
  // If new format is provided, use it
  if (props.message) {
    return <NewDiscordMessagePreview message={props.message} botUser={props.botUser} />;
  }
  
  // Fall back to legacy format
  return <LegacyDiscordMessagePreview {...props} />;
}

function NewDiscordMessagePreview({ 
  message, 
  botUser = { username: "Seisen Hub", avatar: "/bot-avatar.png", discriminator: "0000" }
}: { 
  message: DiscordMessage; 
  botUser?: { username?: string; avatar?: string; discriminator?: string } 
}) {
  const embed = message.embeds?.[0];
  const embedColor = embed?.color 
    ? `#${embed.color.toString(16).padStart(6, '0')}` 
    : "#2ecc71";

  return (
    <div className="flex w-full overflow-hidden text-[#E3E5E8] font-sans text-[0.9375rem] leading-[1.375rem]">
      {/* Avatar */}
      <div className="mt-1 mr-4 shrink-0">
        <img
          src={botUser.avatar || "/bot-avatar.png"}
          alt={botUser.username || "Bot"}
          className="h-10 w-10 rounded-full object-cover cursor-pointer hover:opacity-80"
          onError={(e) => (e.currentTarget.src = "https://cdn.discordapp.com/embed/avatars/0.png")}
        />
      </div>

      <div className="flex w-full flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1 text-[1rem]">
          <span className="font-medium hover:underline cursor-pointer text-white">
            {botUser.username || "Seisen Hub"}
          </span>
          <span className="flex h-[15px] items-center rounded-[3px] bg-[#5865F2] px-1 text-[0.625rem] font-medium leading-[15px] text-white">
            BOT
          </span>
          <span className="ml-1 text-[0.75rem] font-medium text-[#949BA4]">
            Today at 2:48 PM
          </span>
        </div>

        {/* Content */}
        {message.content && (
          <div className="mb-2 whitespace-pre-wrap">
            {message.content.split(' ').map((word, i) => {
              if (word.startsWith('<@&') && word.endsWith('>')) {
                return (
                  <span key={i} className="rounded bg-[#5865F2]/20 px-1 py-0.5 text-[#C9CDFB] hover:bg-[#5865F2]/40 cursor-pointer mr-1">
                    @role
                  </span>
                )
              }
              return <span key={i}>{word} </span>
            })}
          </div>
        )}

        {/* Embed */}
        {embed && (
          <div className="relative mt-1 max-w-[520px] rounded-[4px] bg-[#2B2D31] border border-[#1E1F22] overflow-hidden">
            {/* Left Color Pillar */}
            <div
              className="absolute bottom-0 left-0 top-0 w-1 rounded-l-[4px]"
              style={{ backgroundColor: embedColor }}
            />

            <div className="flex flex-col p-4 pl-5">
              <div className="flex justify-between gap-4">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  
                  {/* Author */}
                  {embed.author && (
                    <div className="flex items-center gap-2 mb-1">
                      {embed.author.icon_url && <img src={embed.author.icon_url} className="w-5 h-5 rounded-full object-cover" alt="" />}
                      {embed.author.name && (
                        <span className="text-sm font-semibold text-white">
                          {embed.author.url ? <a href={embed.author.url} target="_blank" rel="noreferrer" className="hover:underline">{embed.author.name}</a> : embed.author.name}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  {embed.title && (
                    <div className="font-semibold text-white text-[1rem]">
                      {embed.title}
                    </div>
                  )}

                  {/* Description */}
                  {embed.description && (
                    <div className="text-[0.875rem] text-[#DBDEE1] whitespace-pre-wrap break-words format-markdown">
                      {(Array.isArray(embed.description) 
                        ? embed.description.join('\n') 
                        : embed.description
                      ).split('\n').map((line, i) => {
                        // Very basic bold handling for `**bold**`
                        const boldParsed = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        });
                        return <div key={i}>{boldParsed}</div>;
                      })}
                    </div>
                  )}

                  {/* Fields */}
                  {embed.fields && embed.fields.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {embed.fields.map((field, idx) => (
                        <div key={idx}>
                          <div className="text-[0.875rem] font-medium text-white mb-1">
                            {field.name}
                          </div>
                          <div className="text-[0.875rem] text-[#DBDEE1] whitespace-pre-wrap">
                            {field.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Thumbnail */}
                {embed.thumbnail?.url && (
                  <div className="shrink-0">
                    <img
                      src={embed.thumbnail.url}
                      alt="Thumbnail"
                      className="max-h-[80px] max-w-[80px] rounded-[4px] object-cover cursor-pointer"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              {/* Large Body Image */}
              {embed.image?.url && (
                <div className="mt-4 shrink-0 rounded-[4px] overflow-hidden max-w-full">
                  <img
                    src={embed.image.url}
                    alt="Embed Image"
                    className="max-h-[300px] w-auto max-w-[400px] object-cover cursor-pointer hover:opacity-90"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}

              {/* Footer */}
              {embed.footer?.text && (
                <div className="mt-3 flex items-center gap-2 text-[0.75rem] font-medium text-[#DBDEE1]">
                  {embed.footer.icon_url && (
                    <img src={embed.footer.icon_url} alt="Footer icon" className="h-5 w-5 rounded-full" />
                  )}
                  <span>{embed.footer.text}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Components (Select Menus) */}
        {message.components && message.components.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.components.map((actionRow, rowIdx) => (
              <div key={rowIdx} className="space-y-2">
                {actionRow.components.map((component, compIdx) => {
                  if (component.type === 3) { // String Select Menu
                    return (
                      <div key={compIdx} className="relative">
                        <div className="bg-[#3C3F47] border border-[#4B4F57] rounded-md px-3 py-2.5 text-[0.875rem] text-[#B9BBBE] cursor-pointer hover:border-[#5865F2] transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-[#949BA4]">{component.placeholder || "Select an option..."}</span>
                            <svg className="w-4 h-4 ml-2 text-[#949BA4]" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        
                        {/* Show first few options as preview */}
                        {component.options && component.options.length > 0 && (
                          <div className="mt-1 text-[0.75rem] text-[#72767D] space-y-0.5">
                            {component.options.slice(0, 3).map((option, optIdx) => (
                              <div key={optIdx} className="truncate">
                                <span className="text-[#B9BBBE]">
                                  {option.emoji ? `${option.emoji} ` : ""}
                                  {option.label}
                                </span>
                                {option.description && (
                                  <span className="ml-1 text-[#72767D]">
                                    - {option.description}
                                  </span>
                                )}
                              </div>
                            ))}
                            {component.options.length > 3 && (
                              <div className="text-[#72767D] italic">
                                ...and {component.options.length - 3} more options
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LegacyDiscordMessagePreview({
  botName = "Seisen Bot",
  avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png",
  timestamp = "Today at 2:48 PM",
  content,
  color = "#2ecc71", // Default green
  authorName,
  authorUrl,
  authorIcon,
  title,
  url,
  description,
  thumbnailUrl,
  imageUrl,
  footerText,
  footerIconUrl,
  buttons,
}: DiscordMessageProps) {
  
  // Format decimal color to hex if needed
  const embedColor = typeof color === 'number' 
    ? `#${color.toString(16).padStart(6, '0')}` 
    : color;

  return (
    <div className="flex w-full overflow-hidden text-[#E3E5E8] font-sans text-[0.9375rem] leading-[1.375rem]">
      {/* Avatar */}
      <div className="mt-1 mr-4 shrink-0">
        <img
          src={avatarUrl}
          alt={botName}
          className="h-10 w-10 rounded-full cursor-pointer hover:opacity-80"
          onError={(e) => (e.currentTarget.src = "https://cdn.discordapp.com/embed/avatars/0.png")}
        />
      </div>

      {/* Message Content */}
      <div className="flex w-full flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-1 text-[1rem]">
          <span className="font-medium hover:underline cursor-pointer text-white">
            {botName}
          </span>
          <span className="flex h-[15px] items-center rounded-[3px] bg-[#5865F2] px-1 text-[0.625rem] font-medium leading-[15px] text-white">
            APP
          </span>
          <span className="ml-1 text-[0.75rem] font-medium text-[#949BA4]">
            {timestamp}
          </span>
        </div>

        {/* Outer Content (Ping / Text) */}
        {content && (
          <div className="mb-2 whitespace-pre-wrap">
            {content.split(' ').map((word, i) => {
              if (word.startsWith('<@&') && word.endsWith('>')) {
                return (
                  <span key={i} className="rounded bg-[#5865F2]/20 px-1 py-0.5 text-[#C9CDFB] hover:bg-[#5865F2]/40 cursor-pointer mr-1">
                    @role
                  </span>
                )
              }
              return <span key={i}>{word} </span>
            })}
          </div>
        )}

        {/* Embed Box (Only render if there is any embed content) */}
        {(title || description || thumbnailUrl || footerText) && (
          <div className="relative mt-1 max-w-[520px] rounded-[4px] bg-[#2B2D31] border border-[#1E1F22] overflow-hidden">
            {/* Left Color Pillar */}
            <div
              className="absolute bottom-0 left-0 top-0 w-1 rounded-l-[4px]"
              style={{ backgroundColor: embedColor }}
            />

            <div className="flex flex-col p-4 pl-5">
              <div className="flex justify-between gap-4">
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  
                  {/* Author block */}
                  {(authorName || authorIcon) && (
                    <div className="flex items-center gap-2 mb-1">
                      {authorIcon && <img src={authorIcon} className="w-5 h-5 rounded-full object-cover" alt="" />}
                      {authorName && (
                        <span className="text-sm font-semibold text-white">
                          {authorUrl ? <a href={authorUrl} target="_blank" rel="noreferrer" className="hover:underline">{authorName}</a> : authorName}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Title */}
                  {title && (
                    <div className="font-semibold text-white text-[1rem]">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="text-[#00A8FC] hover:underline cursor-pointer">
                          {title}
                        </a>
                      ) : (
                        title
                      )}
                    </div>
                  )}

                  {/* Description (Markdown-ish handling) */}
                  {description && (
                    <div className="text-[0.875rem] text-[#DBDEE1] whitespace-pre-wrap break-words format-markdown">
                      {description.split('\n').map((line, i) => {
                        // Very basic bold handling for `**bold**`
                        const boldParsed = line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
                          }
                          return part;
                        });
                        return <div key={i}>{boldParsed}</div>;
                      })}
                    </div>
                  )}
                </div>

                {/* Thumbnail */}
                {thumbnailUrl && (
                  <div className="shrink-0">
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail"
                      className="max-h-[80px] max-w-[80px] rounded-[4px] object-cover cursor-pointer"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              {/* Large Body Image */}
              {imageUrl && (
                <div className="mt-4 shrink-0 rounded-[4px] overflow-hidden max-w-full">
                  <img
                    src={imageUrl}
                    alt="Embed Image"
                    className="max-h-[300px] w-auto max-w-[400px] object-cover cursor-pointer hover:opacity-90"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                </div>
              )}

              {/* Footer */}
              {footerText && (
                <div className="mt-3 flex items-center gap-2 text-[0.75rem] font-medium text-[#DBDEE1]">
                  {footerIconUrl && (
                    <img src={footerIconUrl} alt="Footer icon" className="h-5 w-5 rounded-full" />
                  )}
                  <span>{footerText}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buttons (Message Components) */}
        {buttons && buttons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {buttons.map((btn, idx) => (
              <a 
                key={idx}
                href={btn.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center rounded-[3px] bg-[#4E5058] hover:bg-[#6D6F78] px-4 py-1.5 text-[0.875rem] font-medium text-white no-underline transition-colors"
              >
                {btn.label || "Button"}
                <svg className="ml-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 5V3H5.375C4.062 3 3 4.062 3 5.375V18.625C3 19.938 4.062 21 5.375 21H18.625C19.938 21 21 19.938 21 18.625V14H19V18.625C19 18.832 18.832 19 18.625 19H5.375C5.168 19 5 18.832 5 18.625V5.375C5 5.168 5.168 5 5.375 5H10ZM21 3V8.875L18.414 6.289L11.75 12.953L9.625 10.828L16.289 4.164L13.703 1.578H21ZM21 3H16.125Z"/></svg>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
