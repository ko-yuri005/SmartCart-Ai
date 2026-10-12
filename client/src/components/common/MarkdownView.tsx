import React from 'react';
import { ExternalLink } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * A lightweight, safe Markdown renderer for assistant messages.
 * Formats paragraphs, bold text, safe https:// links, bullet points, numbered lists,
 * and inline code without heavy dependencies or XSS vulnerabilities.
 */
export const MarkdownView: React.FC<MarkdownViewProps> = ({ content, className = '' }) => {
  const lines = content.split('\n');

  const renderFormattedLine = (line: string, key: number) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={key} className="text-sm font-semibold text-zinc-900 mt-2.5 mb-1">
          {formatInline(trimmed.slice(4))}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={key} className="text-base font-semibold text-zinc-900 mt-3 mb-1">
          {formatInline(trimmed.slice(3))}
        </h3>
      );
    }

    // Bullet points (-, *, •)
    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      return (
        <li key={key} className="ml-4 list-disc text-zinc-700 my-0.5 text-sm leading-relaxed">
          {formatInline(itemText)}
        </li>
      );
    }

    // Numbered list items (1. 2. etc)
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <div key={key} className="flex gap-2 text-zinc-700 my-1 text-sm leading-relaxed">
          <span className="font-semibold text-[#254B3B] select-none flex-shrink-0">
            {numberedMatch[1]}.
          </span>
          <div>{formatInline(numberedMatch[2])}</div>
        </div>
      );
    }

    // Empty lines
    if (trimmed.length === 0) {
      return <div key={key} className="h-2" />;
    }

    // Regular paragraph
    return (
      <p key={key} className="text-sm text-zinc-700 my-1 leading-relaxed">
        {formatInline(line)}
      </p>
    );
  };

  // Parses bold (**text**), inline code (`code`), italic (*text* or _text_), and safe https:// markdown links [label](https://...)
  const formatInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const regex = /(\[[^\]]+\]\(https:\/\/[^\s)]+\)|\*\*.*?\*\*|`.*?`|\*[^*\n]+\*|^_[^_]+_$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      const matchText = match[0];
      if (matchText.startsWith('[') && matchText.includes('](https://')) {
        const linkMatch = matchText.match(/^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/);
        if (linkMatch) {
          const [, rawLabel, href] = linkMatch;
          let displayLabel = rawLabel.trim();
          if (/^(?:search\s+link|link|search|url|here)$/i.test(displayLabel)) {
            const lowerHref = href.toLowerCase();
            if (lowerHref.includes('amazon.in')) {
              displayLabel = 'Search on Amazon India';
            } else if (lowerHref.includes('flipkart.com')) {
              displayLabel = 'Search on Flipkart';
            } else if (lowerHref.includes('croma.com')) {
              displayLabel = 'Search on Croma';
            } else if (lowerHref.includes('reliancedigital.in')) {
              displayLabel = 'Search on Reliance Digital';
            } else if (lowerHref.includes('myntra.com')) {
              displayLabel = 'Search on Myntra';
            } else if (lowerHref.includes('ajio.com')) {
              displayLabel = 'Search on AJIO';
            } else if (lowerHref.includes('nykaa.com')) {
              displayLabel = 'Search on Nykaa';
            } else if (lowerHref.includes('tatacliq.com')) {
              displayLabel = 'Search on Tata CLiQ';
            } else if (lowerHref.includes('vijaysales.com')) {
              displayLabel = 'Search on Vijay Sales';
            } else {
              try {
                const host = new URL(href).hostname.replace(/^www\./i, '');
                displayLabel = `Search on ${host}`;
              } catch {
                displayLabel = 'Search on Retailer';
              }
            }
          }
          parts.push(
            <a
              key={match.index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-0.5 mx-0.5 rounded-md bg-[#DCE7D9]/60 hover:bg-[#DCE7D9] border border-[#254B3B]/20 text-[#254B3B] hover:text-[#1d3d2f] text-xs font-medium transition-colors"
            >
              <span>{displayLabel}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          );
        } else {
          parts.push(matchText);
        }
      } else if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-zinc-900">
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-[#F3EFE6] text-[#254B3B] font-mono text-xs border border-[#E6E1D6]"
          >
            {matchText.slice(1, -1)}
          </code>
        );
      } else if (
        (matchText.startsWith('_') && matchText.endsWith('_')) ||
        (matchText.startsWith('*') && matchText.endsWith('*'))
      ) {
        parts.push(
          <em key={match.index} className="italic text-zinc-600 text-xs">
            {matchText.slice(1, -1)}
          </em>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts;
  };

  return <div className={`space-y-0.5 ${className}`}>{lines.map(renderFormattedLine)}</div>;
};
