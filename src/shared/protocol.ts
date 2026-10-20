export type ClientMessage = {
    type :"ping";
    requestId: string;

};

export type ServerMessage = {
    type:"pong";
    requestId: string;
};


export function isClientMessage(
    value: unknown,
): value is ClientMessage {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ){
        return false;
    }
    if (!("type" in value) || !("requestId" in value))
    {
        return false;
    }
    return (
        value.type === "ping" &&
        typeof value.requestId === "string" &&
    value.requestId.trim().length >0 &&
    value.requestId.length <= 64
    );
}


export function isServerMessage(
  value: unknown,
): value is ServerMessage {
    if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
    ){
        return false;
    }
    if (!("type" in value) || !("requestId" in value))
    {
        return false;
    }
    return (
        value.type === "pong" &&
        typeof value.requestId === "string" &&
    value.requestId.trim().length >0 &&
    value.requestId.length <= 64
    );
}
export type ParseClientMessageResult =
  | {
      ok: true;
      message: ClientMessage;
    }
  | {
      ok: false;
      reason: "invalid-json" | "invalid-message";
    };

export function parseClientMessage(
  text: string,
): ParseClientMessageResult {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    return {
      ok: false,
      reason: "invalid-json",
    };
  }

  if (!isClientMessage(value)) {
    return {
      ok: false,
      reason: "invalid-message",
    };
  }

  return {
    ok: true,
    message: value,
  };
}