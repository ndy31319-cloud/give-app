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


def remove_application_method_sections(value: str) -> str:
    """Remove the chatbot's unwanted application-method section only.

    Keep the rest of the answer, URLs, and adjacent policy guidance intact.
    The model sometimes emits either a one-line heading or a heading followed
    by bullet lines, so both forms are handled without deleting the whole
    response when the heading is absent.
    """
    text = str(value or "")
    if not text:
        return ""

    lines = text.splitlines()
    output = []
    removing_bullets = False
    next_heading = re.compile(
        r"^\s*(?:[#>*\-•]\s*)?(?:지원\s*대상|지원\s*내용|주의할\s*점|공식\s*확인\s*링크|신청\s*기간|대상\s*지역|담당\s*기관)\s*[:：]?\s*",
        re.IGNORECASE,
    )
    application_heading = re.compile(
        r"^\s*(?:[#>*\-•]\s*)?신청\s*방법\s*[:：]?\s*",
        re.IGNORECASE,
    )

    for line in lines:
        if application_heading.match(line):
            removing_bullets = True
            # A one-line "신청 방법: ..." entry is removed here.
            continue

        if removing_bullets:
            if not line.strip():
                removing_bullets = False
                continue
            if next_heading.match(line):
                removing_bullets = False
                output.append(line)
                continue
            if line.lstrip().startswith(("-", "•", "*", "1.", "2.", "3.")):
                continue
            # A normal sentence after the heading is part of the answer, not
            # necessarily an application step. Preserve it conservatively.
            removing_bullets = False

        output.append(line)

    return "\n".join(output).strip()
