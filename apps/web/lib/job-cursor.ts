export function decodeJobCursor(value: string | undefined) {
  if (!value) return null;
  try {
    const [discoveredAt, id, extra] = Buffer.from(value, "base64url").toString("utf8").split("|");
    if (extra !== undefined || !discoveredAt || !id || Number.isNaN(Date.parse(discoveredAt)) || !/^[1-9][0-9]*$/.test(id)) return null;
    return { discoveredAt, id };
  } catch {
    return null;
  }
}

export function encodeJobCursor(discoveredAt: string, id: number) {
  if (Number.isNaN(Date.parse(discoveredAt)) || !Number.isSafeInteger(id) || id < 1) throw new Error("Invalid job cursor input");
  return Buffer.from(`${discoveredAt}|${id}`).toString("base64url");
}
