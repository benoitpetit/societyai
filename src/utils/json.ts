/**
 * Robust JSON extraction utility for LLM outputs.
 */

/**
 * Extracts the first valid JSON block from a string.
 * Supports Markdown code blocks and raw JSON.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJsonFromText<T = any>(text: string): T | null {
  if (!text) return null;

  // 1. Try to find JSON within markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const content = match[1].trim();
    try {
      return JSON.parse(cleanJsonString(content));
    } catch (e) {
      // Continue to next match if parsing fails
    }
  }

  // 2. Try to find the first occurrence of { or [ and match with balance,
  //    skipping characters inside string literals to avoid false bracket counts.
  const startChars = ['{', '['];
  for (const startChar of startChars) {
    let startIndex = text.indexOf(startChar);
    while (startIndex !== -1) {
      const endChar = startChar === '{' ? '}' : ']';
      let balance = 0;
      let endIndex = -1;
      let inString = false;
      let escaped = false;

      for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];

        if (escaped) {
          escaped = false;
          continue;
        }

        if (ch === '\\' && inString) {
          escaped = true;
          continue;
        }

        if (ch === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (ch === startChar) balance++;
        else if (ch === endChar) balance--;

        if (balance === 0) {
          endIndex = i;
          break;
        }
      }

      if (endIndex !== -1) {
        const potentialJson = text.substring(startIndex, endIndex + 1);
        try {
          return JSON.parse(cleanJsonString(potentialJson));
        } catch (e) {
          // Continue searching if this block wasn't valid JSON
        }
      }
      startIndex = text.indexOf(startChar, startIndex + 1);
    }
  }

  return null;
}

/**
 * Cleans common LLM artifacts from a JSON string.
 */
function cleanJsonString(str: string): string {
  return str
    .replace(/\\n/g, '\n') // Unescape newlines
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(removeLineCommentSafe, '') // Remove line comments, preserving URLs
    .replace(/,(\s*[\]}])/g, '$1') // Remove trailing commas
    .trim();
}

/**
 * Matches a `//` line comment that is NOT preceded by `:` (to preserve `://` in URLs).
 * Uses a lookbehind to leave `http://` and `https://` untouched.
 */
const removeLineCommentSafe = /(?<!:)\/\/[^\n\r"]*/gm;
