import { createHash, randomBytes } from "node:crypto";
import { Session } from "../../src/domain/session.ts";
import { RoomAccess } from "../../src/application/room-access.ts";
import { createAccessDependencies } from "../../src/infrastructure/access-dependencies.ts";

export function roomFixture(capacity = 2) {
  let time = 100000;
  let id = 0;
  const dependencies = {
    newInvite: createAccessDependencies().newInvite,
    now: () => time,
    newId: () => `id-${++id}`,
    newSecret: () => randomBytes(32).toString("base64url"),
    digest: (value) => createHash("sha256").update(value).digest("hex"),
  };
  const access = new RoomAccess(new Session("room", capacity), dependencies);
  return { access, advance: (ms) => { time += ms; }, dependencies };
}

export function admit(access, name = "Jogador") {
  const request = access.requestJoin(access.invite, name);
  const player = access.approve(request.request.id);
  return { ...request, player, ...access.claim(request.ticket) };
}
