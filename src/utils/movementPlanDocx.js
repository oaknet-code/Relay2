import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

// The approved movement plan as a Word document, laid out like Oaknet's
// movement plan template (Oaknet_Movement_Plan_*.docx): A4 landscape,
// Calibri, navy headings, numbered sections each with a one-line summary and
// a table (navy header row, pale-blue first column, 9 pt), a sign-off table
// and "Oaknet Movement Plan · Page N" in the footer.

const NAVY = "1F3864";
const PALE = "D9E2F3";
const FULL = 15398; // usable width of A4 landscape with 0.5" margins (dxa)
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "auto" };
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 };

const dateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};
const asDate = (value) => new Date(`${dateKey(value)}T00:00:00.000Z`);
// "30 Oct 2026"
const longDate = (value) => (dateKey(value) ? asDate(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "");
// "30 October 2026"
const fullDate = (value) => (dateKey(value) ? asDate(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
// "Fri 30 Oct"
const dayLabel = (value) => (dateKey(value) ? asDate(value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "") : "");
const text = (value) => (value === null || value === undefined ? "" : String(value));

// "T01–T03" for consecutive trip ids, "T01, T03" otherwise.
function tripRange(ids) {
  const sorted = [...new Set(ids)].sort();
  const num = (id) => Number(String(id).replace(/\D/g, ""));
  const out = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i += 1) {
    if (i < sorted.length && num(sorted[i]) === num(sorted[i - 1]) + 1) continue;
    out.push(i - 1 - start >= 2 ? `${sorted[start]}–${sorted[i - 1]}` : sorted.slice(start, i).join(", "));
    start = i;
  }
  return out.join(", ");
}

function assignmentsOf(trip) {
  if (trip.assignments?.length) return trip.assignments;
  return trip.vehicleId ? [{ vehicleId: trip.vehicleId, vehicle: trip.vehicle, driverId: trip.driverId, driverName: trip.driverName }] : [];
}

// ── Building blocks ─────────────────────────────────────────────────
function cell(value, { header = false, first = false, width }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: NAVY } : first ? { type: ShadingType.CLEAR, color: "auto", fill: PALE } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text: text(value), bold: header || first, size: 18, color: header ? "FFFFFF" : undefined })],
    })],
  });
}

// widths: column widths in dxa (they set the table width too).
function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { header: true, width: widths[i] })) }),
      ...rows.map((row) => new TableRow({ children: row.map((v, i) => cell(v, { first: i === 0, width: widths[i] })) })),
    ],
  });
}

// Split the full width over columns by relative weights.
const spread = (weights, total = FULL) => {
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.floor((w / sum) * total));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  return widths;
};

const heading2 = (title) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun(title)] });
const note = (value) => new Paragraph({ spacing: { after: 120 }, children: value ? [new TextRun(value)] : [] });

