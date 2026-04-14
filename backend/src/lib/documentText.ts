import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import type { TextbookOutlineEntry, TextbookPageText, TextbookReaderSeed } from "./textbookReader";

type UploadedFileLike = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

type WordDocument = {
  getBody(): string;
};

type WordExtractorInstance = {
  extract(input: Buffer): Promise<WordDocument>;
};

const WordExtractorCtor = require("word-extractor") as new () => WordExtractorInstance;

export interface ExtractedDocumentText {
  text: string;
  originalFileName: string;
  sourceFormat: "pdf" | "docx" | "doc" | "txt";
  suggestedTitle: string;
  readerSeed?: TextbookReaderSeed;
}

function baseNameWithoutExtension(fileName: string): string {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext).replace(/[_-]+/g, " ").trim();
  return stem || "Uploaded textbook";
}

function normalizeExtractedText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function unsupportedFormatError(fileName: string): never {
  const err = new Error(
    `Unsupported file type for "${fileName}". Upload a PDF, DOCX, DOC, TXT, or Markdown textbook.`,
  ) as Error & { statusCode?: number; code?: string };
  err.statusCode = 400;
  err.code = "UNSUPPORTED_FILE_TYPE";
  throw err;
}

function emptyExtractionError(fileName: string): never {
  const err = new Error(
    `We could not extract readable text from "${fileName}". Try a text-based PDF or Word file.`,
  ) as Error & { statusCode?: number; code?: string };
  err.statusCode = 400;
  err.code = "EMPTY_SOURCE";
  throw err;
}

type PdfTextItemLike = {
  str?: string;
  transform?: number[];
  hasEOL?: boolean;
};

type PdfOutlineItemLike = {
  title?: string;
  dest?: unknown;
  items?: PdfOutlineItemLike[];
};

function normalizePdfPageText(input: string): string {
  return input
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderPdfTextItems(items: PdfTextItemLike[]): string {
  const lines: string[] = [];
  let currentLine: string[] = [];
  let lastY: number | null = null;

  const flush = () => {
    const line = currentLine.join(" ").replace(/\s{2,}/g, " ").trim();
    if (line) {
      lines.push(line);
    }
    currentLine = [];
  };

  for (const item of items) {
    const y: number | null =
      Array.isArray(item.transform) && typeof item.transform[5] === "number"
        ? item.transform[5]
        : lastY;
    if (
      currentLine.length > 0 &&
      lastY !== null &&
      typeof y === "number" &&
      Math.abs(y - lastY) > 2.5
    ) {
      flush();
    }

    const text = typeof item.str === "string" ? item.str.replace(/\s+/g, " ").trim() : "";
    if (text) {
      currentLine.push(text);
    }

    if (item.hasEOL) {
      flush();
      lastY = null;
      continue;
    }

    lastY = typeof y === "number" ? y : lastY;
  }

  if (currentLine.length > 0) {
    flush();
  }

  return normalizePdfPageText(lines.join("\n"));
}

async function resolvePdfDestinationPageNumber(
  pdfDocument: {
    getDestination(dest: string): Promise<unknown>;
    getPageIndex(ref: unknown): Promise<number>;
  },
  dest: unknown,
): Promise<number | null> {
  let destination = dest;
  if (typeof destination === "string") {
    destination = await pdfDocument.getDestination(destination);
  }
  if (!Array.isArray(destination) || destination.length === 0) {
    return null;
  }

  const pageRef = destination[0];
  if (typeof pageRef === "number" && Number.isFinite(pageRef)) {
    return pageRef + 1;
  }
  if (pageRef && typeof pageRef === "object") {
    const pageIndex = await pdfDocument.getPageIndex(pageRef);
    return pageIndex + 1;
  }
  return null;
}

async function flattenPdfOutline(
  pdfDocument: {
    getDestination(dest: string): Promise<unknown>;
    getPageIndex(ref: unknown): Promise<number>;
  },
  items: PdfOutlineItemLike[] | null | undefined,
  depth = 0,
  out: TextbookOutlineEntry[] = [],
): Promise<TextbookOutlineEntry[]> {
  if (!items?.length) {
    return out;
  }

  for (const item of items) {
    const title = typeof item.title === "string" ? item.title.replace(/\s+/g, " ").trim() : "";
    try {
      const pageNumber =
        item.dest !== undefined
          ? await resolvePdfDestinationPageNumber(pdfDocument, item.dest)
          : null;
      if (title && pageNumber !== null) {
        out.push({ title, pageNumber, depth });
      }
    } catch {
      // Ignore individual outline entries we cannot resolve.
    }
    if (item.items?.length) {
      await flattenPdfOutline(pdfDocument, item.items, depth + 1, out);
    }
  }
  return out;
}

async function extractPdfDocument(buffer: Buffer): Promise<{
  text: string;
  readerSeed: TextbookReaderSeed;
}> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
  });

  try {
    const pdfDocument = await loadingTask.promise;
    const pageTexts: TextbookPageText[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = renderPdfTextItems(textContent.items as PdfTextItemLike[]);
      pageTexts.push({ pageNumber, text: pageText });
    }

    const outline = await flattenPdfOutline(
      pdfDocument,
      (await pdfDocument.getOutline()) as PdfOutlineItemLike[] | null | undefined,
    );
    const text = normalizeExtractedText(pageTexts.map((page) => page.text).filter(Boolean).join("\n\n"));

    return {
      text,
      readerSeed: {
        pageTexts,
        outline,
        totalPages: pdfDocument.numPages,
      },
    };
  } finally {
    await loadingTask.destroy();
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractDocText(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractorCtor();
  const doc = await extractor.extract(buffer);
  return doc.getBody();
}

export async function extractTextFromUploadedDocument(
  file: UploadedFileLike,
): Promise<ExtractedDocumentText> {
  const ext = extensionOf(file.originalname);
  let rawText = "";
  let sourceFormat: ExtractedDocumentText["sourceFormat"];
  let readerSeed: TextbookReaderSeed | undefined;

  switch (ext) {
    case ".pdf": {
      sourceFormat = "pdf";
      try {
        const extracted = await extractPdfDocument(file.buffer);
        rawText = extracted.text;
        readerSeed = extracted.readerSeed;
      } catch {
        // Fallback for PDFs that fail deep page/outline parsing in pdfjs.
        // This keeps upload usable and searchable, even if reader seed is unavailable.
        rawText = await extractPdfText(file.buffer);
      }
      break;
    }
    case ".docx":
      sourceFormat = "docx";
      rawText = await extractDocxText(file.buffer);
      break;
    case ".doc":
      sourceFormat = "doc";
      rawText = await extractDocText(file.buffer);
      break;
    case ".txt":
    case ".md":
    case ".markdown":
      sourceFormat = "txt";
      rawText = file.buffer.toString("utf8");
      break;
    default:
      unsupportedFormatError(file.originalname);
  }

  const text = normalizeExtractedText(rawText);
  if (!text) {
    emptyExtractionError(file.originalname);
  }

  return {
    text,
    originalFileName: file.originalname,
    sourceFormat,
    suggestedTitle: baseNameWithoutExtension(file.originalname),
    ...(readerSeed ? { readerSeed } : {}),
  };
}
