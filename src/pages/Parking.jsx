import { useEffect, useState } from "react";
import api from "../services/api";
import ParkingSlotCard from "../components/ParkingSlotCard";
import { useAuth } from "../context/AuthContext";

export default function Parking() {
  const { user } = useAuth();
  const [slots, setSlots] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [vehicleId, setVehicleId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("AVAILABLE"); // default to AVAILABLE (unbooked)
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedUserVehicle, setSelectedUserVehicle] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    // 1. Always load parking slots
    try {
      const slotResponse = await api.get("/parking-slots");
      setSlots(slotResponse.data || []);
    } catch (err) {
      console.error("Failed to load parking slots", err);
      setError("Unable to load parking slots from backend. Please verify backend is running.");
    }

    // 2. Load user's vehicles if logged in
    if (user?.id) {
      try {
        const vehicleResponse = await api.get(`/vehicles/user/${user.id}`);
        setVehicles(vehicleResponse.data || []);
      } catch (err) {
        console.error("Failed to load user vehicles", err);
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError("Your login session may have expired. If you cannot book, please log out and log back in.");
        }
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  // Handle vehicle quick-select filter
  const handleVehicleFilterChange = (selectedId) => {
    setSelectedUserVehicle(selectedId);
    if (!selectedId) {
      setTypeFilter("ALL");
      return;
    }
    const found = vehicles.find((v) => String(v.id) === String(selectedId));
    if (found) {
      setTypeFilter(found.vehicleType);
      setVehicleId(String(found.id));
    }
  };

  // Filter slots based on user selections
  const filteredSlots = slots.filter((slot) => {
    // Status filter
    if (statusFilter === "AVAILABLE" && slot.status !== "AVAILABLE") return false;
    if (statusFilter === "BOOKED" && slot.status === "AVAILABLE") return false;

    // Type filter
    if (typeFilter !== "ALL" && slot.vehicleType !== typeFilter) return false;

    return true;
  });

  const openBookingModal = (slot) => {
    setSelectedSlot(slot);
    setError("");

    // If user already filtered by vehicle, or has matching vehicles, pre-select
    if (selectedUserVehicle) {
      const found = vehicles.find((v) => String(v.id) === String(selectedUserVehicle));
      if (found && found.vehicleType === slot.vehicleType) {
        setVehicleId(String(found.id));
        return;
      }
    }

    // Auto-select first matching vehicle if available
    const matchingVehicles = vehicles.filter((v) => v.vehicleType === slot.vehicleType);
    if (matchingVehicles.length > 0) {
      setVehicleId(String(matchingVehicles[0].id));
    } else {
      setVehicleId("");
    }
  };

  const book = async () => {
    if (!vehicleId) {
      setError("Please select a vehicle.");
      return;
    }

    try {
      await api.post("/bookings", {
        userId: user.id,
        vehicleId: Number(vehicleId),
        slotId: selectedSlot.id
      });

      setSelectedSlot(null);
      setVehicleId("");
      setError("");
      await load();
      alert("Parking slot booked successfully!");
    } catch (error) {
      setError(error.response?.data?.message || "Booking failed. Please try again.");
    }
  };

  return (
    <main className="page">
      <h1>Parking Slots</h1>
      <p className="muted">Green = available • Red = booked/occupied</p>

      {error && <p className="error" style={{ margin: "12px 0" }}>{error}</p>}

      {/* Filter Toolbar */}
      <div className="inline-form" style={{ marginTop: "16px", marginBottom: "20px" }}>
        {/* Quick-filter by your vehicle */}
        {vehicles.length > 0 && (
          <div>
            <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
              Filter by My Vehicle:
            </label>
            <select
              value={selectedUserVehicle}
              onChange={(e) => handleVehicleFilterChange(e.target.value)}
            >
              <option value="">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  🚗 {v.vehicleNumber} ({v.vehicleType})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status filter */}
        <div>
          <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
            Slot Status:
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="AVAILABLE">Available (Unbooked) Only</option>
            <option value="ALL">All Slots (Available & Booked)</option>
            <option value="BOOKED">Booked / Occupied Only</option>
          </select>
        </div>

        {/* Vehicle Type filter */}
        <div>
          <label style={{ fontSize: "13px", fontWeight: "600", display: "block", marginBottom: "4px" }}>
            Slot Type:
          </label>
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setSelectedUserVehicle("");
            }}
          >
            <option value="ALL">All Vehicle Types</option>
            <option value="CAR">CAR Slots</option>
            <option value="BIKE">BIKE Slots</option>
          </select>
        </div>

        <button
          type="button"
          className="secondary-btn"
          style={{ alignSelf: "flex-end" }}
          onClick={() => {
            setStatusFilter("AVAILABLE");
            setTypeFilter("ALL");
            setSelectedUserVehicle("");
            load();
          }}
        >
          Reset Filters
        </button>
      </div>

      {/* Slots grid / Loading / Empty states */}
      {loading ? (
        <div className="empty">Loading parking slots...</div>
      ) : filteredSlots.length === 0 ? (
        <div className="empty">
          No parking slots found matching your filter criteria.
        </div>
      ) : (
        <div className="slot-grid">
          {filteredSlots.map((slot) => (
            <ParkingSlotCard
              key={slot.id}
              slot={slot}
              onBook={openBookingModal}
            />
          ))}
        </div>
      )}

      {/* Booking Modal */}
      {selectedSlot && (
        <div className="modal">
          <div className="modal-card">
            <h2>Book Slot: {selectedSlot.slotNumber}</h2>
            <p className="muted" style={{ margin: "6px 0 16px" }}>
              Slot Type: <b>{selectedSlot.vehicleType}</b> • Rate: <b>₹{selectedSlot.hourlyRate}/hr</b>
            </p>

            {error && <p className="error">{error}</p>}

            {vehicles.filter((v) => v.vehicleType === selectedSlot.vehicleType).length === 0 ? (
              <div style={{ margin: "16px 0", color: "#b42318", background: "#ffe5e5", padding: "12px", borderRadius: "8px" }}>
                ⚠️ You don't have any <b>{selectedSlot.vehicleType}</b> registered.
                <br />
                Please go to the <b>Vehicles</b> page and add a {selectedSlot.vehicleType} first.
              </div>
            ) : (
              <div style={{ margin: "12px 0" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", display: "block", marginBottom: "6px" }}>
                  Select Vehicle:
                </label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  <option value="">Select vehicle</option>
                  {vehicles
                    .filter((v) => v.vehicleType === selectedSlot.vehicleType)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber} ({v.vehicleType})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="hero-buttons">
              <button
                className="primary-btn"
                onClick={book}
                disabled={vehicles.filter((v) => v.vehicleType === selectedSlot.vehicleType).length === 0}
              >
                Confirm Booking
              </button>
              <button onClick={() => setSelectedSlot(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
