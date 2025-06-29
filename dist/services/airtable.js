"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertBookingToAirtable = exports.isMessageProcessed = void 0;
const airtable_1 = __importDefault(require("airtable"));
const logger_1 = require("../utils/logger");
let base = null;
let airtableTableName = null;
// --- Funciones de Normalización y Formato ---
function formatDateForAirtable(dateString, hourString) {
    if (!dateString)
        return null;
    try {
        const datePart = dateString.split("T")[0];
        const [year, month, day] = datePart.split("-").map(Number);
        if (!year || !month || !day)
            throw new Error("Invalid date format.");
        const utcDate = new Date(Date.UTC(year, month - 1, day));
        if (isNaN(utcDate.getTime())) {
            logger_1.logger.error(`Invalid date: ${dateString}`);
            return null;
        }
        const finalYear = utcDate.getUTCFullYear();
        const finalMonth = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
        const finalDay = String(utcDate.getUTCDate()).padStart(2, "0");
        return hourString
            ? `${finalYear}-${finalMonth}-${finalDay}T${hourString}`
            : `${finalYear}-${finalMonth}-${finalDay}`;
    }
    catch (error) {
        logger_1.logger.error(`Error formatting date '${dateString}':`, error);
        return null;
    }
}
function normalizePlatform(platform) {
    const p = platform?.toLowerCase() || "desconocido";
    if (p.includes("vrbo") || p.includes("homeaway"))
        return "Vrbo";
    if (p.includes("airbnb"))
        return "Airbnb";
    return "Desconocido";
}
const propertyMapping_1 = require("../utils/propertyMapping");
const propertyMappings_1 = require("../data/propertyMappings");
function normalizeProperty(accommodationName, propertyCodeVrbo, platform) {
    const mapped = (0, propertyMapping_1.findPropertyMapping)(accommodationName, propertyCodeVrbo, platform, propertyMappings_1.airbnbPropertyMappings, propertyMappings_1.vrboPropertyMappings);
    return mapped ?? "Unknown Property";
}
// --- Inicialización de Airtable ---
async function initializeAirtable(config) {
    if (base && airtableTableName === config.airtableTableName)
        return;
    base = new airtable_1.default({ apiKey: config.airtableApiKey }).base(config.airtableBaseId);
    airtableTableName = config.airtableTableName;
    if (!airtableTableName) {
        throw new Error("Airtable table name not configured.");
    }
}
// --- Lógica de Interacción con Airtable ---
async function isMessageProcessed(messageId, config) {
    await initializeAirtable(config);
    if (!base || !airtableTableName) {
        logger_1.logger.error("Airtable client not initialized for isMessageProcessed check.");
        throw new Error("Airtable client not initialized.");
    }
    try {
        const records = await base(airtableTableName)
            .select({
            filterByFormula: `{Gmail Message ID} = "${messageId}"`,
            maxRecords: 1,
        })
            .firstPage();
        return records.length > 0;
    }
    catch (error) {
        logger_1.logger.error(`Error checking messageId ${messageId} in Airtable:`, error);
        return false; // Fail-safe: assume not processed on error
    }
}
exports.isMessageProcessed = isMessageProcessed;
async function upsertBookingToAirtable(rawData, config, messageId) {
    await initializeAirtable(config);
    if (!base || !airtableTableName) {
        logger_1.logger.error("Airtable client not initialized.");
        throw new Error("Airtable client not initialized.");
    }
    try {
        const platform = normalizePlatform(rawData.platform?.[0]);
        const propertyName = normalizeProperty(rawData.accommodationName, rawData.propertyCodeVrbo, platform);
        // Vrbo Review logic: check if either baseCommission or paymentProcessingFee is missing or null/empty/zero
        const baseCommission = typeof rawData.baseCommissionOrHostFee === "number"
            ? rawData.baseCommissionOrHostFee
            : null;
        const paymentProcessingFees = typeof rawData.paymentProcessingFee === "number"
            ? rawData.paymentProcessingFee
            : null;
        const vrboReviewNeeded = platform === "Vrbo" && !(baseCommission && paymentProcessingFees);
        const airtableFields = {
            "Full Name": rawData.guestName,
            Platform: platform,
            "Reservation number": rawData.reservationNumber,
            Arrival: formatDateForAirtable(rawData.checkInDate, "15:00:00"),
            "Departure Date": formatDateForAirtable(rawData.checkOutDate, "10:00:00"),
            Property: propertyName,
            Accommodation: rawData.accommodationPrice ?? 0,
            Adults: rawData.adults ?? 0,
            Children: rawData.children ?? 0,
            "Booking Date": rawData.bookingDate || null,
            Discount: rawData.discountAmount ?? 0,
            "Cleaning Fee": rawData.cleaningFee ?? 0,
            "Guest Service": rawData.guestServiceFee ?? 0,
            Taxes: rawData.taxesAmount ?? 0,
            "D. Protection": rawData.damageProtectionFee ?? 0,
            "Vrbo value 1 or Airbnb value": typeof rawData.baseCommissionOrHostFee === "number"
                ? rawData.baseCommissionOrHostFee
                : 0,
            "Vrbo value 2": rawData.paymentProcessingFee === "TBD"
                ? 0
                : rawData.paymentProcessingFee,
            "Gmail Message ID": messageId,
            "Needs Date Review": (() => {
                try {
                    if (platform.toLowerCase() !== "airbnb")
                        return false;
                    if (!rawData.checkInDate)
                        return false;
                    const checkIn = new Date(rawData.checkInDate);
                    const bookingDate = rawData.bookingDate
                        ? new Date(rawData.bookingDate)
                        : new Date();
                    const days = Math.ceil((checkIn.getTime() - bookingDate.getTime()) / (1000 * 60 * 60 * 24));
                    logger_1.logger.debug("[Needs Date Review Debug]", {
                        guest: rawData.guestName,
                        reservation: rawData.reservationNumber,
                        checkIn: rawData.checkInDate,
                        bookingDate: rawData.bookingDate,
                        checkInTS: checkIn.getTime(),
                        bookingDateTS: bookingDate.getTime(),
                        days,
                        platform,
                    });
                    if (days < 0)
                        return true; // check-in antes del bookingDate, sospechoso
                    if (checkIn.getFullYear() === 2026)
                        return true; // año ajustado
                    if (days > 330)
                        return true; // diferencia muy grande
                    return false;
                }
                catch (error) {
                    logger_1.logger.error("Error calculating Needs Date Review:", error);
                    return false;
                }
            })(),
            "Vrbo Review": vrboReviewNeeded,
        };
        for (const key in airtableFields) {
            if (airtableFields[key] === null || airtableFields[key] === undefined) {
                delete airtableFields[key];
            }
        }
        const reservationNumberToSearch = rawData.reservationNumber;
        if (!reservationNumberToSearch?.trim()) {
            logger_1.logger.error(`Invalid reservation number: '${reservationNumberToSearch}'`);
            return false;
        }
        const filterFormula = `AND({Reservation number} = "${reservationNumberToSearch.replace(/"/g, '\\"')}", {Platform} = "${platform}")`;
        const existingRecords = await base(airtableTableName)
            .select({
            filterByFormula: filterFormula,
            maxRecords: 1,
        })
            .firstPage();
        if (existingRecords.length > 0) {
            const existingRecord = existingRecords[0];
            logger_1.logger.info(`[Airtable] Updating existing reservation: ${reservationNumberToSearch} - ${platform}`);
            await base(airtableTableName).update(existingRecord.id, airtableFields);
            logger_1.logger.info(`[Airtable] Reservation updated successfully: ${reservationNumberToSearch}`);
            return true;
        }
        else {
            logger_1.logger.info(`[Airtable] Creating new reservation: ${reservationNumberToSearch} - ${platform}`);
            await base(airtableTableName).create([{ fields: airtableFields }]);
            logger_1.logger.info(`[Airtable] Reservation created successfully: ${reservationNumberToSearch}`);
            return true;
        }
    }
    catch (error) {
        logger_1.logger.error(`❌ Error interacting with Airtable for ${rawData.reservationNumber}:`, error);
        return false;
    }
}
exports.upsertBookingToAirtable = upsertBookingToAirtable;
