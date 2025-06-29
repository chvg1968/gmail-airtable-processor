"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../index");
// Mock config – minimal for the pipeline
jest.mock("../../config", () => ({
    getInitializedConfig: () => ({
        gmailQuery: "dummy",
        geminiApiKey: "fake",
        airtableBaseId: "base",
        airtableApiKey: "key",
        airtableTableName: "Bookings",
    }),
}));
// Mock Gmail service for a Vrbo email sample
jest.mock("../../services/gmail", () => {
    const fn = (val) => jest.fn().mockResolvedValue(val);
    return {
        getGmailProfile: fn({ messagesTotal: 1 }),
        searchEmails: fn([{ id: "msg-vrbo-1", threadId: "thr-vrbo-1" }]),
        getEmailContent: fn({
            body: `Your booking is confirmed\nTraveler Name               Daniel Glaenzer\nDates                       Jun 25 - Jun 29, 2025, 4 nights`,
            subject: "Instant Booking from Daniel Glaenzer: Jun 25 - Jun 29, 2025 - Vrbo #3456633",
            date: "Tue, Jun 25 2025 08:00:00 -0500",
        }),
    };
});
// Gemini mock returns data lacking guestName and bookingDate so fallbacks must kick in
jest.mock("../../services/gemini", () => {
    const original = jest.requireActual("../../services/gemini");
    return {
        ...original,
        extractBookingInfoFromEmail: jest.fn().mockResolvedValue({
            platform: ["Vrbo"],
            reservationNumber: "3456633",
            checkInDate: "2025-06-25",
            checkOutDate: "2025-06-29",
            accommodationName: "Bahia Beach Condo",
        }),
    };
});
// Mock Airtable service to inspect data passed
jest.mock("../../services/airtable", () => {
    const upsertBookingToAirtable = jest.fn().mockResolvedValue(true);
    return {
        upsertBookingToAirtable,
        isMessageProcessed: jest.fn().mockResolvedValue(false),
    };
});
// Silence logger output
jest.mock("../../utils/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));
describe("Pipeline fallback integration for Vrbo", () => {
    it("fills guestName and bookingDate via fallbacks for Vrbo email and upserts to Airtable", async () => {
        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            json: jest.fn(),
        };
        await (0, index_1.processEmailsHandler)(req, res);
        const { upsertBookingToAirtable } = require("../../services/airtable");
        expect(upsertBookingToAirtable).toHaveBeenCalledTimes(1);
        const sent = upsertBookingToAirtable.mock.calls[0][0];
        expect(sent.platform[0]).toBe("Vrbo");
        expect(sent.guestName).toBe("Daniel Glaenzer");
        expect(sent.bookingDate).toBe("2025-06-25");
    });
});
