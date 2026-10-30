export type JoinStatus = "pending" | "approved" | "rejected";
export type JoinRequestView = {
  id: string;
  displayName: string;
  status: JoinStatus;
  expiresAt: number;
};
export type PlayerView = { id: string; displayName: string };
export type RoomView = {
  id: string;
  maxPlayers: number;
  approvedPlayers: number;
  acceptingRequests: boolean;
};
export type MeView = { player: PlayerView; room: RoomView; expiresAt: number };
export type ApiErrorCode =
  | "ROOM_CLOSED" | "ROOM_FULL" | "ENTRY_CLOSED" | "INVALID_INVITE"
  | "INVALID_NAME" | "INVALID_REQUEST" | "REQUEST_EXPIRED" | "REQUEST_NOT_PENDING"
  | "NOT_APPROVED" | "UNAUTHENTICATED" | "NOT_FOUND" | "TOO_MANY_REQUESTS"
  | "FORBIDDEN" | "BODY_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE" | "INTERNAL_ERROR";
export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function isRoomView(value: unknown): value is RoomView {
  return record(value) && typeof value.id === "string" && Number.isSafeInteger(value.maxPlayers) &&
    typeof value.maxPlayers === "number" && value.maxPlayers > 0 &&
    typeof value.approvedPlayers === "number" && Number.isSafeInteger(value.approvedPlayers) &&
    value.approvedPlayers >= 0 && value.approvedPlayers <= value.maxPlayers && typeof value.acceptingRequests === "boolean";
}
export function isMeView(value: unknown): value is MeView {
  return record(value) && record(value.player) && typeof value.player.id === "string" &&
    typeof value.player.displayName === "string" && isRoomView(value.room) &&
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt);
}
export function isJoinRequestView(value: unknown): value is JoinRequestView {
  return record(value) && typeof value.id === "string" && typeof value.displayName === "string" &&
    typeof value.status === "string" && ["pending", "approved", "rejected"].includes(value.status) &&
    typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt);
}
