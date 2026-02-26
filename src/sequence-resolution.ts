export type BentoSequence = {
  id: string;
  attributes?: {
    name?: string;
  };
};

type GetSequences = (params: { page: number }) => Promise<
  BentoSequence[] | null | undefined
>;

type ResolveSequenceIdInput = {
  sequenceId?: string;
  sequenceName?: string;
  getSequences: GetSequences;
};

const MAX_SEQUENCE_PAGES = 100;

function normalizeName(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
}

export async function resolveSequenceId({
  sequenceId,
  sequenceName,
  getSequences,
}: ResolveSequenceIdInput): Promise<string | null> {
  const normalizedSequenceId = sequenceId?.trim();
  if (normalizedSequenceId) {
    return normalizedSequenceId;
  }

  const normalizedSequenceName = normalizeName(sequenceName);
  if (!normalizedSequenceName) {
    return null;
  }

  let page = 1;
  while (page <= MAX_SEQUENCE_PAGES) {
    const sequences = await getSequences({ page });
    if (!sequences || sequences.length === 0) {
      return null;
    }

    const match = sequences.find(
      (sequence) =>
        normalizeName(sequence.attributes?.name) === normalizedSequenceName,
    );

    if (match) {
      return match.id;
    }

    page += 1;
  }

  return null;
}
