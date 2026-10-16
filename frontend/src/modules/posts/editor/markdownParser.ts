import type { ContentDoc, ContentNode } from "@/types/content";

/** Allowed Markdown file extensions */
export const ALLOWED_MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;

/**
 * Allowed MIME types for Markdown files.
 * Note: Many operating systems and browsers map `.md` files to `text/plain` or leave `file.type` empty.
 */
export const ALLOWED_MARKDOWN_MIMES = [
  "text/markdown",
  "text/x-markdown",
  "text/plain",
  "",
] as const;

/** Maximum allowed file size for Markdown uploads (2 MB, aligned with backend ContentAnalyzer) */
export const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ParsedMarkdownResult {
  raw: string;
  doc: ContentDoc;
  title?: string;
  slug?: string;
  excerpt?: string;
  fileName: string;
  fileSize: number;
}

/**
 * Validates whether the given file is a valid Markdown file based on
 * extension, MIME type, and size constraints.
 */
export function validateMarkdownFile(file: File): ValidationResult {
  if (!file || typeof file.name !== "string") {
    return { valid: false, error: "No file was provided or the file is invalid." };
  }

  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_MARKDOWN_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasValidExt) {
    return {
      valid: false,
      error: `Invalid file extension. Only Markdown files (${ALLOWED_MARKDOWN_EXTENSIONS.join(", ")}) are allowed.`,
    };
  }

  // Check MIME type if provided by browser / OS
  if (file.type && !ALLOWED_MARKDOWN_MIMES.includes(file.type as (typeof ALLOWED_MARKDOWN_MIMES)[number])) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type}". Please upload a valid Markdown file.`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: "The uploaded Markdown file is empty." };
  }

  if (file.size > MAX_MARKDOWN_BYTES) {
    return { valid: false, error: "The file exceeds the maximum allowed size of 2 MB." };
  }

  return { valid: true };
}

/**
 * Reads a Markdown file's raw string content using the FileReader API.
 */
export function readMarkdownFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const validation = validateMarkdownFile(file);
    if (!validation.valid) {
      reject(new Error(validation.error ?? "Invalid Markdown file."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file as text content."));
      }
    };

    reader.onerror = () => {
      reject(new Error(reader.error?.message || "An error occurred while reading the file."));
    };

    reader.onabort = () => {
      reject(new Error("File reading was aborted."));
    };

    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Extracts YAML frontmatter metadata (title, slug, excerpt) if present at the top of the file.
 */
export function parseFrontmatter(rawContent: string): {
  metadata: { title?: string; slug?: string; excerpt?: string };
  body: string;
} {
  const normalized = rawContent.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { metadata: {}, body: normalized };
  }

  const endIndex = normalized.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    return { metadata: {}, body: normalized };
  }

  const frontmatterStr = normalized.slice(4, endIndex);
  const body = normalized.slice(endIndex + 5);
  const metadata: { title?: string; slug?: string; excerpt?: string } = {};

  for (const line of frontmatterStr.split("\n")) {
    const colon = line.indexOf(":");
    if (colon !== -1) {
      const key = line.slice(0, colon).trim().toLowerCase();
      let value = line.slice(colon + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === "title" || key === "slug" || key === "excerpt") {
        metadata[key] = value;
      }
    }
  }

  return { metadata, body };
}

/**
 * Extracts metadata such as title from frontmatter or the first H1 header in the content.
 */
export function extractMarkdownMetadata(rawContent: string): {
  title?: string;
  slug?: string;
  excerpt?: string;
  body: string;
} {
  const { metadata, body } = parseFrontmatter(rawContent);
  let title = metadata.title;

  // If title was not in frontmatter, check for a leading `# Heading 1`
  if (!title) {
    const headingMatch = body.trimStart().match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }
  }

  return {
    title,
    slug: metadata.slug,
    excerpt: metadata.excerpt,
    body,
  };
}

/**
 * Parses inline Markdown formatting (bold, italic, strikethrough, inline code, links, images)
 * into an array of Tiptap ContentNodes.
 */
