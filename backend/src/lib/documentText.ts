import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

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

  switch (ext) {
    case ".pdf":
      sourceFormat = "pdf";
      rawText = await extractPdfText(file.buffer);
      break;
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
  };
}
