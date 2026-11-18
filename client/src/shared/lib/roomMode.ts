import type { RoomMode } from "../types";

export const ROOM_MODE_OPTIONS: {
  id: RoomMode;
  label: string;
  description: string;
}[] = [
  {
    id: "approval",
    label: "Approval",
    description: "You approve each request.",
  },
  {
    id: "party",
    label: "Listening party",
    description: "Songs play right away.",
  },
];

export function roomModeLabel(mode: RoomMode | undefined): string {
  return mode === "party" ? "Listening party" : "Approval";
}
