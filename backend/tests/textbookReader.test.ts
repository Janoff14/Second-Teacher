import { describe, expect, it } from "vitest";
import { buildTextbookReaderDocument } from "../src/lib/textbookReader";

describe("buildTextbookReaderDocument", () => {
  it("uses outline page numbers to build chapter jumps", () => {
    const readerDoc = buildTextbookReaderDocument("src_1", "", {
      totalPages: 6,
      pageTexts: [
        { pageNumber: 1, text: "Cover and credits" },
        { pageNumber: 2, text: "Preface and table of contents" },
        { pageNumber: 3, text: "Light energy enters the leaf." },
        { pageNumber: 4, text: "Chlorophyll captures photons." },
        { pageNumber: 5, text: "Cell respiration connects to ATP." },
        { pageNumber: 6, text: "Practice questions and review." },
      ],
      outline: [
        { title: "Chapter 1: Photosynthesis", pageNumber: 3, depth: 1 },
        { title: "Chapter 2: Respiration", pageNumber: 5, depth: 1 },
      ],
    });

    expect(readerDoc.chapterSource).toBe("outline");
    expect(
      readerDoc.chapters.map((chapter) => ({
        title: chapter.title,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
      })),
    ).toEqual([
      { title: "Opening pages", startPage: 1, endPage: 2 },
      { title: "Chapter 1: Photosynthesis", startPage: 3, endPage: 4 },
      { title: "Chapter 2: Respiration", startPage: 5, endPage: 6 },
    ]);
    expect(readerDoc.paragraphs.find((paragraph) => paragraph.pageNumber === 5)?.chapterTitle).toBe(
      "Chapter 2: Respiration",
    );
  });

  it("falls back to heading detection when no outline is present", () => {
    const readerDoc = buildTextbookReaderDocument("src_2", "", {
      totalPages: 4,
      pageTexts: [
        { pageNumber: 1, text: "Chapter 1\nAtoms and molecules form matter." },
        { pageNumber: 2, text: "More examples from chapter one." },
        { pageNumber: 3, text: "Chapter 2\nChemical reactions rearrange bonds." },
        { pageNumber: 4, text: "Review questions." },
      ],
    });

    expect(readerDoc.chapterSource).toBe("headings");
    expect(
      readerDoc.chapters.map((chapter) => ({
        title: chapter.title,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
      })),
    ).toEqual([
      { title: "Chapter 1", startPage: 1, endPage: 2 },
      { title: "Chapter 2", startPage: 3, endPage: 4 },
    ]);
    expect(readerDoc.paragraphs.find((paragraph) => paragraph.pageNumber === 3)?.chapterNumber).toBe(2);
  });
});
