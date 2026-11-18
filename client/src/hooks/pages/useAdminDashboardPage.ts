import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useAdminDashboard } from "../../features/admin/hooks/useAdminDashboard";

type AdminTab = "review" | "music" | "search" | "room";

export function useAdminDashboardPage() {
  const { roomId } = useParams({ from: "/admin/$roomId" }) as { roomId: string };
  const [requestedTab, setActiveTab] = useState<AdminTab>("review");

  const dashboard = useAdminDashboard(roomId);

  const [copied, setCopied] = useState(false);

  const handleCopyKey = () => {
    if (!dashboard.roomKey) return;
    navigator.clipboard.writeText(dashboard.roomKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // A listening party has no moderation queue, so the tab does not exist there.
  const tabs: { id: AdminTab; label: string }[] =
    dashboard.mode === "party"
      ? [
          { id: "music", label: "Music room" },
          { id: "search", label: "Find tracks" },
          { id: "room", label: "Access code" },
        ]
      : [
          { id: "review", label: "Review queue" },
          { id: "music", label: "Music room" },
          { id: "search", label: "Find tracks" },
          { id: "room", label: "Access code" },
        ];

  // If the room's mode arrives after first render, or the tab disappears, show
  // the first tab that still exists rather than a blank panel.
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : tabs[0].id;

  return {
    roomId,
    activeTab,
    setActiveTab,
    copied,
    handleCopyKey,
    tabs,
    ...dashboard,
  };
}
