export interface PromptComponents {
  systemPrompt: string;
  userPrompt: string;
  // The specific block of text from the original content that this prompt is based on.
  // This could be a selection, a set of tags, or the entire content.
  matchedBlock: string;
  // Transforms the original content into the final content using the AI's response.
  finalContentTransformer: (originalContent: string, aiResponse: string, matchedBlock: string) => string;
}

export function buildPromptComponentsForSelection(selection: string): PromptComponents {
  return {
    systemPrompt: `You are an expert copy editor. Your task is to rewrite, enrich, and improve the following text snippet.
- Correct any grammatical errors, spelling mistakes, and awkward phrasing.
- Improve clarity, flow, and conciseness.
- If appropriate, expand on the ideas, but stay true to the original intent.
- Your response MUST BE ONLY the improved text snippet itself. Do not include any extra commentary, introductions, explanations, or formatting like Markdown quotes.`,
    userPrompt: `Here is the text snippet to improve:\n---\n${selection}\n---`,
    matchedBlock: selection,
    // For a selection, the calling function handles replacement. We just return the AI response.
    finalContentTransformer: (_originalContent, aiResponse, _matchedBlock) => aiResponse,
  };
}


export function buildPromptComponents(content: string): PromptComponents {
  // Case 1: A prompt followed by a context block.
  // We look for the first occurrence of this pattern.
  const combinedRegex = /(#prompt{[\s\S]+?})([\s\n]*)(#context{[\s\S]+?})/;
  const combinedMatch = content.match(combinedRegex);

  if (combinedMatch) {
    const fullMatchBlock = combinedMatch[0];
    const promptTag = combinedMatch[1];
    const contextTag = combinedMatch[3];

    const promptText = promptTag.match(/#prompt{([\s\S]+?)}/)?.[1]?.trim();
    const contextText = contextTag.match(/#context{([\s\S]+?)}/)?.[1]?.trim();

    if (promptText && contextText) {
      return {
        systemPrompt: "You are an intelligent assistant. Apply the following instruction to the provided context. Your response must be ONLY the result of the instruction applied to the context, without any extra commentary, introductions, or formatting.",
        userPrompt: `Instruction: "${promptText}"\n\nContext:\n---\n${contextText}\n---`,
        matchedBlock: fullMatchBlock,
        // The transformer replaces the entire matched block (#prompt and #context) with the AI's response.
        finalContentTransformer: (original, response, matched) => original.replace(matched, response),
      };
    }
  }

  // Case 2: A standalone prompt block (not followed by a context block).
  // We look for the first occurrence.
  const promptOnlyRegex = /#prompt{([\s\S]+?)}/;
  const promptOnlyMatch = content.match(promptOnlyRegex);

  if (promptOnlyMatch) {
    const fullPromptTag = promptOnlyMatch[0];
    const promptText = promptOnlyMatch[1].trim();

    return {
      systemPrompt: "You are an intelligent assistant. You will be given a prompt. Your response should be a direct answer to the prompt. Do not include any extra commentary, introductions, or explanations. Just provide the answer.",
      userPrompt: promptText,
      matchedBlock: fullPromptTag,
      // The transformer replaces only the #prompt{} tag with the AI's response.
      finalContentTransformer: (original, response, matched) => original.replace(matched, response),
    };
  }

  // Case 3: No special tags found, default behavior (enrich the whole note).
  return {
    systemPrompt: `You are an intelligent note-enhancing assistant.
Your task is to enrich, format, and complete the user's note.
Analyze the following text, identify key contexts, and improve it.
- If it's a list, format it cleanly using Markdown.
- If it's a draft, try to complete the sentences or expand on the ideas.
- If it contains code snippets, format them properly.
- Correct any grammatical errors or awkward phrasing.
- Maintain the original intent and tone of the note.`,
    userPrompt: `Here is the note:\n---\n${content}\n---`,
    matchedBlock: content,
    // The transformer replaces the entire original content with the AI's response.
    finalContentTransformer: (_originalContent, aiResponse, _matchedBlock) => aiResponse,
  };
}
