/**
 * Telegram Markdown Converter
 *
 * Converts Telegram-style markdown and HTML tags to standard markdown for rendering.
 *
 * @module features/simulator/lib/telegram-markdown
 */

/**
 * Convert Telegram markdown/HTML syntax to standard markdown
 *
 * Telegram markdown:
 * - *bold* → **bold**
 * - ~strike~ → ~~strike~~
 * - _italic_ → _italic_ (same, no conversion needed)
 * - `code` → `code` (same, no conversion needed)
 * - ```code block``` → ```code block``` (same, no conversion needed)
 *
 * Telegram HTML tags:
 * - <b>text</b> → **text**
 * - <strong>text</strong> → **text**
 * - <i>text</i> → *text*
 * - <em>text</em> → *text*
 * - <u>text</u> → <u>text</u> (kept as HTML, handled by CSS)
 * - <ins>text</ins> → <u>text</u> (converted to underline)
 * - <s>text</s> → ~~text~~
 * - <strike>text</strike> → ~~text~~
 * - <code>text</code> → `text`
 * - <pre>text</pre> → ```text```
 * - <a href="url">text</a> → [text](url)
 *
 * Newlines:
 * - Normalized to \n (CSS whitespace-pre-line handles rendering)
 */
export function telegramToMarkdown(text: string): string {
  if (!text) return text;

  let result = text;

  // === HTML Tags ===
  // Convert <b>text</b> and <strong>text</strong> to **text**
  // Use 's' flag to match across newlines
  result = result.replace(/<b>([\s\S]+?)<\/b>/gi, "**$1**");
  result = result.replace(/<strong>([\s\S]+?)<\/strong>/gi, "**$1**");

  // Convert <i>text</i> and <em>text</em> to *text*
  result = result.replace(/<i>([\s\S]+?)<\/i>/gi, "*$1*");
  result = result.replace(/<em>([\s\S]+?)<\/em>/gi, "*$1*");

  // Keep <u>text</u> as HTML - will be styled by CSS
  // (no conversion needed)

  // Convert <ins>text</ins> to <u>text</u> (handled by CSS as underline)
  result = result.replace(/<ins>([\s\S]+?)<\/ins>/gi, "<u>$1</u>");

  // Convert <a href="url">text</a> to markdown link [text](url)
  result = result.replace(/<a\s+href=["']([^"']+)["']>([^<]+)<\/a>/gi, "[$2]($1)");

  // Convert <s>text</s> and <strike>text</strike> to ~~text~~
  result = result.replace(/<s>([\s\S]+?)<\/s>/gi, "~~$1~~");
  result = result.replace(/<strike>([\s\S]+?)<\/strike>/gi, "~~$1~~");

  // Convert <code>text</code> to `text`
  result = result.replace(/<code>([\s\S]+?)<\/code>/gi, "`$1`");

  // Convert <pre>text</pre> to ```text```
  result = result.replace(/<pre>([\s\S]+?)<\/pre>/gi, "```\n$1\n```");

  // === Telegram Markdown Syntax ===
  // Convert *bold* to **bold** (but not already **)
  // Match single * not preceded/followed by *
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "**$1**");

  // Convert ~strike~ to ~~strike~~ (but not already ~~)
  result = result.replace(/(?<!~)~(?!~)(.+?)(?<!~)~(?!~)/g, "~~$1~~");

  // === Newline Handling ===
  // Normalize line endings
  result = result.replace(/\r\n/g, "\n");

  // Double newlines (\n\n) create paragraph breaks in markdown
  // CSS handles the visual spacing between paragraphs

  return result;
}
