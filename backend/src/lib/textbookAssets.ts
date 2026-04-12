import { existsSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type SupportedSourceFormat = "pdf" | "docx" | "doc" | "txt";

const TEXTBOOK_ASSET_DIR = path.resolve(process.cwd(), ".local", "textbook-assets");

function extensionFromSourceFormat(sourceFormat?: SupportedSourceFormat): string {
  switch (sourceFormat) {
    case "pdf":
      return ".pdf";
    case "docx":
      return ".docx";
    case "doc":
      return ".doc";
    case "txt":
      return ".txt";
    default:
      return ".bin";
  }
}

function extensionFromOriginalFileName(originalFileName?: string): string {
  const ext = path.extname(originalFileName ?? "").toLowerCase();
  return ext || "";
}

function extensionForAsset(originalFileName?: string, sourceFormat?: SupportedSourceFormat): string {
  return extensionFromOriginalFileName(originalFileName) || extensionFromSourceFormat(sourceFormat);
}

function mimeTypeFromExtension(ext: string): string {
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".doc":
      return "application/msword";
    case ".md":
    case ".markdown":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function getTextbookAssetPath(params: {
  sourceId: string;
  originalFileName?: string;
  sourceFormat?: SupportedSourceFormat;
}): string {
  const ext = extensionForAsset(params.originalFileName, params.sourceFormat);
  return path.join(TEXTBOOK_ASSET_DIR, `${params.sourceId}${ext}`);
}

export function getTextbookAssetInfo(params: {
  sourceId: string;
  originalFileName?: string;
  sourceFormat?: SupportedSourceFormat;
}): { path: string; fileName: string; mimeType: string } | null {
  const assetPath = getTextbookAssetPath(params);
  if (!existsSync(assetPath)) {
    return null;
  }
  const ext = extensionForAsset(params.originalFileName, params.sourceFormat);
  return {
    path: assetPath,
    fileName: params.originalFileName ?? `${params.sourceId}${ext}`,
    mimeType: mimeTypeFromExtension(ext),
  };
}

export async function saveTextbookAsset(params: {
  sourceId: string;
  buffer: Buffer;
  originalFileName?: string;
  sourceFormat?: SupportedSourceFormat;
}): Promise<{ path: string; fileName: string; mimeType: string }> {
  await mkdir(TEXTBOOK_ASSET_DIR, { recursive: true });
  const assetPath = getTextbookAssetPath(params);
  await writeFile(assetPath, params.buffer);
  const ext = extensionForAsset(params.originalFileName, params.sourceFormat);
  return {
    path: assetPath,
    fileName: params.originalFileName ?? `${params.sourceId}${ext}`,
    mimeType: mimeTypeFromExtension(ext),
  };
}

export function clearLocalTextbookAssetsForTest(): void {
  if (existsSync(TEXTBOOK_ASSET_DIR)) {
    rmSync(TEXTBOOK_ASSET_DIR, { recursive: true, force: true });
  }
}