export function parseInlineText(text: string): ContentNode[] {
  if (!text) return [];

  // Match inline patterns in priority order:
  // 1: Image: ![alt](src)
  // 4: Link: [text](href)
  // 7: Bold + Italic: ***text*** or ___text___
  // 10: Bold: **text** or __text__
  // 13: Italic: *text* or _text_
  // 16: Strikethrough: ~~text~~
  // 18: Inline code: `text`
  const regex =
    /(!\[(.*?)\]\((.*?)\))|(\[(.*?)\]\((.*?)\))|(\*\*\*(.*?)\*\*\*|___(.*?)___)|(\*\*(.*?)\*\*|__(.*?)__)|(\*(.*?)\*|_(.*?)_)|(~~(.*?)~~)|(`([^`]+)`)/g;

  const nodes: ContentNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Append any preceding plain text
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain) nodes.push({ type: "text", text: plain });
    }

    if (match[1] !== undefined) {
      // Standalone or inline image
      const alt = match[2];
      const src = match[3].trim();
      // Ensure safe image URL scheme conforming to ContentAnalyzer
      if (/^(https?:\/\/|\/)/i.test(src)) {
        nodes.push({ type: "image", attrs: { src, alt: alt || null, mediaId: null } });
      } else {
        nodes.push({ type: "text", text: match[0] });
      }
    } else if (match[4] !== undefined) {
      // Hyperlink
      const linkText = match[5];
      const href = match[6].trim();
      // ContentAnalyzer enforces safe URLs starting with http://, https://, mailto:, / or #
      if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) {
        nodes.push({
          type: "text",
          text: linkText,
          marks: [{ type: "link", attrs: { href } }],
        });
      } else {
        // Fallback: emit link text without the unsafe mark
        nodes.push({ type: "text", text: linkText });
      }
    } else if (match[7] !== undefined) {
      // Bold + Italic
      const content = match[8] || match[9];
      nodes.push({
        type: "text",
        text: content,
        marks: [{ type: "bold" }, { type: "italic" }],
      });
    } else if (match[10] !== undefined) {
      // Bold
      const content = match[11] || match[12];
      nodes.push({
        type: "text",
        text: content,
        marks: [{ type: "bold" }],
      });
    } else if (match[13] !== undefined) {
      // Italic
      const content = match[14] || match[15];
      nodes.push({
        type: "text",
        text: content,
        marks: [{ type: "italic" }],
      });
    } else if (match[16] !== undefined) {
      // Strikethrough
      const content = match[17];
      nodes.push({
        type: "text",
        text: content,
        marks: [{ type: "strike" }],
      });
    } else if (match[18] !== undefined) {
      // Inline code
      const content = match[19];
      nodes.push({
        type: "text",
        text: content,
        marks: [{ type: "code" }],
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining) nodes.push({ type: "text", text: remaining });
  }

  return nodes;
}

/**
 * Parses raw Markdown text into a Tiptap/ProseMirror ContentDoc structure.
 */
export function parseMarkdownToDoc(markdown: string): ContentDoc {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: ContentNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block: ```language ... ```
    const codeFenceMatch = line.match(/^```(\w*)/);
    if (codeFenceMatch) {
      const language = codeFenceMatch[1] || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // Consume closing ```
      const text = codeLines.join("\n");
      content.push({
        type: "codeBlock",
        attrs: language ? { language } : {},
        content: text ? [{ type: "text", text }] : undefined,
      });
      continue;
    }

    // Heading: # Heading (Tiptap is configured for levels 2 and 3)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      // Level 1 and 2 map to level 2; level 3+ map to level 3
      const level = Math.min(Math.max(headingMatch[1].length, 2), 3);
      const headingText = headingMatch[2].trim();
      const inlineNodes = parseInlineText(headingText);
      content.push({
        type: "heading",
        attrs: { level },
        content: inlineNodes.length > 0 ? inlineNodes : undefined,
      });
      i++;
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(---|___|\*\*\*)$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Blockquote: > quote
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const quoteDoc = parseMarkdownToDoc(quoteLines.join("\n"));
      content.push({
        type: "blockquote",
        content: quoteDoc.content && quoteDoc.content.length > 0 ? quoteDoc.content : [{ type: "paragraph" }],
      });
      continue;
    }

    // Unordered List: - item, * item, + item
    if (/^[-*+]\s+/.test(line)) {
      const listItems: ContentNode[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*+]\s+/, "").trim();
        const inlineNodes = parseInlineText(itemText);
        listItems.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            },
          ],
        });
        i++;
      }
      content.push({
        type: "bulletList",
        content: listItems,
      });
      continue;
    }

    // Ordered List: 1. item
    if (/^\d+\.\s+/.test(line)) {
      const listItems: ContentNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, "").trim();
        const inlineNodes = parseInlineText(itemText);
        listItems.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            },
          ],
        });
        i++;
      }
      content.push({
        type: "orderedList",
        content: listItems,
      });
      continue;
    }

    // Standalone Image: ![alt](url)
    const imageMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      const alt = imageMatch[1] || null;
      const src = imageMatch[2].trim();
      if (/^(https?:\/\/|\/)/i.test(src)) {
        content.push({
          type: "image",
          attrs: { src, alt, mediaId: null },
        });
        i++;
        continue;
      }
    }

    // Normal Paragraph
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !lines[i].startsWith(">") &&
      !/^[-*+]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^(---|___|\*\*\*)$/.test(lines[i].trim()) &&
      !/^!\[(.*?)\]\((.*?)\)$/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    const inlineNodes = parseInlineText(paragraphLines.join(" "));
    content.push({
      type: "paragraph",
      content: inlineNodes.length > 0 ? inlineNodes : undefined,
    });
  }

  if (content.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return { type: "doc", content };
}

/**
 * High-level parser service that validates a Markdown file, reads its stream,
 * extracts metadata (e.g. title, slug, excerpt), and produces a structured ContentDoc.
 */
export async function parseMarkdownFile(file: File): Promise<ParsedMarkdownResult> {
  const raw = await readMarkdownFile(file);
  const { title, slug, excerpt, body } = extractMarkdownMetadata(raw);
  const doc = parseMarkdownToDoc(body);

  return {
    raw,
    doc,
    title,
    slug,
    excerpt,
    fileName: file.name,
    fileSize: file.size,
  };
}
