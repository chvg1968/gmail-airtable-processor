import { getInitializedConfig, AppConfig } from "./config";
import { stripForwardHeaders } from "./utils/email";
// Define GmailMessageMeta locally
interface GmailMessageMeta {
  id: string;
  threadId: string;
}
import {
  getGmailProfile,
  searchEmails,
  getEmailContent,
} from "./services/gmail";
import {
  extractBookingInfoFromEmail,
  ExtractedBookingData,
} from "./services/gemini";
import {
  vrboPropertyMappings as Vrbo_properties,
  airbnbPropertyMappings as Airbnb_properties,
  AirbnbProperty,
  VrboProperty,
} from "./data/propertyMappings";
import {
  upsertBookingToAirtable,
  isMessageProcessed,
} from "./services/airtable";
import { logger } from "./utils/logger";

function toTitleCase(
  str: string | null | undefined,
): string | null | undefined {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

import type { Request, Response } from "express";

// --- Bloques de utilidades (sin cambios) ---
const extractFee = (text: string, regex: RegExp): number | null => {
  const match = text.match(regex);
  if (match && match[1]) {
    const numericValue = parseFloat(match[1].replace(/,/g, ""));
    return Math.abs(numericValue);
  }
  return null;
};
const extractPaymentProcessingFee = (
  text: string,
  regex: RegExp,
): number | "TBD" | null => {
  const match = text.match(regex);
  if (match && match[1]) {
    const value = match[1].trim();
    if (value.toUpperCase() === "TBD") return "TBD";
    return parseFloat(value.replace(/,/g, ""));
  }
  return null;
};
const airbnbHostFeeRegex =
  /Host service fee \(3\.0%\)[\s\S]*?-\$([\d,]+\.\d{2})/;
const vrboBaseCommissionRegex = /Base commission[\s\S]*?\$([\d,]+\.\d{2})/;
const vrboPaymentProcessingFeeRegex =
  /Payment processing fees\*[\s\S]*?\$?([\d,]+\.\d{2}|TBD)/;
function findPropertyMapping(
  platformFromGemini: string | null,
  accommodationNameFromGemini: string | null,
  propertyCodeVrboFromGemini: string | null,
): string | null {
  if (
    platformFromGemini &&
    (platformFromGemini.toLowerCase() === "vrbo" ||
      platformFromGemini.toLowerCase() === "homeaway")
  ) {
    if (propertyCodeVrboFromGemini) {
      const codeToSearch = propertyCodeVrboFromGemini
        .replace(/^#/, "")
        .toLowerCase();
      const property = Vrbo_properties.find(
        (p: VrboProperty) => p.code.toLowerCase() === codeToSearch,
      );
      return property ? property.name : null;
    }
    return null;
  }
  if (!platformFromGemini) return null;
  const platform = platformFromGemini.toLowerCase();
  if (platform === "airbnb") {
    if (!accommodationNameFromGemini) return null;
    const nameToSearch = accommodationNameFromGemini.toLowerCase();
    const found: AirbnbProperty | undefined = Airbnb_properties.find(
      (p: AirbnbProperty) => nameToSearch.includes(p.alias.toLowerCase()),
    );
    return found ? found.name : null;
  }
  return null;
}

// --- Handler Principal Refactorizado ---
export async function processEmailsHandler(req: Request, res: Response) {
  let config: AppConfig;
  try {
    config = await getInitializedConfig();
  } catch (error) {
    logger.error("Error initializing config:", error);
    res
      .status(500)
      .send(
        "Error initializing config: " +
          (error instanceof Error ? error.message : String(error)),
      );
    return;
  }

  logger.info("Starting Gmail-Airtable email processor...");

  try {
    await getGmailProfile();
    logger.info("Gmail connection successful.");

    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setDate(fortyEightHoursAgo.getDate() - 2);
    const searchSinceDateString = `${fortyEightHoursAgo.getFullYear()}/${String(fortyEightHoursAgo.getMonth() + 1).padStart(2, "0")}/${String(fortyEightHoursAgo.getDate()).padStart(2, "0")}`;

    logger.info(`Searching emails since ${searchSinceDateString}`);
    const query = `({from:no-reply@airbnb.com subject:("Reservation confirmed" OR "Booking Confirmation")} OR {from:(no-reply@vrbo.com OR no-reply@homeaway.com OR luxeprbahia@gmail.com) (subject:("Instant Booking") "Your booking is confirmed" OR subject:("Reservation from"))}) after:${searchSinceDateString}`;
    const messages: GmailMessageMeta[] = (await searchEmails(
      query,
    )) as GmailMessageMeta[];
    logger.info(`Found ${messages ? messages.length : 0} emails.`);

    const processedReservations = new Set<string>();
    let skippedCount = 0;
    let processedInAirtableCount = 0;

    if (!messages || messages.length === 0) {
      logger.info("No new emails to process.");
    } else {
      for (const messageMeta of messages) {
        const messageId = messageMeta.id;
        logger.info(`--- Processing email (ID: ${messageId}) ---`);

        if (!messageId) {
          logger.warn("⚠️ SKIPPED: Message found without an ID.");
          skippedCount++;
          continue;
        }

        if (await isMessageProcessed(messageId, config)) {
          logger.info(
            `📬 SKIPPED: Email already processed (messageId=${messageId}).`,
          );
          skippedCount++;
          continue;
        }

        const emailContent = await getEmailContent(messageId);
        if (!emailContent || !emailContent.body) {
          logger.warn(
            `⚠️ SKIPPED: Could not retrieve full content for message ID: ${messageId}`,
          );
          skippedCount++;
          continue;
        }

        const originalBody = emailContent.body;

        // Limpiar encabezados de correos reenviados
        const cleanedBody = stripForwardHeaders(originalBody);

        const extractedData = await extractBookingInfoFromEmail(
          cleanedBody,
          config.geminiApiKey,
          new Date().getFullYear(),
        );

        // --- Fallbacks when Gemini does not return Guest Name or Booking Date ---
        if (extractedData) {
          // 1. Guest Name from email subject (Airbnb)
          const extractNameFromSubject = (subject: string): string | null => {
            // 1. Vrbo pattern: "Instant Booking from Daniel Glaenzer: Jun 25 - ..."
            const vrboMatch = subject.match(/from\s+([^:]+):/i);
            if (vrboMatch && vrboMatch[1]) {
              return toTitleCase(vrboMatch[1].trim()) ?? null;
            }
            // 2. Airbnb patterns we already handle
            const airbnbMatch =
              subject.match(/ - ([^-]+?) (?:arrives|llega)/i) ||
              subject.match(/ - ([^-]+)$/i);
            return airbnbMatch && airbnbMatch[1]
              ? (toTitleCase(airbnbMatch[1].trim()) ?? null)
              : null;
          };

          const nameFromSubject = emailContent.subject
            ? extractNameFromSubject(emailContent.subject)
            : null;

          // 1a. If Gemini did NOT return guestName, use subject.
          if (!extractedData.guestName && nameFromSubject) {
            extractedData.guestName = nameFromSubject;
          }
          // 1b. If Gemini returned only first name (single token) and subject has more, prefer subject.
          else if (
            extractedData.guestName &&
            !extractedData.guestName.includes(" ") &&
            nameFromSubject &&
            nameFromSubject
              .toLowerCase()
              .startsWith(extractedData.guestName.toLowerCase()) &&
            nameFromSubject.includes(" ")
          ) {
            extractedData.guestName = nameFromSubject;
          }

          // 2. Booking Date from Gmail header 'Date'
          if (!extractedData.bookingDate && emailContent.date) {
            const headerDate = new Date(emailContent.date);
            if (!isNaN(headerDate.getTime())) {
              const yyyy = headerDate.getFullYear();
              const mm = String(headerDate.getMonth() + 1).padStart(2, "0");
              const dd = String(headerDate.getDate()).padStart(2, "0");
              extractedData.bookingDate = `${yyyy}-${mm}-${dd}`;
            }
          }
        }

        if (!extractedData || !extractedData.reservationNumber) {
          logger.warn(
            `⚠️ SKIPPED: Could not extract reservation number from messageId=${messageId}.`,
          );
          skippedCount++;
          continue;
        }

        // --- AJUSTE DE AÑO EN CHECKIN PARA AIRBNB ---
        const platformStr = Array.isArray(extractedData.platform)
          ? extractedData.platform[0]
          : extractedData.platform;
        if (
          platformStr &&
          typeof platformStr === "string" &&
          platformStr.toLowerCase() === "airbnb" &&
          extractedData.checkInDate &&
          extractedData.bookingDate
        ) {
          // Si checkInDate no tiene año explícito (formato YYYY-MM-DD vs MM-DD)
          if (!/\d{4}/.test(extractedData.checkInDate)) {
            const { adjustArrivalYear } = await import(
              "./utils/adjustArrivalYear"
            );
            extractedData.checkInDate = adjustArrivalYear(
              extractedData.checkInDate,
              extractedData.bookingDate,
            );
          }
        }

        const platform = extractedData.platform?.[0] || "Desconocido";
        const reservationKey = `${extractedData.reservationNumber}::${platform}`;

        if (processedReservations.has(reservationKey)) {
          logger.warn(
            `🔁 SKIPPED: Duplicate reservation detected in this run: ${reservationKey}.`,
          );
          skippedCount++;
          continue;
        }
        processedReservations.add(reservationKey);

        // --- Enriquecimiento de datos (Tarifas, Fechas, etc.) ---
        const platformLower = platform.toLowerCase();
        extractedData.baseCommissionOrHostFee =
          platformLower === "airbnb"
            ? extractFee(originalBody, airbnbHostFeeRegex)
            : extractFee(originalBody, vrboBaseCommissionRegex);
        extractedData.paymentProcessingFee = platformLower.startsWith("vrbo")
          ? extractPaymentProcessingFee(
              originalBody,
              vrboPaymentProcessingFeeRegex,
            )
          : 0;

        const propertyMapping = findPropertyMapping(
          platform,
          extractedData.accommodationName ?? null,
          extractedData.propertyCodeVrbo ?? null,
        );

        // --- Usar siempre la fecha del header para Vrbo ---
        let bookingDateFinal = extractedData.bookingDate;
        if (platform.toLowerCase() === "vrbo" && emailContent.date) {
          // Convertir a YYYY-MM-DD
          const parsed = new Date(emailContent.date);
          if (!isNaN(parsed.getTime())) {
            const yyyy = parsed.getFullYear();
            const mm = String(parsed.getMonth() + 1).padStart(2, "0");
            const dd = String(parsed.getDate()).padStart(2, "0");
            bookingDateFinal = `${yyyy}-${mm}-${dd}`;
          }
        }

        const dataForAirtable: ExtractedBookingData = {
          ...extractedData,
          bookingDate: bookingDateFinal,
          guestName: toTitleCase(extractedData.guestName),
          accommodationName: propertyMapping || extractedData.accommodationName,
        };

        const success = await upsertBookingToAirtable(
          dataForAirtable,
          config,
          messageId,
        );
        if (success) {
          processedInAirtableCount++;
        } else {
          skippedCount++;
        }
      }
    }

    const summaryLog = `
[PROCESSING SUMMARY]
----------------------------------------
Emails Found: ${messages?.length || 0}
Reservations Processed in Airtable: ${processedInAirtableCount}
Skipped Emails/Reservations: ${skippedCount}
----------------------------------------
`;
    logger.info(summaryLog);

    res.status(200).json({
      message: "Email processing completed.",
      details: {
        emailsFound: messages?.length || 0,
        recordsUpserted: processedInAirtableCount,
        emailsSkipped: skippedCount,
      },
    });
  } catch (error) {
    logger.error("Error in main execution:", error);
    res.status(500).json({
      message: "Error in main execution",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Exporta la función como entry point para Google Cloud Functions
export async function mailAirtableProcessor(req: Request, res: Response) {
  await processEmailsHandler(req, res);
}

// Para pruebas locales con mocks, ejecuta manualmente otro script o descomenta el bloque original si lo necesitas.
