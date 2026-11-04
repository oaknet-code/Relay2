// How a dispatch line is named on the packing list and receipt: by what the
// part is (its description), falling back to type · model for older lines.
export const lineLabel = (line) => line?.description || `${line?.type} · ${line?.model}`;
