// How a dispatch line is named on the packing list and receipt: by what the
// part is (its description), falling back to type · model for older lines.
export const lineLabel = (line) => line?.description || `${line?.type} · ${line?.model}`;

// Where a released dispatch is in the driver's trip.
export function tripStage(dispatch) {
  if (dispatch.status === "RECEIVED") return "delivered";
  if (!dispatch.trip?.pickedUpAt) return "collect";
  if (!dispatch.trip?.arrivedAt) return "on_the_way";
  return "at_site";
}
