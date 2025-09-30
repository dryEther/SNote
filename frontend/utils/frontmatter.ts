
interface FrontMatterData {
    id?: string;
    tags?: string[] | string;
    [key: string]: any;
}

export interface ParsedMarkdown {
    data: FrontMatterData;
    content: string;
}

const FRONT_MATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

export function parseFrontMatter(markdown: string): ParsedMarkdown {
    const match = markdown.match(FRONT_MATTER_REGEX);
    if (!match) {
        return { data: {}, content: markdown };
    }

    const frontMatterBlock = match[1];
    const content = markdown.substring(match[0].length);
    const data: FrontMatterData = {};

    frontMatterBlock.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();

            if (key === 'tags') {
                try {
                    // Try parsing as JSON array: e.g., ["tag1", "tag2"]
                    const tags = JSON.parse(value);
                    if (Array.isArray(tags)) {
                        data.tags = tags;
                        return;
                    }
                } catch (e) {
                    // Fallback to comma-separated string: e.g., tag1, tag2
                    data.tags = value.split(',').map(t => t.trim()).filter(Boolean);
                }
            } else {
                // Remove quotes from string values
                data[key] = value.replace(/^['"]|['"]$/g, '');
            }
        }
    });

    return { data, content };
}

export function stringifyFrontMatter(data: FrontMatterData, content: string): string {
    const validData = Object.entries(data).filter(([_, value]) => value !== undefined && value !== null);
    
    if (validData.length === 0) {
        return content;
    }

    let frontMatterBlock = '---\n';
    for (const [key, value] of validData) {
        if (key === 'tags' && Array.isArray(value)) {
            // Stringify tags as a JSON array for consistency
            frontMatterBlock += `tags: ${JSON.stringify(value)}\n`;
        } else {
            frontMatterBlock += `${key}: ${String(value)}\n`;
        }
    }
    frontMatterBlock += '---\n\n';

    return frontMatterBlock + content.trim();
}