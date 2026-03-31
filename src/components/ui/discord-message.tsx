import { cn } from "@/lib/utils";

interface DiscordMessageProps {
  botName?: string;
  avatarUrl?: string;
  timestamp?: string;
  content?: string;
  color?: string | number; // Hex string or decimal mapped to hex
  title?: string;
  url?: string;
  description?: string;
  thumbnailUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  buttons?: { label: string; url?: string }[];
}

export function DiscordMessagePreview({
  botName = "Seisen Bot",
  avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png",
  timestamp = "Today at 2:48 PM",
  content,
  color = "#2ecc71", // Default green
  title,
  url,
  description,
  thumbnailUrl,
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
