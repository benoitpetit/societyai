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

  // 2. Try to find the first occurrence of { or [ and match with balance
  const startChars = ['{', '['];
  for (const startChar of startChars) {
    let startIndex = text.indexOf(startChar);
    while (startIndex !== -1) {
      const endChar = startChar === '{' ? '}' : ']';
      let balance = 0;
      let endIndex = -1;

      for (let i = startIndex; i < text.length; i++) {
        if (text[i] === startChar) balance++;
        else if (text[i] === endChar) balance--;

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
    .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1') // Remove comments
    .replace(/,(\s*[\]}])/g, '$1') // Remove trailing commas
    .trim();
}
