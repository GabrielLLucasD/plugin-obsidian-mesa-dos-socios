import { LocalServer } from "../../src/server/local-server";
import { RoomAccess } from "../../src/application/room-access";
import { Session } from "../../src/domain/session";
import { createAccessDependencies } from "../../src/infrastructure/access-dependencies";

export { LocalServer };
export function createTestAccess(capacity = 2): RoomAccess {
  return new RoomAccess(new Session("test-room", capacity), createAccessDependencies());
}
