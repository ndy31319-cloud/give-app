/** Strip AI emphasis, preserving literal asterisks and URL contents. */
export function normalizeChatbotText(value: string): string {
  const urls: string[] = [];
  let result = value.replace(/(?:https?:\/\/|www\.)[^\s<>"')]+/gi, (matched: string, offset: number) => {
    let url = matched;
    let suffix = '';
    for (const marker of ['***', '**', '*']) {
      const prefix = value.slice(0, offset).split('\n').pop() ?? '';
      if (url.endsWith(marker) && (prefix.split(marker).length - 1) % 2) {
        url = url.slice(0, -marker.length);
        suffix = marker;
        break;
      }
    }
    const token = `\x00URL${urls.length}\x00`;
    urls.push(url);
    return token + suffix;
  });
  for (const marker of ['***', '**', '*']) {
    const escaped = marker.replace(/\*/g, '\\*');
    result = result.replace(new RegExp(`(?<![\\\\*])${escaped}(?=\\S)([^*\\n]*?\\S)${escaped}(?!\\*)`, 'g'), '$1');
  }
  urls.forEach((url, index) => { result = result.split(`\x00URL${index}\x00`).join(url); });
  return result;
}

export interface ChatbotReplyPart {
  text: string;
  target?: string;
}

// Bare URLs stop at parentheses and non-ASCII prose; explicit Markdown links may contain Unicode paths.
const chatbotLinkPattern = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|(?:https?:\/\/|www\.)[A-Za-z0-9._~:/?#@!$&*+,;=%\[\]-]+/gi;

function trimLinkEnding(value: string) {
  return value.replace(/[.,!?;:，。！？、\]\}]+$/, '');
}

export function splitChatbotLinks(value: string): ChatbotReplyPart[] {
  const parts: ChatbotReplyPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(chatbotLinkPattern)) {
    const start = match.index;
    if (start > cursor) parts.push({ text: value.slice(cursor, start) });

    const markdown = match[2] !== undefined;
    const matchedText = match[0];
    const visibleUrl = markdown ? match[2] : trimLinkEnding(matchedText);
    const target = /^www\./i.test(visibleUrl) ? `https://${visibleUrl}` : visibleUrl;
    let valid = false;
    try {
      const parsed = new URL(target);
      valid = (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
    } catch { /* An incomplete URL stays ordinary text. */ }

    if (valid) {
      parts.push({ text: markdown ? `${match[1]} ↗` : visibleUrl, target });
      if (!markdown && matchedText.length > visibleUrl.length) {
        parts.push({ text: matchedText.slice(visibleUrl.length) });
      }
    } else {
      parts.push({ text: matchedText });
    }
    cursor = start + matchedText.length;
  }

  if (cursor < value.length) parts.push({ text: value.slice(cursor) });
  return parts;
}
