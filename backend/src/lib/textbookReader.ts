export interface TextbookOutlineEntry {
  title: string;
  pageNumber: number;
  depth: number;
}

export interface TextbookPageText {
  pageNumber: number;
  text: string;
}

export interface TextbookReaderSeed {
  pageTexts: TextbookPageText[];
  outline?: TextbookOutlineEntry[];
  totalPages?: number;
}

export interface TextbookParagraphRecord {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  paragraphIndexInChapter: number;
  pageNumber: number;
  text: string;
  sentences: string[];
}

export interface TextbookChapterRecord {
  chapterNumber: number;
  title: string;
  startPage: number;
  endPage: number;
  paragraphIds: string[];
}

export interface TextbookReaderDocument {
  sourceId: string;
  chapters: TextbookChapterRecord[];
  paragraphs: TextbookParagraphRecord[];
  totalPages: number;
  chapterSource: "outline" | "headings" | "fallback";
}

interface ChapterStart {
  title: string;
  startPage: number;
}

const PAGE_CHAR_BUDGET = 1800;

function normalizeParagraphText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function paragraphsFromBlock(text: string): string[] {
  const normalized = normalizeParagraphText(text);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);
}

export function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]?/g) ?? [];
  const sentences = matches.map((sentence) => sentence.trim()).filter(Boolean);
  if (sentences.length === 0 && text.trim()) {
    return [text.trim()];
  }
  return sentences;
}

function isChapterHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  const normalized = trimmed.replace(/\s+/g, " ");
  return (
    /^#{1,6}\s+\S/.test(trimmed) ||
    /^chapter\s+(\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b([:\s-].*)?$/i.test(normalized) ||
    /^(unit|lesson|part)\s+\d+([:\s-].*)?$/i.test(normalized) ||
    /^\d{1,2}([.)]|[\s:-])\s*[A-Z][A-Za-z0-9 ,'"()\-]{4,}$/.test(normalized) ||
    /^[A-Z][A-Z0-9 ,'"()\-]{7,}$/.test(normalized)
  );
}

function cleanChapterHeading(line: string): string {
  const trimmed = line.trim();
  if (/^#{1,6}\s+\S/.test(trimmed)) {
    return trimmed.replace(/^#{1,6}\s+/, "");
  }
  return trimmed;
}

function splitChapterBlocks(text: string): Array<{ title: string; body: string }> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }
  const lines = normalized.split("\n");
  const blocks: Array<{ title: string; body: string }> = [];
  let currentTitle = "Document";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (isChapterHeading(line)) {
      if (currentLines.join("\n").trim()) {
        blocks.push({ title: currentTitle, body: currentLines.join("\n").trim() });
      }
      currentTitle = cleanChapterHeading(line);
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  if (currentLines.join("\n").trim()) {
    blocks.push({ title: currentTitle, body: currentLines.join("\n").trim() });
  }

  if (blocks.length === 0) {
    return [{ title: "Document", body: normalized }];
  }

  return blocks.map((block, index) => {
    if (block.title === "Document" && index > 0) {
      return { ...block, title: `Chapter ${index + 1}` };
    }
    return block;
  });
}

function chooseOutlineDepth(entries: TextbookOutlineEntry[]): number | null {
  if (entries.length === 0) {
    return null;
  }

  const counts = new Map<number, number>();
  for (const entry of entries) {
    counts.set(entry.depth, (counts.get(entry.depth) ?? 0) + 1);
  }

  const depths = [...counts.keys()].sort((a, b) => a - b);
  for (const depth of depths) {
    if ((counts.get(depth) ?? 0) >= 2) {
      return depth;
    }
  }
  return depths[0] ?? null;
}

function dedupeChapterStarts(starts: ChapterStart[]): ChapterStart[] {
  const out: ChapterStart[] = [];
  const seenPages = new Set<number>();

  for (const start of starts) {
    if (!start.title.trim() || start.startPage < 1 || seenPages.has(start.startPage)) {
      continue;
    }
    out.push(start);
    seenPages.add(start.startPage);
  }

  return out;
}

function buildChapterStartsFromOutline(
  outline: TextbookOutlineEntry[] | undefined,
  totalPages: number,
): ChapterStart[] {
  if (!outline?.length) {
    return [];
  }

  const normalized = outline
    .filter((entry) => entry.title.trim() && entry.pageNumber >= 1 && entry.pageNumber <= totalPages)
    .sort((a, b) => (a.pageNumber - b.pageNumber) || (a.depth - b.depth) || a.title.localeCompare(b.title));
  const chosenDepth = chooseOutlineDepth(normalized);
  if (chosenDepth === null) {
    return [];
  }

  const starts = normalized
    .filter((entry) => entry.depth === chosenDepth)
    .map((entry) => ({
      title: entry.title.trim(),
      startPage: entry.pageNumber,
    }));

  return dedupeChapterStarts(starts);
}

function buildChapterStartsFromPages(pageTexts: TextbookPageText[]): ChapterStart[] {
  const starts: ChapterStart[] = [];

  for (const page of pageTexts) {
    const lines = normalizeParagraphText(page.text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);
    const match = lines.find((line) => isChapterHeading(line));
    if (!match) {
      continue;
    }
    starts.push({
      title: cleanChapterHeading(match),
      startPage: page.pageNumber,
    });
  }

  return dedupeChapterStarts(starts);
}

function buildChapterRanges(starts: ChapterStart[], totalPages: number): TextbookChapterRecord[] {
  if (starts.length === 0) {
    return [
      {
        chapterNumber: 1,
        title: "Document",
        startPage: 1,
        endPage: Math.max(totalPages, 1),
        paragraphIds: [],
      },
    ];
  }

  const normalizedStarts = [...starts].sort((a, b) => a.startPage - b.startPage);
  if (normalizedStarts[0]!.startPage > 1) {
    normalizedStarts.unshift({
      title: "Opening pages",
      startPage: 1,
    });
  }

  return normalizedStarts.map((start, index) => {
    const nextStartPage = normalizedStarts[index + 1]?.startPage;
    return {
      chapterNumber: index + 1,
      title: start.title,
      startPage: start.startPage,
      endPage: Math.max(
        start.startPage,
        nextStartPage !== undefined ? nextStartPage - 1 : Math.max(totalPages, start.startPage),
      ),
      paragraphIds: [],
    };
  });
}

function findChapterForPage(chapters: TextbookChapterRecord[], pageNumber: number): TextbookChapterRecord {
  for (let index = chapters.length - 1; index >= 0; index -= 1) {
    const chapter = chapters[index]!;
    if (pageNumber >= chapter.startPage) {
      return chapter;
    }
  }
  return chapters[0]!;
}

function buildPageBackedReaderDocument(
  sourceId: string,
  seed: TextbookReaderSeed,
): TextbookReaderDocument {
  const totalPages = Math.max(
    seed.totalPages ?? seed.pageTexts.length,
    seed.pageTexts.at(-1)?.pageNumber ?? seed.pageTexts.length,
    1,
  );
  const outlineStarts = buildChapterStartsFromOutline(seed.outline, totalPages);
  const headingStarts = outlineStarts.length > 0 ? [] : buildChapterStartsFromPages(seed.pageTexts);
  const chapterSource = outlineStarts.length > 0 ? "outline" : headingStarts.length > 0 ? "headings" : "fallback";
  const chapters = buildChapterRanges(outlineStarts.length > 0 ? outlineStarts : headingStarts, totalPages);
  const paragraphs: TextbookParagraphRecord[] = [];
  const chapterParagraphCounts = new Map<number, number>();

  for (const page of seed.pageTexts) {
    const pageParagraphs = paragraphsFromBlock(page.text);
    const chapter = findChapterForPage(chapters, page.pageNumber);
    for (const paragraphText of pageParagraphs) {
      const paragraphIndexInChapter = (chapterParagraphCounts.get(chapter.chapterNumber) ?? 0) + 1;
      chapterParagraphCounts.set(chapter.chapterNumber, paragraphIndexInChapter);
      const paragraphId = `tbp_${sourceId}_${page.pageNumber}_${paragraphIndexInChapter}`;
      const paragraph: TextbookParagraphRecord = {
        id: paragraphId,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
        paragraphIndexInChapter,
        pageNumber: page.pageNumber,
        text: paragraphText,
        sentences: splitSentences(paragraphText),
      };
      paragraphs.push(paragraph);
      chapter.paragraphIds.push(paragraphId);
    }
  }

  return {
    sourceId,
    chapters,
    paragraphs,
    totalPages,
    chapterSource,
  };
}

function buildFallbackReaderDocument(sourceId: string, rawText: string): TextbookReaderDocument {
  const chapterBlocks = splitChapterBlocks(rawText);
  const paragraphs: TextbookParagraphRecord[] = [];
  const chapters: TextbookChapterRecord[] = [];
  let consumedChars = 0;

  chapterBlocks.forEach((block, chapterIndex) => {
    const chapterNumber = chapterIndex + 1;
    const chapterParagraphIds: string[] = [];
    const chapterParagraphs = paragraphsFromBlock(block.body);
    const chapterStartPage = Math.floor(consumedChars / PAGE_CHAR_BUDGET) + 1;
    chapterParagraphs.forEach((paragraphText, paragraphIndex) => {
      const paragraphId = `tbp_${sourceId}_${chapterNumber}_${paragraphIndex + 1}`;
      const pageNumber = Math.floor(consumedChars / PAGE_CHAR_BUDGET) + 1;
      paragraphs.push({
        id: paragraphId,
        chapterNumber,
        chapterTitle: block.title,
        paragraphIndexInChapter: paragraphIndex + 1,
        pageNumber,
        text: paragraphText,
        sentences: splitSentences(paragraphText),
      });
      chapterParagraphIds.push(paragraphId);
      consumedChars += paragraphText.length + 2;
    });
    const chapterEndPage = Math.max(
      chapterStartPage,
      Math.floor(Math.max(consumedChars - 1, 0) / PAGE_CHAR_BUDGET) + 1,
    );
    chapters.push({
      chapterNumber,
      title: block.title,
      startPage: chapterStartPage,
      endPage: chapterEndPage,
      paragraphIds: chapterParagraphIds,
    });
  });

  const totalPages = chapters.at(-1)?.endPage ?? 1;
  return {
    sourceId,
    chapters:
      chapters.length > 0
        ? chapters
        : [
            {
              chapterNumber: 1,
              title: "Document",
              startPage: 1,
              endPage: totalPages,
              paragraphIds: [],
            },
          ],
    paragraphs,
    totalPages,
    chapterSource: "fallback",
  };
}

export function buildTextbookReaderDocument(
  sourceId: string,
  rawText: string,
  seed?: TextbookReaderSeed,
): TextbookReaderDocument {
  if (seed?.pageTexts.length) {
    return buildPageBackedReaderDocument(sourceId, seed);
  }
  return buildFallbackReaderDocument(sourceId, rawText);
}
