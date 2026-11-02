import { useState } from "react";
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
import { Download, FileText, Plus, Trash2 } from "lucide-react";

const initialPlan = {
  title: "Oaknet Movement Plan",
  summary: "This plan records the team, vehicles, movement schedule, accommodation, and logistics for the planned movement.",
  sectionSummaries: {
    team: "List everyone travelling, their organisation, and the trips they are assigned to.",
    vehicles: "Record the vehicles assigned to the movement and their drivers.",
    trips: "List each trip with its date, route, purpose, passengers, and overnight stop.",
    allocation: "Record each vehicle's route or availability for each date in the movement period.",
    accommodation: "Record accommodation requirements for each overnight location.",
  },
  details: [
    { field: "Plan reference", entry: "" },
    { field: "Project / activity", entry: "" },
    { field: "Movement period", entry: "" },
    { field: "Base", entry: "" },
    { field: "Destinations", entry: "" },
    { field: "Prepared by", entry: "" },
    { field: "Version", entry: "" },
  ],
  team: [],
  vehicles: [],
  trips: [],
  days: [],
  allocation: [],
  accommodation: [],
  logistics: [],
  approvals: [],
};

const sections = [
  { key: "team", title: "2. Team roster", description: "People travelling, their organisations, and the trips they are assigned to.", columns: [["name", "Name"], ["organisation", "Organisation"], ["trips", "Trips"]] },
  { key: "vehicles", title: "3. Vehicle register", description: "Vehicle details, assigned driver, and the trips covered.", columns: [["registration", "Reg no."], ["model", "Model"], ["seats", "Seats (incl. driver)"], ["driver", "Assigned driver"], ["trips", "Trips"]] },
  { key: "trips", title: "4. Movement schedule", description: "Dates, routes, purpose, passengers, departure time, and overnight stops.", columns: [["trip", "Trip"], ["date", "Date"], ["route", "Route"], ["purpose", "Purpose"], ["vehicle", "Vehicle"], ["passengers", "Passengers"], ["depart", "Depart"], ["overnight", "Overnight"], ["status", "Status"]] },
  { key: "accommodation", title: "6. Accommodation and logistics", description: "Accommodation and overnight requirements.", columns: [["location", "Location"], ["nights", "Nights"], ["pax", "Pax"], ["personNights", "Person-nights"], ["venue", "Venue"], ["booking", "Booking ref"], ["arrangedBy", "Arranged by"]] },
  { key: "logistics", title: "Logistics checklist", description: "Operational arrangements and the person responsible.", columns: [["item", "Item"], ["detail", "Detail"], ["responsible", "Responsible"]] },
  { key: "approvals", title: "Approvals", description: "Plan preparation, review, and approval.", columns: [["role", "Role"], ["name", "Name"], ["signature", "Signature"], ["date", "Date"]] },
];

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "D8E0EA" },
};

function docCell(text, header = false) {
  return new TableCell({
    borders: cellBorders,
    shading: header ? { type: ShadingType.CLEAR, fill: "EAF0F6" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        spacing: { before: 30, after: 30 },
        children: [{
          text: String(text || "—"),
          bold: header,
          font: "Arial",
          size: 16,
          color: header ? "19344F" : "263746",
        }],
      }),
    ],
  });
}

function docTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((header) => docCell(header, true)) }),
      ...rows.map((row) => new TableRow({ children: row.map((value) => docCell(value)) })),
    ],
  });
}

function docSection(title, headers, rows, summary = "") {
  const content = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 100 },
    }),
  ];
  if (summary) content.push(new Paragraph({ text: summary, spacing: { after: 100 } }));
  content.push(docTable(headers, rows));
  return content;
}

function updateRow(rows, index, key, value) {
  return rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);
}

