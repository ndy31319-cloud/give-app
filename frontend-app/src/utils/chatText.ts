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
