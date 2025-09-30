/**
 * Removes common leading whitespace from every line in a string.
 * It calculates the common indentation prefix (handling mixed spaces and tabs)
 * from all non-empty lines and removes it.
 * @param text The string to dedent.
 * @returns The dedented string.
 */
const dedent = (text: string): string => {
  const lines = text.split('\n');
  let commonPrefix: string | null = null;

  // Find the common leading whitespace prefix from all non-empty lines
  for (const line of lines) {
    if (line.trim().length === 0) {
      // Ignore empty or whitespace-only lines when determining indentation
      continue;
    }

    const leadingWhitespace = line.match(/^\s*/)?.[0] ?? '';

    if (commonPrefix === null) {
      // This is the first non-empty line we've seen
      commonPrefix = leadingWhitespace;
    } else {
      // Find the common part of the current prefix and this line's whitespace
      let i = 0;
      while (i < commonPrefix.length && i < leadingWhitespace.length && commonPrefix[i] === leadingWhitespace[i]) {
        i++;
      }
      commonPrefix = commonPrefix.substring(0, i);
    }
    
    // If we've found there's no common prefix, we can stop checking.
    if (commonPrefix === '') {
        break;
    }
  }

  // If a common prefix was found, remove it from the start of each line
  if (commonPrefix && commonPrefix.length > 0) {
    const prefix = commonPrefix; // for TypeScript non-null assertion
    return lines.map(line => {
      // Only remove the prefix if the line actually starts with it.
      // This is particularly important for empty lines or lines with less indentation.
      if (line.startsWith(prefix)) {
        return line.substring(prefix.length);
      }
      return line;
    }).join('\n');
  }

  return text;
};


/**
 * A simple markdown auto-formatter.
 * This function applies basic formatting rules to a markdown string, including
 * formatting content inside code blocks.
 *
 * Formatting Rules:
 * - Ensures a single space follows list markers (e.g., `- item`, `1. item`).
 * - Trims trailing whitespace from all lines.
 * - Normalizes paragraph spacing by collapsing three or more newlines into two.
 * - Inside code blocks:
 *   - Lowercases the language identifier (e.g., `JavaScript` -> `javascript`).
 *   - Trims leading and trailing blank lines.
 *   - Removes common indentation from all lines of code (dedents).
 *
 * @param text The raw markdown string to format.
 * @returns A new string with formatting applied.
 */
export const formatMarkdown = (text: string): string => {
  if (!text) {
    return '';
  }

  // Split by code blocks to avoid formatting code content.
  // The capturing group in the regex keeps the delimiters (the code blocks) in the resulting array.
  const parts = text.split(/(```[\s\S]*?```)/g);

  const formattedParts = parts.map((part, index) => {
    // Odd-indexed parts are the code blocks themselves.
    if (index % 2 === 1) {
        // A code block part looks like: "```javascript\ncode here\n```"
        const lines = part.split('\n');
        
        // Only format multi-line code blocks for safety and predictability.
        if (lines.length < 2) {
            return part;
        }

        const firstLine = lines[0];
        const lastLine = lines[lines.length - 1];

        // Basic validation
        if (!firstLine.startsWith('```') || !lastLine.startsWith('```')) {
            return part; // Not a well-formed block, return as is.
        }

        // 1. Format language identifier
        const langIdentifier = firstLine.substring(3).trim().toLowerCase();
        
        // 2. Extract, trim, and dedent content
        let content = lines.slice(1, -1).join('\n');
        content = content.replace(/^\s*\n|\n\s*$/g, ''); // Trim leading/trailing blank lines
        content = dedent(content);

        // 3. Reconstruct the code block
        return '```' + langIdentifier + '\n' + content + '\n```';
    }

    // Even-indexed parts are the content outside code blocks.
    let processedPart = part;

    // Rule 1: Ensure a single space after list markers (multiline).
    // Handles prefixes like `-`, `*`, `+`, and `1.`.
    // It correctly preserves indentation.
    processedPart = processedPart.replace(/^( *)([-*+]|\d+\.)([^\s])/gm, '$1$2 $3');

    // Rule 2: Trim trailing whitespace from each line (multiline).
    processedPart = processedPart.replace(/[ \t]+$/gm, '');

    // Rule 3: Normalize paragraph spacing. Collapse 3 or more newlines into exactly 2.
    // This maintains intentional paragraph breaks but cleans up excessive spacing.
    processedPart = processedPart.replace(/\n{3,}/g, '\n\n');
    
    return processedPart;
  });

  // Rejoin all parts.
  return formattedParts.join('');
};