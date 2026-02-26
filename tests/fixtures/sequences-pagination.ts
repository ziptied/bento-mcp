import type { BentoSequence } from "../../src/sequence-resolution";

type PagedSequences = Record<number, BentoSequence[]>;

export function createPagesWithMatchOnPage({
  matchPage,
  matchName,
}: {
  matchPage: number;
  matchName: string;
}): PagedSequences {
  const pages: PagedSequences = {};

  for (let page = 1; page <= matchPage; page += 1) {
    pages[page] = [
      {
        id: `sequence_${page}_a`,
        attributes: { name: `Sequence ${page} A` },
      },
      {
        id: `sequence_${page}_b`,
        attributes: { name: `Sequence ${page} B` },
      },
    ];
  }

  pages[matchPage].push({
    id: `sequence_match_page_${matchPage}`,
    attributes: { name: matchName },
  });

  return pages;
}

export function createNearMatchThenExactPages(): PagedSequences {
  return {
    1: [
      {
        id: "sequence_near_match",
        attributes: { name: "Welcome Flow Extended" },
      },
    ],
    2: [
      {
        id: "sequence_exact_match",
        attributes: { name: "  WELCOME FLOW  " },
      },
    ],
  };
}

export function createNoMatchPages(): PagedSequences {
  return {
    1: [
      {
        id: "sequence_first",
        attributes: { name: "Welcome Sequence" },
      },
    ],
    2: [
      {
        id: "sequence_second",
        attributes: { name: "Post Purchase" },
      },
    ],
    3: [
      {
        id: "sequence_third",
        attributes: { name: "Newsletter" },
      },
    ],
  };
}
