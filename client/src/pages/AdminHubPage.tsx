import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useAdminAuth } from "../features/admin/hooks/useAdminAuth";
import { socket } from "../shared/lib/socket";
import { Modal } from "../shared/components/Modal";
import { AdminHeader } from "../shared/components/AdminHeader";
import { Button } from "../shared/components/button";
import { TextField } from "../shared/components/input";
import { LoadingOverlay } from "../shared/components/LoadingOverlay";
import { Logo } from "../shared/components/Logo";
import { transitions } from "../shared/motion/springs";
import { StationCard } from "../features/admin/components/StationCard";
import { AdminApprovalCard } from "../features/admin/components/AdminApprovalCard";
import type {
  CreateStationResponse,
  GetMyStationsResponse,
  GetPendingAdminsResponse,
  ModerateAdminResponse,
  PendingAdmin,
  Station,
} from "../shared/types";

const isHubTab = (value: string): value is "stations" | "users" =>
  value === "stations" || value === "users";

export function AdminHubPage() {
  const { token, user, loading, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };
  const [stations, setStations] = useState<Station[]>([]);
  const [creating, setCreating] = useState(false);
  const [newStationId, setNewStationId] = useState("");
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([]);
  const [activeHubTab, setActiveHubTab] = useState<"stations" | "users">("stations");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    document.title = "Admin Hub | PLAY Sound Archive";
  }, []);

  useEffect(() => {
    if (token && activeHubTab === "stations") {
      socket.emit("get_my_stations", { adminToken: token }, (res: GetMyStationsResponse) => {
        if (res.success) setStations(res.stations ?? []);
      });
    }
  }, [token, activeHubTab]);

  useEffect(() => {
    if (token && user?.role === "super_admin" && activeHubTab === "users") {
      socket.emit("get_pending_admins", { adminToken: token }, (res: GetPendingAdminsResponse) => {
        if (res.success) setPendingAdmins(res.admins ?? []);
      });
    }
  }, [token, user, activeHubTab]);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationId.trim() || !token) return;
    const roomId = newStationId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");
    setCreating(true);
    setCreateError(null);
    if (!socket.connected) {
      setCreateError("Not connected to server. Please wait...");
      setCreating(false);
      return;
    }
    socket.emit("create_station", { roomId, adminToken: token }, (res: CreateStationResponse) => {
      setCreating(false);
      if (res.success && res.roomId) {
        setCreateError(null);
        setIsCreateModalOpen(false);
        setNewStationId("");
        navigate({ to: "/admin/$roomId", params: { roomId: res.roomId } });
      } else {
        setCreateError(res.error || "Failed to create station. Please try again.");
      }
    });
  };

  const handleApproveAdmin = (id: string) => {
    if (!token) return;
    socket.emit(
      "approve_admin",
      { adminToken: token, targetId: id },
      (res: ModerateAdminResponse) => {
        if (res.success) {
          setPendingAdmins((prev) => prev.filter((admin) => admin.id !== id));
        }
      },
    );
  };

  const handleDenyAdmin = (id: string) => {
    if (!token) return;
    const shouldDeny = window.confirm("Deny registration?");
    if (!shouldDeny) return;

    socket.emit("deny_admin", { adminToken: token, targetId: id }, (res: ModerateAdminResponse) => {
      if (res.success) {
        setPendingAdmins((prev) => prev.filter((admin) => admin.id !== id));
      }
    });
  };

  if (loading || !token) return <LoadingOverlay isLoading={true} />;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <AdminHeader
        user={user || undefined}
        onLogout={handleLogout}
        title="Admin Hub"
        tabs={
          user?.role === "super_admin"
            ? [
                { id: "stations", label: "Stations" },
                {
                  id: "users",
                  label: "Approvals",
                  trailing:
                    pendingAdmins.length > 0 ? (
                      <span className="rounded-m3-full bg-error px-2 text-label-small text-on-error">
                        {pendingAdmins.length}
                      </span>
                    ) : undefined,
                },
              ]
            : undefined
        }
        activeTab={activeHubTab}
        onTabChange={(id) => {
          if (isHubTab(id)) setActiveHubTab(id);
        }}
      />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <AnimatePresence mode="wait">
          {activeHubTab === "stations" ? (
            <motion.div
              key="stations"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transitions.base}
              className="flex flex-col gap-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-headline-small">Broadcast control</h2>
                  <p className="mt-1 text-body-medium text-on-surface-variant">
                    {stations.length} active {stations.length === 1 ? "station" : "stations"}
                  </p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} size="md">
                  <Plus size={20} /> Add station
                </Button>
              </div>

              {stations.length === 0 ? (
                <div className="flex flex-col items-center rounded-m3-xl bg-surface-container px-6 py-16 text-center">
                  <Logo size={88} className="mb-6" />
                  <p className="text-title-medium text-on-surface-variant">
                    Your soundscape is currently empty.
                  </p>
                  <Button onClick={() => setIsCreateModalOpen(true)} size="md" className="mt-6">
                    <Plus size={20} /> Initialize first station
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {stations.map((station) => (
                    <StationCard
                      key={station.id}
                      station={station}
                      onClick={() =>
                        navigate({ to: "/admin/$roomId", params: { roomId: station.id } })
                      }
                    />
                  ))}
                </div>
              )}

              <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Provision new station"
                description="The slug becomes the participant URL."
              >
                <form onSubmit={handleCreateStation} className="flex flex-col gap-6">
                  <TextField
                    required
                    label="Station identity (URL slug)"
                    value={newStationId}
                    onChange={(e) => {
                      setNewStationId(e.target.value);
                      setCreateError(null);
                    }}
                    error={createError ?? undefined}
                  />
                  <Button
                    type="submit"
                    size="md"
                    disabled={creating || !newStationId.trim()}
                    className="w-full"
                  >
                    {creating ? "Syncing…" : "Establish station"}
                    {!creating && <Plus size={20} />}
                  </Button>
                </form>
              </Modal>
            </motion.div>
          ) : (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={transitions.base}
              className="mx-auto flex max-w-3xl flex-col gap-6"
            >
              <h2 className="text-headline-small">Access authorization requests</h2>
              {pendingAdmins.length === 0 ? (
                <div className="flex flex-col items-center rounded-m3-xl bg-surface-container px-6 py-16 text-center">
                  <Logo size={64} className="mb-5" />
                  <p className="text-title-medium text-on-surface-variant">The queue is empty.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {pendingAdmins.map((admin) => (
                    <AdminApprovalCard
                      key={admin.id}
                      admin={admin}
                      onApprove={handleApproveAdmin}
                      onDeny={handleDenyAdmin}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
