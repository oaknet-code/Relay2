import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  VerticalAlign,
  WidthType,
} from "docx";
import { Check, Download, FileText, Plus, Send, Trash2 } from "lucide-react";
import {
  createMovementPlan,
  decideMovementPlan,
  getApprovedMovementPlan,
  getMovementPlanOptions,
  getMovementPlans,
  publishMovementPlan,
  submitMovementPlan,
  updateMovementPlan,
} from "../services/api";

const STANDARD_SUMMARY =
  "This plan records the team, vehicles, movement schedule, accommodation, and logistics for the planned movement.";
const EMPTY_LIST = [];
const EDIT_ROLES = new Set(["super_admin", "site_engineer", "warehouse_manager"]);
const EMPTY_FORM = {
  title: "Oaknet Movement Plan",
  project: "",
  base: "",
  teamUserIds: [],
  trips: [],
  accommodation: [],
  logistics: [],
};
const ACCOMMODATION_FIELDS = [
  ["location", "Location"],
  ["nights", "Nights"],
  ["pax", "Pax"],
  ["personNights", "Person-nights"],
  ["venue", "Venue"],
  ["booking", "Booking reference"],
  ["arrangedBy", "Arranged by"],
];
const LOGISTICS_FIELDS = [
  ["item", "Item"],
  ["detail", "Detail"],
  ["responsible", "Responsible"],
];