function EditableTable({ section, rows, onChange, onAdd, onRemove }) {
  return (
    <div className="mp-table-scroll">
      <table className="mp-edit-table">
        <thead>
          <tr>
            {section.columns.map(([key, label]) => <th key={key}>{label}</th>)}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${section.key}-${index}`}>
              {section.columns.map(([key, label]) => (
                <td key={key}>
                  <input
                    className="form-input mp-input"
                    aria-label={`${label}, row ${index + 1}`}
                    placeholder={label}
                    value={row[key] ?? ""}
                    onChange={(event) => onChange(index, key, event.target.value)}
                  />
                </td>
              ))}
              <td className="mp-action-cell">
                <button className="iconbtn" type="button" aria-label={`Remove row ${index + 1}`} onClick={() => onRemove(index)}>
                  <Trash2 size={15} />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="mp-empty-row" colSpan={section.columns.length + 1}>No entries yet. Add a row to enter movement details.</td>
            </tr>
          )}
        </tbody>
      </table>
      <button className="btn sm ghost mp-add-row" type="button" onClick={onAdd}>
        <Plus size={14} /> Add row
      </button>
    </div>
  );
}

export function MovementPlanPage() {
  const [plan, setPlan] = useState(initialPlan);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const updateTopLevel = (key, value) => setPlan((current) => ({ ...current, [key]: value }));
  const updateDetail = (index, key, value) => updateTopLevel("details", updateRow(plan.details, index, key, value));
  const updateSection = (key, index, field, value) => updateTopLevel(key, updateRow(plan[key], index, field, value));
  const addSectionRow = (key, columns) => updateTopLevel(key, [...plan[key], Object.fromEntries(columns.map(([field]) => [field, ""]))]);
  const removeSectionRow = (key, index) => updateTopLevel(key, plan[key].filter((_, rowIndex) => rowIndex !== index));
  const addAllocationDay = () => {
    updateTopLevel("days", [...plan.days, ""]);
    updateTopLevel("allocation", plan.allocation.map((vehicle) => ({ ...vehicle, days: [...vehicle.days, ""] })));
  };
  const removeAllocationDay = (dayIndex) => {
    updateTopLevel("days", plan.days.filter((_, index) => index !== dayIndex));
    updateTopLevel("allocation", plan.allocation.map((vehicle) => ({
      ...vehicle,
      days: vehicle.days.filter((_, index) => index !== dayIndex),
    })));
  };

  const exportDocument = async () => {
    setExporting(true);
    setExportError("");
    try {
      const approvalDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
      const content = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [{ text: plan.title || "Movement Plan", bold: true, font: "Arial", size: 32, color: "19344F" }],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 220 },
          children: [{ text: `Date: ${approvalDate}   Prepared by: ${plan.details.find((row) => row.field === "Prepared by")?.entry || "—"}`, font: "Arial", size: 18, color: "526579" }],
        }),
        new Paragraph({ text: "1. Plan details", heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 } }),
        new Paragraph({ text: plan.summary, spacing: { after: 100 } }),
        docTable(["Field", "Entry"], plan.details.map(({ field, entry }) => [field, entry])),
        ...docSection(sections[0].title, ["#", "Name", "Organisation", "Trips"], plan.team.map((row, index) => [index + 1, row.name, row.organisation, row.trips]), plan.sectionSummaries.team),
        ...docSection(sections[1].title, sections[1].columns.map(([, label]) => label), plan.vehicles.map((row) => sections[1].columns.map(([key]) => row[key])), plan.sectionSummaries.vehicles),
        ...docSection(sections[2].title, sections[2].columns.map(([, label]) => label), plan.trips.map((row) => sections[2].columns.map(([key]) => row[key])), plan.sectionSummaries.trips),
        ...docSection("5. Vehicle allocation by day", ["Vehicle", ...plan.days], plan.allocation.map((row) => [row.vehicle, ...row.days]), plan.sectionSummaries.allocation),
        ...docSection(sections[3].title, sections[3].columns.map(([, label]) => label), plan.accommodation.map((row) => sections[3].columns.map(([key]) => row[key])), plan.sectionSummaries.accommodation),
        ...docSection(sections[4].title, sections[4].columns.map(([, label]) => label), plan.logistics.map((row) => sections[4].columns.map(([key]) => row[key]))),
        ...docSection(sections[5].title, sections[5].columns.map(([, label]) => label), plan.approvals.map((row) => sections[5].columns.map(([key]) => row[key]))),
      ];
      const document = new Document({
        styles: {
          default: {
            document: { run: { font: "Arial", size: 18, color: "263746" } },
            heading1: { run: { font: "Arial", size: 24, bold: true, color: "19344F" }, paragraph: { spacing: { before: 260, after: 100 } } },
          },
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
      const reference = plan.details.find((row) => row.field === "Plan reference")?.entry || "movement-plan";
      link.href = url;
      link.download = `${reference.trim().replace(/[^a-z0-9-]+/gi, "-")}.docx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Movement plan export failed:", error);
      setExportError("The Word document could not be generated. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="movement-plan-page">
      <div className="view-head mp-head">
        <span className="tagchip"><FileText size={11} /> Operations · Document generator</span>
        <h2>Movement Plan</h2>
        <p>Enter movement-specific details in the forms below. Your entries populate the Word document tables; the section guidance and paragraphs stay standard.</p>
        <button className="btn amber mp-export" type="button" onClick={exportDocument} disabled={exporting}>
          <Download size={15} /> {exporting ? "Generating document..." : "Download Word document"}
        </button>
        {exportError && <p className="mp-error" role="alert">{exportError}</p>}
      </div>

      <section className="panel mp-section">
        <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>1. Plan details</h3></div>
        <div className="panel-b">
          <label className="form-label" htmlFor="mp-title">Document title</label>
          <input id="mp-title" className="form-input mp-title-input" value={plan.title} onChange={(event) => updateTopLevel("title", event.target.value)} />
          <p className="mp-description mp-plan-summary">{plan.summary}</p>
          <div className="mp-details-grid">
            {plan.details.map((detail, index) => (
              <div key={index}>
                <label className="form-label" htmlFor={`mp-detail-${index}`}>{detail.field}</label>
                <input id={`mp-detail-${index}`} className="form-input mp-input" placeholder={`Enter ${detail.field.toLowerCase()}`} value={detail.entry} onChange={(event) => updateDetail(index, "entry", event.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {sections.slice(0, 3).map((section) => (
        <section className="panel mp-section" key={section.key}>
          <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>{section.title}</h3></div>
          <div className="panel-b">
            <p className="mp-description">{section.description}</p>
            <EditableTable
              section={section}
              rows={plan[section.key]}
              onChange={(index, field, value) => updateSection(section.key, index, field, value)}
              onAdd={() => addSectionRow(section.key, section.columns)}
              onRemove={(index) => removeSectionRow(section.key, index)}
            />
          </div>
        </section>
      ))}

      <section className="panel mp-section">
        <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>5. Vehicle allocation by day</h3></div>
        <div className="panel-b">
          <p className="mp-description">Enter each day’s date and the assigned route or availability for each vehicle.</p>
          <div className="mp-table-scroll">
            <table className="mp-edit-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  {plan.days.map((day, dayIndex) => (
                    <th key={dayIndex}>
                      <div className="mp-date-heading">
                        <input className="form-input mp-input" aria-label={`Day ${dayIndex + 1} date`} placeholder="Date" value={day} onChange={(event) => updateTopLevel("days", plan.days.map((value, index) => index === dayIndex ? event.target.value : value))} />
                        <button className="iconbtn" type="button" aria-label={`Remove day ${dayIndex + 1}`} onClick={() => removeAllocationDay(dayIndex)}><Trash2 size={13} /></button>
                      </div>
                    </th>
                  ))}
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {plan.allocation.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td><input className="form-input mp-input" aria-label={`Vehicle, row ${rowIndex + 1}`} value={row.vehicle} onChange={(event) => updateSection("allocation", rowIndex, "vehicle", event.target.value)} /></td>
                    {plan.days.map((_, dayIndex) => (
                      <td key={dayIndex}>
                        <input
                          className="form-input mp-input"
                          aria-label={`${row.vehicle} allocation, day ${dayIndex + 1}`}
                          value={row.days[dayIndex] || ""}
                          onChange={(event) => updateTopLevel("allocation", plan.allocation.map((vehicle, index) => index === rowIndex ? { ...vehicle, days: vehicle.days.map((value, day) => day === dayIndex ? event.target.value : value) } : vehicle))}
                        />
                      </td>
                    ))}
                    <td className="mp-action-cell">
                      <button className="iconbtn" type="button" aria-label={`Remove vehicle row ${rowIndex + 1}`} onClick={() => removeSectionRow("allocation", rowIndex)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {plan.allocation.length === 0 && (
                  <tr><td className="mp-empty-row" colSpan={plan.days.length + 2}>Add dates and vehicles to enter the daily allocation.</td></tr>
                )}
              </tbody>
            </table>
            <button
              className="btn sm ghost mp-add-row"
              type="button"
              onClick={() => updateTopLevel("allocation", [...plan.allocation, { vehicle: "", days: plan.days.map(() => "") }])}
            >
              <Plus size={14} /> Add vehicle
            </button>
            <button className="btn sm ghost mp-add-row" type="button" onClick={addAllocationDay}>
              <Plus size={14} /> Add date
            </button>
          </div>
        </div>
      </section>

      {sections.slice(3).map((section) => (
        <section className="panel mp-section" key={section.key}>
          <div className="panel-h"><FileText size={16} className="ph-ico" /><h3>{section.title}</h3></div>
          <div className="panel-b">
            <p className="mp-description">{section.description}</p>
            <EditableTable
              section={section}
              rows={plan[section.key]}
              onChange={(index, field, value) => updateSection(section.key, index, field, value)}
              onAdd={() => addSectionRow(section.key, section.columns)}
              onRemove={(index) => removeSectionRow(section.key, index)}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
