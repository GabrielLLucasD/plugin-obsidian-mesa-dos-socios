import { createHash, randomBytes, randomUUID, randomInt } from "node:crypto";
import type { AccessDependencies } from "../application/room-access";

export function createAccessDependencies(): AccessDependencies {
  return {
    newId: randomUUID,
    newInvite: () => {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const code = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
      return `${code.slice(0, 4)}-${code.slice(4)}`;
    },
    newSecret: () => randomBytes(32).toString("base64url"),
    digest: (value) => createHash("sha256").update(value).digest("hex"),
    now: Date.now,
  };
}
