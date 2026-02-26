import { describe, expect, test } from "bun:test";
import { resolveSequenceId } from "../src/sequence-resolution";
import {
  createNearMatchThenExactPages,
  createNoMatchPages,
  createPagesWithMatchOnPage,
} from "./fixtures/sequences-pagination";

function buildGetSequencesFromPages(
  pages: Record<number, { id: string; attributes?: { name?: string } }[]>,
) {
  const requestedPages: number[] = [];

  return {
    requestedPages,
    getSequences: async ({ page }: { page: number }) => {
      requestedPages.push(page);
      return pages[page] ?? [];
    },
  };
}

describe("resolveSequenceId", () => {
  test("returns provided sequenceId directly without paginating", async () => {
    const { requestedPages, getSequences } = buildGetSequencesFromPages({});

    const resolved = await resolveSequenceId({
      sequenceId: "  sequence_abc123  ",
      getSequences,
    });

    expect(resolved).toBe("sequence_abc123");
    expect(requestedPages).toEqual([]);
  });

  test("finds a sequence name beyond page 10", async () => {
    const { requestedPages, getSequences } = buildGetSequencesFromPages(
      createPagesWithMatchOnPage({
        matchPage: 11,
        matchName: "  Welcome Campaign  ",
      }),
    );

    const resolved = await resolveSequenceId({
      sequenceName: "welcome campaign",
      getSequences,
    });

    expect(resolved).toBe("sequence_match_page_11");
    expect(requestedPages).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  test("returns null only after pagination is exhausted", async () => {
    const { requestedPages, getSequences } = buildGetSequencesFromPages(
      createNoMatchPages(),
    );

    const resolved = await resolveSequenceId({
      sequenceName: "does not exist",
      getSequences,
    });

    expect(resolved).toBeNull();
    expect(requestedPages).toEqual([1, 2, 3, 4]);
  });

  test("uses exact normalized name equality (no partial matches)", async () => {
    const { requestedPages, getSequences } = buildGetSequencesFromPages(
      createNearMatchThenExactPages(),
    );

    const resolved = await resolveSequenceId({
      sequenceName: "welcome flow",
      getSequences,
    });

    expect(resolved).toBe("sequence_exact_match");
    expect(requestedPages).toEqual([1, 2]);
  });
});
