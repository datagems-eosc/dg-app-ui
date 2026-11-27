/**
 * The single place that decides a temperature answer's query location. Today
 * it reads the temporary SQL adapter only; a structured location from the
 * service replaces it here without changing the map.
 */
import type { Message } from "@/types/chat";
import { extractQueryLocationFromSql } from "./sqlQueryLocation";

export interface QueryLocation {
  latitude: number;
  longitude: number;
  /** Where the location was read from; only the temporary SQL reader today. */
  source: "sql";
}

export function resolveQueryLocation(
  message: Pick<Message, "sqlQuery" | "latitude" | "longitude">,
): QueryLocation | null {
  // InputParams coordinates (message.latitude/longitude) are deliberately not
  // used: they have never been present in a temperature answer.
  return extractQueryLocationFromSql(message.sqlQuery);
}
