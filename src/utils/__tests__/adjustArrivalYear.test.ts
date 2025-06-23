import { adjustArrivalYear } from "../adjustArrivalYear";

/**
 * Unit tests for adjustArrivalYear utility.
 *
 * Scenarios covered:
 * 1. Arrival date after booking date within same year ⇒ keep same year.
 * 2. Arrival date before booking date ⇒ move to next year.
 * 3. Arrival date already contains year ⇒ return unchanged.
 */

describe("adjustArrivalYear", () => {
  it("keeps the same year when arrival is after booking date", () => {
    const bookingDate = "2025-06-22";
    const arrivalDate = "Aug 03";
    const result = adjustArrivalYear(arrivalDate, bookingDate);
    expect(result).toBe("2025-08-03");
  });

  it("moves arrival to next year when arrival is before booking date", () => {
    const bookingDate = "2025-12-20";
    const arrivalDate = "Jan 05";
    const result = adjustArrivalYear(arrivalDate, bookingDate);
    expect(result).toBe("2026-01-05");
  });

  it("returns the same value when arrival already has a year", () => {
    const bookingDate = "2025-04-10";
    const arrivalDate = "2025-09-01";
    const result = adjustArrivalYear(arrivalDate, bookingDate);
    expect(result).toBe("2025-09-01");
  });
});
