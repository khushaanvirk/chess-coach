import { DEFAULT_POSITION } from "chess.js";
import type { Side } from "./types";

export type PgnHeaders = Record<string, string | undefined>;

const CHESSCOM_LINK = /^https:\/\/www\.chess\.com\/game\//;
const LICHESS_SITE = /^https:\/\/lichess\.org\/\w+/;

const sha256Hex = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Stable identity for a game across reloads and re-imports. Chesskit's local
 * database id changes per save, so reviews are keyed by this instead.
 */
export const getGameKey = async (headers: PgnHeaders, sanMoves: string[]): Promise<string> => {
  if (headers.Link && CHESSCOM_LINK.test(headers.Link)) return headers.Link;
  if (headers.Site && LICHESS_SITE.test(headers.Site)) return headers.Site;

  const fingerprint = [
    headers.White ?? "",
    headers.Black ?? "",
    headers.UTCDate ?? headers.Date ?? "",
    sanMoves.join(" "),
  ].join("|");
  return `sha256:${await sha256Hex(fingerprint)}`;
};

const normalizeName = (name: string | undefined): string => (name ?? "").trim().toLowerCase();

/** Which side the user played, matched against any of their usernames. */
export const detectUserSide = (headers: PgnHeaders, usernames: string[]): Side | null => {
  const names = new Set(usernames.map(normalizeName).filter(Boolean));
  if (names.has(normalizeName(headers.White))) return "w";
  if (names.has(normalizeName(headers.Black))) return "b";
  return null;
};

/** Why the coach can't review this game, or null if it can. */
export const getUnsupportedReason = (headers: PgnHeaders): string | null => {
  const variant = headers.Variant?.trim();
  if (variant && !/^standard$/i.test(variant)) {
    return `The coach only supports standard chess, not ${variant}.`;
  }
  if (headers.FEN && headers.FEN.trim() !== DEFAULT_POSITION) {
    return "The coach doesn't support games from a custom starting position.";
  }
  return null;
};