// ── The document ────────────────────────────────────────────────────
export function buildMovementPlanDocument(plan) {
  const trips = [...(plan.trips || [])].sort((a, b) => String(a.tripId).localeCompare(String(b.tripId)));
  const team = plan.team || [];
  const teamById = new Map(team.map((p) => [String(p.userId), p]));
  const start = trips.reduce((min, t) => (!min || t.startDate < min ? t.startDate : min), "");
  const end = trips.reduce((max, t) => (!max || t.endDate > max ? t.endDate : max), "");
  const preparedBy = plan.preparedBy?.name || "";
  const title = /^oaknet movement plan/i.test(plan.title || "") ? plan.title : `Oaknet Movement Plan — ${plan.title || plan.reference}`;
  // Destinations away from base (not the trips back home).
  const isBase = (name) => Boolean(name) && (name === trips[0]?.originName || (plan.base || "").toLowerCase().includes(String(name).toLowerCase()));
  const destinations = [...new Set(trips.map((t) => t.destinationName).filter((name) => name && !isBase(name)))];

  // Vehicles used, with the trips each one runs.
  const vehicles = new Map();
  for (const trip of trips) {
    for (const a of assignmentsOf(trip)) {
      const key = String(a.vehicleId || a.vehicle?.plate || "");
      if (!key) continue;
      const v = vehicles.get(key) || { plate: a.vehicle?.plate || "", make: a.vehicle?.make || "", body: a.vehicle?.body || "", drivers: new Set(), trips: [] };
      if (a.driverName) v.drivers.add(a.driverName);
      v.trips.push(trip.tripId);
      vehicles.set(key, v);
    }
  }
  const vehicleList = [...vehicles.entries()];
  const platesOf = (trip) => assignmentsOf(trip).map((a) => a.vehicle?.plate || vehicles.get(String(a.vehicleId))?.plate).filter(Boolean);

  // Every day of the plan, for the allocation table.
  const days = [];
  if (start && end) {
    for (let d = asDate(start); d <= asDate(end); d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
  }

  // Organisation: the company (Oaknet, a client, a contractor). Plans saved
  // before this showed the person's role there; staff roles read as Oaknet.
  const STAFF_ROLES = /^(super admin|ceo|admin|project manager|site engineer|driver|field worker|site manager|warehouse manager|warehouse operator)$/i;
  const organisationOf = (p) => (!p.organisation || STAFF_ROLES.test(p.organisation.trim()) ? (p.external ? "External" : "Oaknet") : p.organisation);
  const passengersText = (trip) => {
    const ids = (trip.passengerIds || []).map(String);
    if (team.length && ids.length === team.length) return `Full team (${team.length})`;
    return ids.map((id) => teamById.get(id)?.name).filter(Boolean).join(", ");
  };

  const ROLE_LABEL = { project_manager: "Project Manager", ceo: "CEO" };
  const STATUS_LABEL = { approved: "Approved", rejected: "Rejected", pending: "Pending" };

  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(title)] }),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `Date: ${fullDate(plan.submittedAt || plan.createdAt || start)}   Prepared by: ${preparedBy}`, italics: true })],
    }),

    heading2("1. Plan details"),
    ...(plan.summary ? [note(plan.summary)] : []),
    table(["Field", "Entry"], [
      ["Plan reference", plan.reference],
      ["Project / activity", plan.project],
      ["Movement period", start ? `${longDate(start)} – ${longDate(end)}` : ""],
      ["Base", plan.base],
      ["Destinations", destinations.join(", ")],
      ["Prepared by", preparedBy],
    ], [3849, 11549]),

    heading2("2. Team roster"),
    table(["#", "Name", "Organisation", "Trips"], team.map((p, i) => [
      i + 1,
      p.name,
      organisationOf(p),
      tripRange(trips.filter((t) => (t.passengerIds || []).some((id) => String(id) === String(p.userId))).map((t) => t.tripId)),
    ]), [565, 2825, 2825, 2827]),

    heading2("3. Vehicle register"),
    table(["Reg no.", "Model", "Assigned driver", "Trips"], vehicleList.map(([, v]) => [
      v.plate,
      [v.make, v.body ? v.body.toLowerCase() : ""].filter(Boolean).join(" "),
      [...v.drivers].join(", "),
      [...new Set(v.trips)].sort().join(", "),
    ]), [1906, 3226, 2932, 3226]),

    heading2("4. Movement schedule"),
    table(["Trip", "Date", "Route", "Purpose", "Vehicle", "Passengers", "Depart", "Overnight", "Outside Nairobi Metro"], trips.map((t) => [
      t.tripId,
      t.startDate === t.endDate ? dayLabel(t.startDate) : `${dayLabel(t.startDate)} – ${dayLabel(t.endDate)}`,
      t.originName === t.destinationName ? `${t.originName} (local)` : `${t.originName} → ${t.destinationName}`,
      t.purpose,
      platesOf(t).join(" + "),
      passengersText(t),
      t.departTime,
      t.overnight || "None",
      t.outsideMetro ? "Yes" : "No",
    ]), [727, 1818, 2182, 2667, 2182, 2303, 1091, 1212, 1216]),

    heading2("5. Vehicle allocation by day"),
    table(["Vehicle", ...days.map(dayLabel)], vehicleList.map(([key, v]) => [
      v.plate,
      ...days.map((day) => {
        // On a day with two trips (e.g. the last day of a stay and the trip
        // home), show the one that starts that day.
        const trip = trips
          .filter((t) => day >= t.startDate && day <= t.endDate && assignmentsOf(t).some((a) => String(a.vehicleId || a.vehicle?.plate || "") === key))
          .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];
        if (!trip) return "Available";
        return trip.originName === trip.destinationName ? `${trip.originName} (${(trip.purpose || "local").toLowerCase()})` : `${trip.originName} → ${trip.destinationName}`;
      }),
    ]), days.length ? spread([1.1, ...days.map(() => 1)]) : [FULL]),

    heading2("6. Accommodation and logistics"),
    table(["Location", "Nights", "Pax", "Person-nights", "Venue", "Booking ref", "Arranged by"], (plan.accommodation || []).map((r) => [
      r.location, r.nights, r.pax, r.personNights, r.venue, r.booking, r.arrangedBy,
    ]), [2085, 2405, 1122, 1764, 3207, 2405, 2410]),
    note(""),
    table(["Item", "Detail", "Responsible"], (plan.logistics || []).map((r) => [r.item, r.detail, r.responsible]), [3299, 8798, 3301]),

    heading2("7. Approvals"),
    table(["Role", "Name", "Decision", "Date", "Comment"], [
      ["Prepared by", preparedBy, "Submitted", plan.submittedAt ? longDate(plan.submittedAt) : "", ""],
      ...(plan.approvals || []).map((a) => [
        ROLE_LABEL[a.role] || "Approver",
        a.approverName,
        STATUS_LABEL[a.status] || a.status,
        a.decidedAt ? longDate(a.decidedAt) : "",
        a.comment,
      ]),
    ], [2887, 3600, 1900, 2000, 5011]),
    new Paragraph({}),
  ];

  return new Document({
    creator: "Relay · Oaknet Business Limited",
    title,
    styles: {
      default: { document: { run: { font: "Calibri" } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { bold: true, color: NAVY, size: 32 }, paragraph: { spacing: { after: 120 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { bold: true, color: NAVY, size: 24 }, paragraph: { outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          // A4 landscape (docx swaps width/height for landscape).
          size: { orientation: "landscape", width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ children: ["Oaknet Movement Plan · Page ", PageNumber.CURRENT], size: 16 })],
          })],
        }),
      },
      children,
    }],
  });
}
