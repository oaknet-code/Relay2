import React, { useState, useEffect } from "react";
import {
  Users,
  Building2,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Power,
  Loader,
  AlertTriangle,
  Trash2,
  Edit,
  Plus,
  X,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";

export function ClientAdmin() {
  const [view, setView] = useState("list");
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    status: "active",
    notes: "",
  });

  const loadClientsFromStorage = () => {
    try {
      const stored = localStorage.getItem("relay_clients");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load clients from storage:", e);
      return [];
    }
  };

  const saveClientsToStorage = (clientsToSave) => {
    try {
      localStorage.setItem("relay_clients", JSON.stringify(clientsToSave));
    } catch (e) {
      console.error("Failed to save clients to storage:", e);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      const loadedClients = loadClientsFromStorage();
      setClients(loadedClients);
      setIsLoading(false);
    }, 300);
  }, []);

  const handleChange = (e) => {
    setError("");
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      status: "active",
      notes: "",
    });
    setEditingClient(null);
  };

  const startCreate = () => {
    setError("");
    setSuccess("");
    resetForm();
    setView("create");
  };

  const startEdit = (client) => {
    setError("");
    setSuccess("");
    setEditingClient(client);
    setFormData({
      name: client.name,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      country: client.country,
      status: client.status,
      notes: client.notes || "",
    });
    setView("edit");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      let updatedClients;

      if (editingClient) {
        // Update existing client
        updatedClients = clients.map((client) =>
          client.id === editingClient.id
            ? {
                ...client,
                ...formData,
                updatedAt: new Date().toISOString().split("T")[0],
              }
            : client
        );
        setSuccess("Client updated successfully!");
      } else {
        // Create new client
        const newClient = {
          id: Date.now(),
          ...formData,
          createdAt: new Date().toISOString().split("T")[0],
          updatedAt: new Date().toISOString().split("T")[0],
          hasAccess: true,
        };
        updatedClients = [newClient, ...clients];
        setSuccess("Client created successfully!");
      }

      saveClientsToStorage(updatedClients);
      setClients(updatedClients);
      resetForm();
      setView("list");
    } catch (err) {
      setError("Failed to save client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId, clientName) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${clientName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const updatedClients = clients.filter((c) => c.id !== clientId);
      saveClientsToStorage(updatedClients);
      setClients(updatedClients);
      setSuccess("Client deleted successfully!");
    } catch (err) {
      setError("Failed to delete client.");
    }
  };

  const handleRevokeAccess = async (clientId, clientName) => {
    if (
      !window.confirm(
        `Revoke access for "${clientName}"? They will not be able to log in.`,
      )
    ) {
      return;
    }

    try {
      const updatedClients = clients.map((client) =>
        client.id === clientId ? { ...client, hasAccess: false } : client
      );
      saveClientsToStorage(updatedClients);
      setClients(updatedClients);
      setSuccess("Client access revoked successfully!");
    } catch (err) {
      setError("Failed to revoke access.");
    }
  };

  const handleRestoreAccess = async (clientId, clientName) => {
    try {
      const updatedClients = clients.map((client) =>
        client.id === clientId ? { ...client, hasAccess: true } : client
      );
      saveClientsToStorage(updatedClients);
      setClients(updatedClients);
      setSuccess("Client access restored successfully!");
    } catch (err) {
      setError("Failed to restore access.");
    }
  };

  const handleDeactivate = async (clientId, clientName, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const updatedClients = clients.map((client) =>
        client.id === clientId ? { ...client, status: newStatus } : client
      );
      saveClientsToStorage(updatedClients);
      setClients(updatedClients);
      setSuccess(
        `Client ${newStatus === "active" ? "activated" : "deactivated"}!`,
      );
    } catch (err) {
      setError("Failed to update client status.");
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // CREATE/EDIT VIEW
  if (view === "create" || view === "edit") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
              {editingClient ? "Edit Client" : "Create New Client"}
            </h1>
            <p
              className="faint"
              style={{ fontSize: "13px", margin: "4px 0 0" }}
            >
              {editingClient
                ? "Update client information"
                : "Add a new client to the system"}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setView("list");
            }}
            style={{
              background: "transparent",
              border: "1px solid var(--line2)",
              color: "var(--muted)",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <X size={16} /> Cancel
          </button>
        </div>

        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "28px",
            maxWidth: "600px",
          }}
        >
          {error && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px",
                background: "rgba(255, 95, 95, 0.1)",
                border: "1px solid rgba(255, 95, 95, 0.3)",
                borderRadius: "8px",
                color: "var(--red)",
                fontSize: "13px",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle size={16} className="flex-none" style={{ marginTop: "1px" }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px",
                background: "rgba(51, 220, 174, 0.1)",
                border: "1px solid rgba(51, 220, 174, 0.3)",
                borderRadius: "8px",
                color: "var(--teal)",
                fontSize: "13px",
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <ShieldCheck size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Client/Company Name *
              </label>
              <input
                type="text"
                name="name"
                className="form-input"
                placeholder="e.g. Oaknet Business"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Contact Person *
              </label>
              <input
                type="text"
                name="contactPerson"
                className="form-input"
                placeholder="e.g. John Doe"
                value={formData.contactPerson}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Email *
              </label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="contact@company.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                className="form-input"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Street Address
              </label>
              <input
                type="text"
                name="address"
                className="form-input"
                placeholder="123 Business Ave"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  className="form-input"
                  placeholder="e.g. New York"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                  Country
                </label>
                <input
                  type="text"
                  name="country"
                  className="form-input"
                  placeholder="e.g. USA"
                  value={formData.country}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Status *
              </label>
              <select
                name="status"
                className="form-input"
                value={formData.status}
                onChange={handleChange}
                style={{
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2390a0b2' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: "right 8px center",
                  backgroundRepeat: "no-repeat",
                  paddingRight: "32px",
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "500", marginBottom: "6px", color: "var(--muted)" }}>
                Notes
              </label>
              <textarea
                name="notes"
                className="form-input"
                placeholder="Add any notes about this client..."
                value={formData.notes}
                onChange={handleChange}
                style={{
                  resize: "vertical",
                  minHeight: "80px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
              <button
                type="submit"
                disabled={isSubmitting || !formData.name || !formData.contactPerson || !formData.email}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: isSubmitting ? "var(--muted)" : "linear-gradient(to right, var(--amber), var(--amber2))",
                  color: "#06111f",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  transition: "all 130ms",
                }}
              >
                {isSubmitting ? "Saving..." : editingClient ? "Update Client" : "Create Client"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView("list");
                }}
                style={{
                  padding: "10px 16px",
                  background: "var(--panel2)",
                  color: "var(--muted)",
                  border: "1px solid var(--line2)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 130ms",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "600", margin: 0 }}>
            Client Management
          </h1>
          <p className="faint" style={{ fontSize: "13px", margin: "4px 0 0" }}>
            Manage client companies and their information
          </p>
        </div>
        <button
          onClick={startCreate}
          style={{
            padding: "10px 16px",
            background: "linear-gradient(to right, var(--teal), var(--teal2))",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 130ms",
          }}
        >
          <Plus size={18} /> New Client
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            background: "rgba(255, 95, 95, 0.1)",
            border: "1px solid rgba(255, 95, 95, 0.3)",
            borderRadius: "8px",
            color: "var(--red)",
            fontSize: "13px",
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={16} className="flex-none" style={{ marginTop: "1px" }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "12px",
            background: "rgba(51, 220, 174, 0.1)",
            border: "1px solid rgba(51, 220, 174, 0.3)",
            borderRadius: "8px",
            color: "var(--teal)",
            fontSize: "13px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <ShieldCheck size={16} />
          <span>{success}</span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          padding: "10px 14px",
        }}
      >
        <Search size={16} style={{ color: "var(--faint)" }} />
        <input
          type="text"
          placeholder="Search by name, email, or contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--ink)",
            fontSize: "14px",
            outline: "none",
          }}
        />
      </div>

      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              gap: "12px",
            }}
          >
            <Loader size={24} className="spin" style={{ color: "var(--teal)" }} />
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              Loading clients...
            </span>
          </div>
        ) : filteredClients.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "300px",
              color: "var(--faint)",
              gap: "12px",
            }}
          >
            <Building2 size={32} />
            <span style={{ fontSize: "14px" }}>
              {clients.length === 0
                ? "No clients yet. Create one to get started."
                : "No clients match your search."}
            </span>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line2)" }}>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>
                    Company
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>
                    Contact
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>
                    Email
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>
                    Status
                  </th>
                  <th style={{ padding: "12px 16px", fontWeight: "500", color: "var(--muted)" }}>
                    Access
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      fontWeight: "500",
                      color: "var(--muted)",
                      textAlign: "right",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    style={{
                      borderBottom: "1px solid var(--line)",
                      transition: "background-color 130ms",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td
                      style={{
                        padding: "12px 16px",
                        fontWeight: "500",
                        color: "var(--ink)",
                      }}
                    >
                      {client.name}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)" }}>
                      {client.contactPerson}
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: "12px" }}>
                      {client.email}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          background:
                            client.status === "active"
                              ? "rgba(51, 220, 174, 0.12)"
                              : "rgba(159, 110, 255, 0.12)",
                          color:
                            client.status === "active"
                              ? "var(--teal)"
                              : "var(--violet)",
                          fontWeight: "500",
                          textTransform: "capitalize",
                        }}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          background: client.hasAccess
                            ? "rgba(51, 220, 174, 0.12)"
                            : "rgba(255, 95, 95, 0.12)",
                          color: client.hasAccess ? "var(--teal)" : "var(--red)",
                          fontWeight: "500",
                        }}
                      >
                        {client.hasAccess ? "Granted" : "Revoked"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => startEdit(client)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--amber)",
                            cursor: "pointer",
                            padding: "4px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "opacity 130ms",
                          }}
                          title="Edit client"
                        >
                          <Edit size={15} />
                        </button>
                        {client.hasAccess ? (
                          <button
                            onClick={() =>
                              handleRevokeAccess(client.id, client.name)
                            }
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--beb)",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "opacity 130ms",
                            }}
                            title="Revoke access"
                          >
                            <Power size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleRestoreAccess(client.id, client.name)
                            }
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--teal)",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "4px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "opacity 130ms",
                            }}
                            title="Restore access"
                          >
                            <Power size={15} />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleDeleteClient(client.id, client.name)
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--red)",
                            cursor: "pointer",
                            padding: "4px",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "opacity 130ms",
                          }}
                          title="Delete client"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
