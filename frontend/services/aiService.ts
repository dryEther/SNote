

import type { AISettings } from '../hooks/useSettings';
import { serverEnrich, serverFormatSelection } from './serverStorage';
import { buildPromptComponents, buildPromptComponentsForSelection } from './promptBuilder';

export const enrichNote = async (
  content: string, 
  settings: AISettings,
  options: { isSelection?: boolean } = {}
): Promise<string> => {
  if (settings.storageLocation !== 'server') {
    return `Error: AI features require Server storage to be configured.`;
  }
  const prompts = options.isSelection 
    ? buildPromptComponentsForSelection(content)
    : buildPromptComponents(content);
  
  try {
    const response = await serverEnrich({ prompts, isSelection: !!options.isSelection });
    return prompts.finalContentTransformer(content, response.text, prompts.matchedBlock);
  } catch (error) {
    console.error("Error enriching note via server:", error);
    return `Error: Could not enrich note. ${error instanceof Error ? error.message : String(error)}`;
  }
};

export const formatSelectionWithAI = async (selection: string, settings: AISettings): Promise<string> => {
    if (settings.storageLocation !== 'server') {
        return `Error: AI features require Server storage to be configured.`;
    }
    try {
        const response = await serverFormatSelection({ selection });
        return response.text.trim();
    } catch (error) {
        console.error("Error formatting selection via server:", error);
        return `Error: Could not format selection. ${error instanceof Error ? error.message : String(error)}`;
    }
};