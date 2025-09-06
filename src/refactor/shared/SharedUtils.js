/* eslint-disable */
/* prettier-ignore-file */
const __CONST_REF__ = (globalThis.CONSTANTS) || (typeof require !== 'undefined' && require("./Constants").CONSTANTS);

class SharedUtils {
  static extractReservationNumber(platform, subject, body) {
    try {
      const s = subject || "";
      const b = body || "";
      const text = `${s}\n${b}`;
      const pf = (platform || "").toLowerCase();
      const patterns = [];

      if (pf.includes(__CONST_REF__.PLATFORMS.AIRBNB)) {
        patterns.push(...__CONST_REF__.PATTERNS.AIRBNB_RESERVATION);
      } else if (
  pf.includes(__CONST_REF__.PLATFORMS.VRBO) ||
  pf.includes(__CONST_REF__.PLATFORMS.HOMEAWAY)
      ) {
  patterns.push(...__CONST_REF__.PATTERNS.VRBO_RESERVATION);
      }

      for (const pat of patterns) {
        const match = text.match(pat);
        if (match && match[1]) return match[1];
      }
      return "";
    } catch (_) {
      return "";
    }
  }

  static isValidDate(dateString) {
    const d = new Date(dateString);
    return d instanceof Date && !isNaN(d);
  }

  static normalizeDate(dateInput) {
    if (!dateInput) return null;
    try {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split("T")[0];
    } catch (_) {
      return null;
    }
  }

  static normalizeName(name) {
    if (!name || typeof name !== "string") return "";
    return name.toLowerCase().trim().replace(/\s+/g, " ");
  }

  static hasValidReservationData(dto) {
    if (!dto) return false;
    const hasName =
      typeof dto.guestName === "string" &&
  dto.guestName.trim().length >= __CONST_REF__.VALIDATION.MIN_GUEST_NAME_LENGTH;
    const hasCheckIn = !!dto.checkInDate && this.isValidDate(dto.checkInDate);
    const hasCheckOut = !!dto.checkOutDate && this.isValidDate(dto.checkOutDate);
    return hasName && hasCheckIn && hasCheckOut;
  }

  static createReservationKey(dto) {
    return `${dto.guestName}::${dto.checkInDate}::${dto.checkOutDate}`;
  }

  static createAirbnbKey(dto) {
    return `${dto.guestName}::${dto.checkInDate}`;
  }

  static normalizePlatform(platform) {
    return Array.isArray(platform) ? platform[0] : platform;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SharedUtils };
}
if (!globalThis.SharedUtils) {
  globalThis.SharedUtils = SharedUtils;
}
