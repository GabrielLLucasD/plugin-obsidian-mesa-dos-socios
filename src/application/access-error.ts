import type { ApiErrorCode } from "../shared/access-contracts.ts";

export class AccessError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "AccessError";
    this.code = code;
  }
}