const dateKey = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const dateRange = (start, end) => {
  const first = dateKey(start);
  const last = dateKey(end);
  if (!first || !last || last < first) return [];
  const values = [];
  const cursor = new Date(`${first}T00:00:00.000Z`);
  while (cursor.toISOString().slice(0, 10) <= last && values.length <= 366) {
    values.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return values.length <= 366 ? values : [];
};

const displayDate = (value) => {
  if (!value) return "—";
  return new Date(`${dateKey(value)}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const errorMessage = (error) =>
  error.response?.data?.message || error.message || "Movement plan request failed.";

function formFromPlan(plan, sites) {
  return {
    title: plan.title || "",
    project: plan.project || "",
    base: plan.base || "",
    teamUserIds: (plan.team || []).map((person) => String(person.userId)),
    trips: (plan.trips || []).map((trip) => ({
      startDate: dateKey(trip.startDate),
      endDate: dateKey(trip.endDate),
      originType: trip.originType || "base",
      originSiteId: trip.originSiteRef
        ? String(trip.originSiteRef)
        : String(sites.find((site) => site.siteId === trip.originSiteId)?._id || ""),
      destinationSiteId: trip.destinationId
        ? String(trip.destinationId)
        : String(sites.find((site) => site.siteId === trip.destinationSiteId)?._id || ""),
      purpose: trip.purpose || "",
      vehicleId: String(trip.vehicleId || ""),
      driverId: String(trip.driverId || ""),
      passengerIds: (trip.passengerIds || []).map(String),
      departTime: trip.departTime || "",
      overnight: trip.overnight || "",
    })),
    accommodation: (plan.accommodation || []).map((row) => ({ ...row })),
    logistics: (plan.logistics || []).map((row) => ({ ...row })),
  };
}

function tableCell(value, header = false) {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
  };
  return new TableCell({
    borders,
    shading: header ? { type: ShadingType.CLEAR, fill: "EAF0F6" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { before: 30, after: 30 },
        children: [{
          text: String(value || "—"),
          bold: header,
          font: "Arial",
          size: 16,
          color: header ? "19344F" : "263746",
        }],
      }),
    ],
  });
}

function documentTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((header) => tableCell(header, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((value) => tableCell(value)) })),
    ],
  });
}

function documentSection(title, headers, rows) {
  return [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
    }),
    documentTable(headers, rows),
  ];
}

function TextInput({ label, value, onChange, disabled = false, type = "text", required = false }) {
  return (
    <label className="mp-field">
      <span>{label}</span>
      <input
        className="form-input mp-input"
        type={type}
        value={value || ""}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SelectInput({ label, value, onChange, options, disabled = false, required = false }) {
  return (
    <label className="mp-field">
      <span>{label}</span>
      <select
        className="form-input mp-input"
        value={value || ""}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditableRows({ label, fields, rows, disabled, onChange, onAdd, onRemove }) {
  return (
    <div className="mp-table-scroll">
      <table className="mp-edit-table">
        <thead>
          <tr>{fields.map(([, title]) => <th key={title}>{title}</th>)}<th aria-label="Actions" /></tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${label}-${rowIndex}`}>
              {fields.map(([key, title]) => (
                <td key={key}>
                  <input
                    className="form-input mp-input"
                    aria-label={`${title}, row ${rowIndex + 1}`}
                    placeholder={title}
                    value={row[key] || ""}
                    disabled={disabled}
                    onChange={(event) => onChange(rowIndex, key, event.target.value)}
                  />
                </td>
              ))}
              <td className="mp-action-cell">
                {!disabled && (
                  <button className="iconbtn" type="button" aria-label={`Remove ${label} row ${rowIndex + 1}`} onClick={() => onRemove(rowIndex)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="mp-empty-row" colSpan={fields.length + 1}>No entries yet.</td></tr>
          )}
        </tbody>
      </table>
      {!disabled && (
        <button className="btn sm ghost mp-add-row" type="button" onClick={onAdd}>
          <Plus size={14} /> Add row
        </button>
      )}
    </div>
  );
}

export function MovementPlanPage({ user }) {
  const [options, setOptions] = useState({ sites: [], vehicles: [], drivers: [], teamMembers: [], reservations: [] });
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalComment, setApprovalComment] = useState("");

  const canPrepare = EDIT_ROLES.has(user?.role);
  const canEdit = Boolean(plan?.canEditDraft && canPrepare);

  const refresh = useCallback(async (selectedId) => {
    setLoading(true);
    setError("");
    try {
      const [nextOptions, nextPlans] = await Promise.all([
        getMovementPlanOptions({
          from: dateKey(new Date()),
          to: dateKey(new Date(Date.now() + 366 * 24 * 60 * 60 * 1000)),
        }),
        getMovementPlans(),
      ]);
      setOptions(nextOptions);
      setPlans(nextPlans);
      const selected = nextPlans.find((item) => item._id === selectedId) || nextPlans[0] || null;
      setPlan(selected);
      setForm(selected ? formFromPlan(selected, nextOptions.sites) : EMPTY_FORM);
      setDirty(false);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(null);
  }, [refresh]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice("");
  };

  const selectPlan = (selected) => {
    setPlan(selected);
    setForm(formFromPlan(selected, options.sites));
    setDirty(false);
    setError("");
    setNotice("");
  };

  const createDraft = async () => {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const created = await createMovementPlan();
      await refresh(created._id);
      setNotice(`Draft ${created.reference} created.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const payload = {
    title: form.title,
    project: form.project,
    base: form.base,
    summary: STANDARD_SUMMARY,
    teamUserIds: form.teamUserIds,
    trips: form.trips.map((trip) => ({
      startDate: trip.startDate,
      endDate: trip.endDate,
      originType: trip.originType,
      originSiteId: trip.originSiteId,
      destinationSiteId: trip.destinationSiteId,
      purpose: trip.purpose,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      passengerIds: trip.passengerIds,
      departTime: trip.departTime,
      overnight: trip.overnight,
    })),
    accommodation: form.accommodation,
    logistics: form.logistics,
  };

  const saveDraft = async () => {
    if (!plan) return null;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const saved = await updateMovementPlan(plan._id, payload);
      setPlan(saved);
      setPlans((current) => current.map((item) => item._id === saved._id ? saved : item));
      setForm(formFromPlan(saved, options.sites));
      setDirty(false);
      setNotice(`Draft ${saved.reference} saved.`);
      return saved;
    } catch (requestError) {
      setError(errorMessage(requestError));
      return null;
    } finally {
      setWorking(false);
    }
  };

  const submitForApproval = async () => {
    if (!plan) return;
    const saved = dirty ? await saveDraft() : plan;
    if (!saved) return;
    setWorking(true);
    setError("");
    try {
      const submitted = await submitMovementPlan(saved._id);
      await refresh(submitted._id);
      setNotice(`${submitted.reference} submitted to every assigned super admin for approval.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const decide = async (decision) => {
    if (!plan) return;
    setWorking(true);
    setError("");
    try {
      const updated = await decideMovementPlan(plan._id, decision, approvalComment);
      await refresh(updated._id);
      setApprovalComment("");
      setNotice(decision === "approved" ? "Approval recorded." : "Plan rejected and vehicle reservations released.");
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const publish = async () => {
    if (!plan) return;
    setWorking(true);
    setError("");
    try {
      const published = await publishMovementPlan(plan._id);
      await refresh(published._id);
      setNotice(`${published.reference} is now published for staff.`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const availableVehicles = options.vehicles || EMPTY_LIST;
  const selectedVehicles = useMemo(() => new Map(availableVehicles.map((vehicle) => [String(vehicle._id), vehicle])), [availableVehicles]);
  const selectedMembers = useMemo(
    () => new Map((options.teamMembers || []).map((member) => [String(member._id), member])),
    [options.teamMembers],
  );
  const planDates = useMemo(() => {
    const all = form.trips.flatMap((trip) => dateRange(trip.startDate, trip.endDate));
    return [...new Set(all)].sort();
  }, [form.trips]);

  const findTripConflict = (trip, rowIndex) => {
    if (!trip.vehicleId || !trip.startDate || !trip.endDate) return "";
    const days = dateRange(trip.startDate, trip.endDate);
    if (!days.length) return "Choose a valid date range no longer than 366 days.";
    const reservations = options.reservations || [];
    for (const date of days) {
      const booked = reservations.find((reservation) =>
        String(reservation.vehicleId) === String(trip.vehicleId) &&
        reservation.date === date &&
        reservation.reference !== plan?.reference
      );
      if (booked) return `${booked.reference} already uses this vehicle on ${displayDate(date)}.`;
      const otherTrip = form.trips.find((candidate, index) =>
        index !== rowIndex &&
        String(candidate.vehicleId) === String(trip.vehicleId) &&
        dateRange(candidate.startDate, candidate.endDate).includes(date)
      );
      if (otherTrip) return `This vehicle is already assigned to ${otherTrip.tripId || "another trip"} on ${displayDate(date)}.`;
      const driverId = trip.driverId || selectedVehicles.get(String(trip.vehicleId))?.driver?._id;
      const otherDriverTrip = form.trips.find((candidate, index) => {
        if (index === rowIndex || !dateRange(candidate.startDate, candidate.endDate).includes(date)) return false;
        const candidateDriverId = candidate.driverId || selectedVehicles.get(String(candidate.vehicleId))?.driver?._id;
        return driverId && String(candidateDriverId) === String(driverId);
      });
      if (otherDriverTrip) return `This driver is already assigned to ${otherDriverTrip.tripId || "another trip"} on ${displayDate(date)}.`;
      const driverBooked = reservations.find((reservation) =>
        driverId &&
        String(reservation.driverId) === String(driverId) &&
        reservation.date === date &&
        reservation.reference !== plan?.reference
      );
      if (driverBooked) return `${driverBooked.reference} already uses this driver on ${displayDate(date)}.`;
    }
    return "";
  };

  const tripConflicts = form.trips.map((trip, index) => findTripConflict(trip, index));
  const periodStart = planDates[0] || "";
  const periodEnd = planDates[planDates.length - 1] || "";
  const destinations = [...new Set(form.trips.map((trip) => {
    const site = options.sites.find((candidate) => String(candidate._id) === String(trip.destinationSiteId));
    return site ? `${site.siteId} — ${site.name}` : "";
  }).filter(Boolean))];

  useEffect(() => {
    if (!periodStart || !periodEnd) {
      setScheduleLoading(false);
      setScheduleError("");
      return undefined;
    }
    let active = true;
    setScheduleLoading(true);
    setScheduleError("");
    getMovementPlanOptions({ from: periodStart, to: periodEnd })
      .then((result) => {
        if (active) setOptions((current) => ({ ...current, reservations: result.reservations }));
      })
      .catch((requestError) => {
        if (active) {
          setScheduleError(errorMessage(requestError));
          setError(errorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setScheduleLoading(false);
      });
    return () => { active = false; };
  }, [periodStart, periodEnd]);
  const assignedVehicles = useMemo(() => {
    const vehicles = new Map();
    form.trips.forEach((trip) => {
      if (!trip.vehicleId) return;
      const id = String(trip.vehicleId);
      const vehicle = selectedVehicles.get(id) || plan?.trips.find((saved) => String(saved.vehicleId) === id);
      if (vehicle) vehicles.set(id, vehicle);
    });
    return [...vehicles.entries()];
  }, [form.trips, plan?.trips, selectedVehicles]);

  const updateTrip = (rowIndex, key, value, extra = {}) => {
    const trips = form.trips.map((trip, index) => {
      if (index !== rowIndex) return trip;
      const next = { ...trip, [key]: value, ...extra };
      if (key === "vehicleId") {
        const vehicle = selectedVehicles.get(String(value));
        next.driverId = vehicle?.driver?.status === "active" ? String(vehicle.driver._id) : "";
      }
      if (key === "originType" && value === "base") next.originSiteId = "";
      return next;
    });
    updateForm("trips", trips);
  };

  const addTrip = () => updateForm("trips", [...form.trips, {
    tripId: `T${String(form.trips.length + 1).padStart(2, "0")}`,
    startDate: "",
    endDate: "",
    originType: "base",
    originSiteId: "",
    destinationSiteId: "",
    purpose: "",
    vehicleId: "",
    driverId: "",
    passengerIds: [],
    departTime: "",
    overnight: "",
  }]);

  const updateRows = (key, rows, index, field, value) =>
    updateForm(key, rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));

  const downloadDocument = async () => {
    if (!plan) return;
    setWorking(true);
    setError("");
    try {
      const approvedPlan = await getApprovedMovementPlan(plan._id);
      if (!approvedPlan.canDownload) throw new Error("Document download is available only after full approval.");
      const vehicleById = new Map(availableVehicles.map((vehicle) => [String(vehicle._id), vehicle]));
      const uniqueVehicles = [...new Map(approvedPlan.trips.map((trip) => [String(trip.vehicleId), trip])).values()];
      const teamById = new Map(approvedPlan.team.map((person) => [String(person.userId), person]));
      const content = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [{ text: approvedPlan.title, bold: true, font: "Arial", size: 32, color: "19344F" }],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [{
            text: `Plan reference: ${approvedPlan.reference}   Prepared by: ${approvedPlan.preparedBy.name}   Movement period: ${displayDate(approvedPlan.trips.reduce((min, trip) => !min || trip.startDate < min ? trip.startDate : min, ""))} – ${displayDate(approvedPlan.trips.reduce((max, trip) => !max || trip.endDate > max ? trip.endDate : max, ""))}`,
            font: "Arial",
            size: 18,
            color: "526579",
          }],
        }),
        new Paragraph({ text: "1. Plan details", heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 } }),
        new Paragraph({ text: approvedPlan.summary, spacing: { after: 100 } }),
        documentTable(["Field", "Entry"], [
          ["Plan reference", approvedPlan.reference],
          ["Project / activity", approvedPlan.project],
          ["Movement period", `${displayDate(approvedPlan.trips.reduce((min, trip) => !min || trip.startDate < min ? trip.startDate : min, ""))} – ${displayDate(approvedPlan.trips.reduce((max, trip) => !max || trip.endDate > max ? trip.endDate : max, ""))}`],
          ["Base", approvedPlan.base],
          ["Destinations", [...new Set(approvedPlan.trips.map((trip) => `${trip.destinationSiteId} — ${trip.destinationName}`))].join(", ")],
          ["Prepared by", approvedPlan.preparedBy.name],
        ]),
        ...documentSection("2. Team roster", ["#", "Name", "Organisation", "Trips"], approvedPlan.team.map((person, index) => [
          index + 1,
          person.name,
          person.organisation,
          approvedPlan.trips.filter((trip) => trip.passengerIds.some((id) => String(id) === String(person.userId))).map((trip) => trip.tripId).join(", "),
        ])),
        ...documentSection("3. Vehicle register", ["Reg no.", "Make / model", "Body", "Assigned driver", "Trips"], uniqueVehicles.map((trip) => [
          trip.vehicle.plate,
          trip.vehicle.make,
          trip.vehicle.body,
          trip.driverName,
          approvedPlan.trips.filter((item) => String(item.vehicleId) === String(trip.vehicleId)).map((item) => item.tripId).join(", "),
        ])),
        ...documentSection("4. Movement schedule", ["Trip", "Date", "Route", "Purpose", "Vehicle", "Passengers", "Depart", "Overnight"], approvedPlan.trips.map((trip) => [
          trip.tripId,
          trip.startDate === trip.endDate ? displayDate(trip.startDate) : `${displayDate(trip.startDate)} – ${displayDate(trip.endDate)}`,
          `${trip.originName} → ${trip.destinationSiteId} — ${trip.destinationName}`,
          trip.purpose,
          trip.vehicle.plate,
          trip.passengerIds.map((id) => teamById.get(String(id))?.name).filter(Boolean).join(", "),
          trip.departTime,
          trip.overnight,
        ])),
        ...documentSection("5. Vehicle allocation by day", ["Vehicle", ...planDates.map(displayDate)], assignedVehicles.map(([vehicleId, savedTrip]) => [
          savedTrip.vehicle?.plate || vehicleById.get(vehicleId)?.plate || "—",
          ...planDates.map((date) => {
            const trip = approvedPlan.trips.find((item) => String(item.vehicleId) === vehicleId && date >= item.startDate && date <= item.endDate);
            return trip ? `${trip.tripId}: ${trip.originName} → ${trip.destinationName}` : "Available";
          }),
        ])),
        ...documentSection("6. Accommodation and logistics", ACCOMMODATION_FIELDS.map(([, label]) => label), approvedPlan.accommodation.map((row) => ACCOMMODATION_FIELDS.map(([key]) => row[key]))),
        ...documentSection("Logistics checklist", LOGISTICS_FIELDS.map(([, label]) => label), approvedPlan.logistics.map((row) => LOGISTICS_FIELDS.map(([key]) => row[key]))),
        ...documentSection("Approvals", ["Role", "Name", "Status", "Date", "Comment"], approvedPlan.approvals.map((approval) => [
          "Super admin",
          approval.approverName,
          approval.status,
          approval.decidedAt ? new Date(approval.decidedAt).toLocaleDateString("en-GB") : "",
          approval.comment,
        ])),
      ];
      const document = new Document({
        styles: {
          default: { document: { run: { font: "Arial", size: 18, color: "263746" } } },
          heading1: { run: { font: "Arial", size: 24, bold: true, color: "19344F" }, paragraph: { spacing: { before: 260, after: 100 } } },
        },
        sections: [{
          properties: {
            page: {
              size: { orientation: "landscape", width: 15840, height: 12240 },
              margin: { top: 720, right: 720, bottom: 720, left: 720 },
            },
          },
          children: content,
        }],
      });
      const blob = await Packer.toBlob(document);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${approvedPlan.reference}.docx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setWorking(false);
    }
  };

  const vehicleOptions = (trip, rowIndex) => {
    const optionsList = availableVehicles.map((vehicle) => {
      const conflictTrip = { ...trip, vehicleId: String(vehicle._id) };
      const conflict = findTripConflict(conflictTrip, rowIndex);
      return {
        value: String(vehicle._id),
        label: `${vehicle.plate} · ${vehicle.make}${vehicle.body ? ` · ${vehicle.body}` : ""}${conflict ? ` — ${conflict}` : ""}`,
        disabled: Boolean(conflict),
      };
    });
    if (trip.vehicleId && !optionsList.some((option) => option.value === String(trip.vehicleId))) {
      const snapshot = plan?.trips.find((saved) => String(saved.vehicleId) === String(trip.vehicleId));
      optionsList.unshift({
        value: String(trip.vehicleId),
        label: `${snapshot?.vehicle?.plate || "Unavailable vehicle"} — no longer available`,
        disabled: true,
      });
    }
    return optionsList;
  };

  const statusLabel = (status) => ({
    draft: "Draft",
    pending_approval: "Awaiting approval",
    rejected: "Rejected — revise and resubmit",
    approved: "Approved — ready to publish",
    published: "Published",
  }[status] || status);

  return (
    <div className="movement-plan-page">
      <div className="view-head mp-head">
        <span className="tagchip"><FileText size={11} /> Operations · Movement planning</span>
        <h2>Movement Plan</h2>
        <p>Sites, vehicle and driver information, and schedule availability are loaded from Relay. Plans require approval before download or publication.</p>
        {canPrepare && (
          <button className="btn amber mp-export" type="button" onClick={createDraft} disabled={working || loading}>
            <Plus size={15} /> New movement plan
          </button>
        )}
      </div>

      {error && <div className="mp-alert mp-alert-error" role="alert">{error}</div>}
      {notice && <div className="mp-alert mp-alert-success" role="status">{notice}</div>}
      {loading && <div className="panel mp-loading">Loading sites, fleet, and movement plans…</div>}

      {!loading && (
        <div className="mp-layout">
          <aside className="panel mp-plan-list">
            <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>Plans</h3></div>
            <div className="panel-b">
              {plans.length === 0 && <p className="mp-description">No movement plans yet.</p>}
              {plans.map((item) => (
                <button
                  type="button"
                  key={item._id}
                  className={`mp-plan-card${plan?._id === item._id ? " selected" : ""}`}
                  onClick={() => selectPlan(item)}
                >
                  <strong>{item.reference}</strong>
                  <span>{item.project || item.title}</span>
                  <small>{statusLabel(item.status)}</small>
                </button>
              ))}
            </div>
          </aside>

          {!plan && (
            <section className="panel mp-empty-state">
              <FileText size={25} />
              <h3>Select a movement plan</h3>
              {canPrepare && <p>Create a draft to start planning dates, routes, vehicles, and team.</p>}
            </section>
          )}

          {plan && (
            <div className="mp-form-column">
              <section className="panel mp-section">
                <div className="panel-h">
                  <FileText size={16} className="ph-ico" />
                  <h3>1. Plan details</h3>
                  <span className={`mp-status mp-status-${plan.status}`}>{statusLabel(plan.status)}</span>
                </div>
                <div className="panel-b">
                  <div className="mp-details-grid">
                    <div className="mp-readonly-field"><span>Plan reference</span><strong>{plan.reference}</strong></div>
                    <div className="mp-readonly-field"><span>Prepared by</span><strong>{plan.preparedBy.name}</strong></div>
                    <div className="mp-readonly-field"><span>Movement period</span><strong>{periodStart ? `${displayDate(periodStart)} – ${displayDate(periodEnd)}` : "Set by trip dates"}</strong></div>
                    <div className="mp-readonly-field"><span>Destinations</span><strong>{destinations.length ? destinations.join(", ") : "Selected on trips"}</strong></div>
                    <TextInput label="Plan title" value={form.title} disabled={!canEdit} required onChange={(value) => updateForm("title", value)} />
                    <TextInput label="Project / activity" value={form.project} disabled={!canEdit} required onChange={(value) => updateForm("project", value)} />
                    <TextInput label="Base / starting point" value={form.base} disabled={!canEdit} required onChange={(value) => updateForm("base", value)} />
                  </div>
                  <p className="mp-description mp-standard-paragraph">{STANDARD_SUMMARY}</p>
                  {plan.status === "rejected" && <div className="mp-alert mp-alert-error">Rejection reason: {plan.rejectionReason}</div>}
                </div>
              </section>

              <section className="panel mp-section">
                <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>2. Team roster</h3></div>
                <div className="panel-b">
                  <p className="mp-description">Select active Relay users; names and organisation are filled from their account profiles.</p>
                  <div className="mp-team-picker">
                    <label className="mp-field">
                      <span>Team members</span>
                      <select
                        className="form-input mp-input mp-multi-select"
                        multiple
                        value={form.teamUserIds}
                        disabled={!canEdit}
                        onChange={(event) => updateForm("teamUserIds", [...event.target.selectedOptions].map((option) => option.value))}
                      >
                        {options.teamMembers.map((member) => (
                          <option key={member._id} value={String(member._id)}>
                            {member.name} · {member.organisation}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mp-hint">Use Ctrl or Command to select multiple team members.</p>
                  </div>
                  <div className="mp-roster-list">
                    {form.teamUserIds.map((id) => {
                      const member = selectedMembers.get(String(id)) || plan.team.find((person) => String(person.userId) === String(id));
                      return member ? <span className="mp-roster-chip" key={id}>{member.name} <small>{member.organisation}</small></span> : null;
                    })}
                    {form.teamUserIds.length === 0 && <span className="mp-hint">No team members selected.</span>}
                  </div>
                </div>
              </section>

              <section className="panel mp-section">
                <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>3. Movement schedule</h3></div>
                <div className="panel-b">
                  <p className="mp-description">Choose dates, site routes, and a fleet vehicle. Vehicle details and its registered driver are filled automatically; schedule clashes are blocked.</p>
                  {form.trips.map((trip, rowIndex) => {
                    const vehicle = selectedVehicles.get(String(trip.vehicleId));
                    const assignedDriver = vehicle?.driver?.status === "active" ? vehicle.driver : null;
                    const driverOptions = assignedDriver
                      ? [{ value: String(assignedDriver._id), label: `${assignedDriver.name} · assigned fleet driver` }]
                      : options.drivers.map((driver) => ({ value: String(driver._id), label: driver.name }));
                    const conflict = tripConflicts[rowIndex];
                    return (
                      <div className="mp-trip-card" key={`${trip.tripId || "trip"}-${rowIndex}`}>
                        <div className="mp-trip-heading">
                          <strong>{trip.tripId || `T${String(rowIndex + 1).padStart(2, "0")}`}</strong>
                          {canEdit && (
                            <button className="iconbtn" type="button" aria-label={`Remove trip ${rowIndex + 1}`} onClick={() => updateForm("trips", form.trips.filter((_, index) => index !== rowIndex))}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                        <div className="mp-trip-grid">
                          <TextInput label="Start date" type="date" value={trip.startDate} disabled={!canEdit} required onChange={(value) => updateTrip(rowIndex, "startDate", value)} />
                          <TextInput label="End date" type="date" value={trip.endDate} disabled={!canEdit} required onChange={(value) => updateTrip(rowIndex, "endDate", value)} />
                          <SelectInput
                            label="Origin"
                            value={trip.originType === "base" ? "base" : trip.originSiteId}
                            disabled={!canEdit}
                            required
                            options={[
                              { value: "base", label: `Base · ${form.base || "set in plan details"}` },
                              ...options.sites.map((site) => ({ value: String(site._id), label: `${site.siteId} · ${site.name}` })),
                            ]}
                            onChange={(value) => updateTrip(
                              rowIndex,
                              "originType",
                              value === "base" ? "base" : "site",
                              { originSiteId: value === "base" ? "" : value },
                            )}
                          />
                          <SelectInput
                            label="Destination site"
                            value={trip.destinationSiteId}
                            disabled={!canEdit}
                            required
                            options={options.sites.map((site) => ({ value: String(site._id), label: `${site.siteId} · ${site.name}` }))}
                            onChange={(value) => updateTrip(rowIndex, "destinationSiteId", value)}
                          />
                          <TextInput label="Purpose" value={trip.purpose} disabled={!canEdit} required onChange={(value) => updateTrip(rowIndex, "purpose", value)} />
                          <TextInput label="Departure time" type="time" value={trip.departTime} disabled={!canEdit} onChange={(value) => updateTrip(rowIndex, "departTime", value)} />
                          <TextInput label="Overnight location" value={trip.overnight} disabled={!canEdit} onChange={(value) => updateTrip(rowIndex, "overnight", value)} />
                          <SelectInput
                            label="Fleet vehicle"
                            value={trip.vehicleId}
                            disabled={!canEdit}
                            required
                            options={vehicleOptions(trip, rowIndex)}
                            onChange={(value) => updateTrip(rowIndex, "vehicleId", value)}
                          />
                          <div className="mp-readonly-field">
                            <span>Vehicle details</span>
                            <strong>{vehicle ? `${vehicle.plate} · ${vehicle.make}${vehicle.body ? ` · ${vehicle.body}` : ""}` : "Select a vehicle"}</strong>
                          </div>
                          <SelectInput
                            label="Driver"
                            value={trip.driverId}
                            disabled={!canEdit || Boolean(assignedDriver)}
                            required
                            options={driverOptions}
                            onChange={(value) => updateTrip(rowIndex, "driverId", value)}
                          />
                          <label className="mp-field mp-passengers">
                            <span>Passengers from team</span>
                            <select
                              className="form-input mp-input mp-multi-select"
                              multiple
                              value={trip.passengerIds}
                              disabled={!canEdit}
                              onChange={(event) => updateTrip(rowIndex, "passengerIds", [...event.target.selectedOptions].map((option) => option.value))}
                            >
                              {form.teamUserIds.map((id) => {
                                const person = selectedMembers.get(String(id)) || plan.team.find((member) => String(member.userId) === String(id));
                                return person ? <option key={id} value={String(id)}>{person.name} · {person.organisation}</option> : null;
                              })}
                            </select>
                          </label>
                        </div>
                        {conflict && <p className="mp-conflict" role="alert">{conflict}</p>}
                      </div>
                    );
                  })}
                  {form.trips.length === 0 && <div className="mp-empty-state compact">Add a trip to start the schedule.</div>}
                  {canEdit && <button className="btn sm ghost mp-add-row" type="button" onClick={addTrip}><Plus size={14} /> Add trip</button>}
                </div>
              </section>

              <section className="panel mp-section">
                <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>4. Vehicle register</h3></div>
                <div className="panel-b">
                  <p className="mp-description">Vehicles are derived from trips. Details are read from the current fleet register.</p>
                  <div className="mp-table-scroll">
                    <table className="mp-edit-table">
                      <thead><tr><th>Reg no.</th><th>Make / model</th><th>Body</th><th>Assigned driver</th><th>Trips</th></tr></thead>
                      <tbody>
                        {assignedVehicles.map(([vehicleId, vehicle]) => (
                          <tr key={vehicleId}>
                            <td>{vehicle.plate || vehicle.vehicle?.plate}</td>
                            <td>{vehicle.make || vehicle.vehicle?.make}</td>
                            <td>{vehicle.body || vehicle.vehicle?.body || "—"}</td>
                            <td>{vehicle.driver?.name || plan.trips.find((trip) => String(trip.vehicleId) === vehicleId)?.driverName || "—"}</td>
                            <td>{form.trips.filter((trip) => String(trip.vehicleId) === vehicleId).map((trip) => trip.tripId).join(", ")}</td>
                          </tr>
                        ))}
                        {assignedVehicles.length === 0 && <tr><td className="mp-empty-row" colSpan={5}>Vehicles appear here when assigned to a trip.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="panel mp-section">
                <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>5. Vehicle allocation by day</h3></div>
                <div className="panel-b">
                  <p className="mp-description">Only vehicles used in this plan and dates covered by its trips are shown. Existing fleet reservations are shown as booked.</p>
                  <div className="mp-table-scroll">
                    <table className="mp-edit-table">
                      <thead><tr><th>Vehicle</th>{planDates.map((date) => <th key={date}>{displayDate(date)}</th>)}</tr></thead>
                      <tbody>
                        {assignedVehicles.map(([vehicleId, vehicle]) => (
                          <tr key={vehicleId}>
                            <th>{vehicle.plate || vehicle.vehicle?.plate}</th>
                            {planDates.map((date) => {
                              const trip = form.trips.find((item) => String(item.vehicleId) === vehicleId && date >= item.startDate && date <= item.endDate);
                              const booking = options.reservations.find((item) => String(item.vehicleId) === vehicleId && item.date === date && item.reference !== plan.reference);
                              return <td key={date}>{trip ? `${trip.tripId} · ${trip.originType === "base" ? form.base : options.sites.find((site) => String(site._id) === String(trip.originSiteId))?.name || "Site"} → ${options.sites.find((site) => String(site._id) === String(trip.destinationSiteId))?.name || "Destination"}` : booking ? `${booking.reference} · booked` : "Available"}</td>;
                            })}
                          </tr>
                        ))}
                        {assignedVehicles.length === 0 && <tr><td className="mp-empty-row" colSpan={Math.max(1, planDates.length + 1)}>Vehicle allocation is generated from scheduled trips.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="panel mp-section">
                <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>6. Accommodation and logistics</h3></div>
                <div className="panel-b">
                  <p className="mp-description">Add accommodation arrangements as needed.</p>
                  <h4 className="mp-subheading">Accommodation</h4>
                  <EditableRows
                    label="accommodation"
                    fields={ACCOMMODATION_FIELDS}
                    rows={form.accommodation}
                    disabled={!canEdit}
                    onChange={(index, field, value) => updateRows("accommodation", form.accommodation, index, field, value)}
                    onAdd={() => updateForm("accommodation", [...form.accommodation, Object.fromEntries(ACCOMMODATION_FIELDS.map(([key]) => [key, ""]))])}
                    onRemove={(index) => updateForm("accommodation", form.accommodation.filter((_, rowIndex) => rowIndex !== index))}
                  />
                  <h4 className="mp-subheading">Logistics checklist</h4>
                  <EditableRows
                    label="logistics"
                    fields={LOGISTICS_FIELDS}
                    rows={form.logistics}
                    disabled={!canEdit}
                    onChange={(index, field, value) => updateRows("logistics", form.logistics, index, field, value)}
                    onAdd={() => updateForm("logistics", [...form.logistics, Object.fromEntries(LOGISTICS_FIELDS.map(([key]) => [key, ""]))])}
                    onRemove={(index) => updateForm("logistics", form.logistics.filter((_, rowIndex) => rowIndex !== index))}
                  />
                </div>
              </section>

              <section className="panel mp-section">
                <div className="panel-h"><Check size={16} className="ph-ico" /><h3>Approvals</h3></div>
                <div className="panel-b">
                  <p className="mp-description">On submission, Relay assigns an approval task to every other active super admin. All assigned approvals are required before download or publication.</p>
                  {plan.approvals.length > 0 ? (
                    <div className="mp-table-scroll">
                      <table className="mp-edit-table">
                        <thead><tr><th>Approver</th><th>Status</th><th>Date</th><th>Comment</th></tr></thead>
                        <tbody>{plan.approvals.map((approval) => (
                          <tr key={String(approval.approverId)}>
                            <td>{approval.approverName}</td>
                            <td>{approval.status}</td>
                            <td>{approval.decidedAt ? displayDate(approval.decidedAt) : "—"}</td>
                            <td>{approval.comment || "—"}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ) : <p className="mp-hint">Approval records are created when the preparer submits this plan.</p>}
                  {plan.canApprove && (
                    <div className="mp-approval-actions">
                      <TextInput label="Approval comment / rejection reason" value={approvalComment} onChange={setApprovalComment} />
                      <button className="btn teal" type="button" disabled={working} onClick={() => decide("approved")}><Check size={15} /> Approve</button>
                      <button className="btn" type="button" disabled={working || !approvalComment.trim()} onClick={() => decide("rejected")}>Reject</button>
                    </div>
                  )}
                  {plan.rejectionReason && <div className="mp-alert mp-alert-error">Rejection reason: {plan.rejectionReason}</div>}
                </div>
              </section>

              <div className="mp-actions">
                {canEdit && (
                  <>
                    <button className="btn" type="button" disabled={working || !dirty} onClick={saveDraft}>Save draft</button>
                    <button className="btn amber" type="button" disabled={working || scheduleLoading || Boolean(scheduleError) || tripConflicts.some(Boolean) || form.trips.length === 0} onClick={submitForApproval}>
                      <Send size={15} /> {scheduleLoading ? "Checking fleet schedule..." : "Submit for approval"}
                    </button>
                  </>
                )}
                {plan.canPublish && <button className="btn amber" type="button" disabled={working} onClick={publish}>Publish to staff</button>}
                {plan.canDownload && <button className="btn teal" type="button" disabled={working} onClick={downloadDocument}><Download size={15} /> Download approved plan</button>}
                {dirty && <span className="mp-hint">Unsaved changes</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
