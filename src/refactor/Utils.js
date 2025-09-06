/**
 * Utilidades compartidas (alineadas a googlescript.js)
 */
/* global Logger */

const Utils = (() => {
  function sanitizeMoneyUSD(v) {
    if (v === null || v === undefined || v === "") return 0;
    let n =
      typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.]/g, ""));
    if (!isFinite(n)) return 0;
    if (n >= 100000) {
      const div = n / 100;
      if (div < 100000) n = div;
    }
    return Math.round(n * 100) / 100;
  }

  function formatDateForAirtable(dateString, hourString) {
    if (!dateString) return null;
    try {
      const datePart = String(dateString).split("T")[0];
      const [y, m, d] = datePart.split("-").map(Number);
      if (!y || !m || !d) throw new Error("Invalid date format");
      const utc = new Date(Date.UTC(y, m - 1, d));
      if (isNaN(utc.getTime())) return null;
      const yyyy = utc.getUTCFullYear();
      const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(utc.getUTCDate()).padStart(2, "0");
      return hourString
        ? `${yyyy}-${mm}-${dd}T${hourString}`
        : `${yyyy}-${mm}-${dd}`;
    } catch (e) {
      // Log protegido para entornos sin Logger (Node tests)
      try {
        var _msg =
          "[Utils] formatDateForAirtable error for '" +
          String(dateString) +
          "': " +
          String(e);
        Logger.log(_msg);
      } catch (_err) {
        /* no-op */
      }
      return "";
    }
  }

  function formatPhoneNumber(phone) {
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, "");
    if (!digits) return null;
    return `+${digits}`; // simple canonical E.164-like
  }

  function toTitleCase(str) {
    if (!str) return str;
    return String(str)
      .toLowerCase()
      .replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
  }

  function adjustArrivalYear(dateStr, currentYear) {
    if (!dateStr) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const nowYear = currentYear || new Date().getFullYear();
    // Si la fecha es demasiado en el pasado/futuro sin año explícito, ajusta
    if (d.getFullYear() < nowYear - 1) d.setFullYear(nowYear);
    return d.toISOString().slice(0, 10);
  }

  function calculateNeedsDateReview(checkIn, checkOut, maxDaysAhead) {
    try {
      if (!checkIn || !checkOut) return true;
      const ci = new Date(checkIn);
      const co = new Date(checkOut);
      if (isNaN(ci) || isNaN(co)) return true;
      const diffDays = (co - ci) / (1000 * 60 * 60 * 24);
      if (diffDays <= 0 || diffDays > 60) return true; // heurística
      const daysAhead = (ci - new Date()) / (1000 * 60 * 60 * 24);
      return daysAhead > maxDaysAhead;
    } catch (_) {
      return true;
    }
  }

  function stripForwardHeaders(body) {
    const marker = "---------- Forwarded message ---------";
    const idx = body ? body.lastIndexOf(marker) : -1;
    if (idx === -1) return body || "";
    const headerEnd = body.indexOf("\n\n", idx);
    return headerEnd === -1 ? body : body.substring(headerEnd).trim();
  }

  return {
    sanitizeMoneyUSD,
    formatDateForAirtable,
    formatPhoneNumber,
    toTitleCase,
    adjustArrivalYear,
    calculateNeedsDateReview,
    stripForwardHeaders,
  };
})();

// Export/Expose for Node and GAS environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = Utils;
}
// Ensure global availability in GAS (and Node if desired)
if (typeof globalThis !== "undefined" && !globalThis.Utils) {
  globalThis.Utils = Utils;
}
