"""Remove model-generated emphasis without changing URL contents."""
import re


def normalize_chatbot_text(value: str) -> str:
    urls = []

    def protect(match):
        url = match.group(0)
        suffix = ""
        # A closing emphasis delimiter after a URL belongs to the sentence.
        for marker in ("***", "**", "*"):
            prefix = value[:match.start()].rsplit("\n", 1)[-1]
            if url.endswith(marker) and prefix.count(marker) % 2:
                url, suffix = url[:-len(marker)], marker
                break
        token = f"\x00URL{len(urls)}\x00"
        urls.append(url)
        return token + suffix

    result = re.sub(r"(?:https?://|www\.)[^\s<>\"')]+", protect, value, flags=re.I)
    for marker in ("***", "**", "*"):
        escaped = re.escape(marker)
        result = re.sub(r"(?<![\\*])" + escaped + r"(?=\S)([^*\n]*?\S)" + escaped + r"(?!\*)", r"\1", result)
    for index, url in enumerate(urls):
        result = result.replace(f"\x00URL{index}\x00", url)
    return result
