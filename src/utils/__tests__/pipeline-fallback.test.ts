import { processEmailsHandler } from '../../index';
import type { Request, Response } from 'express';

// Mock config
jest.mock('../../config', () => ({
  getInitializedConfig: () => ({
    gmailQuery: 'dummy',
    geminiApiKey: 'fake',
    airtableBaseId: 'base',
    airtableApiKey: 'key',
    airtableTableName: 'Bookings',
  }),
}));


// Mock Gmail service
jest.mock('../../services/gmail', () => {
  const fn = (val: any) => jest.fn().mockResolvedValue(val);
  return {
    getGmailProfile: fn({ messagesTotal: 1 }),
    searchEmails: fn([
      { id: 'msg-1', threadId: 'thr-1' },
    ]),
    getEmailContent: fn({
      body: 'New booking!',
      subject: 'Reservation confirmed - Ronica Martínez arrives Jun 22',
      date: 'Sun, Jun 22 2025 06:00:00 -0500',
    }),
  };
});

// Mock Gemini service: returns data without guestName / bookingDate
jest.mock('../../services/gemini', () => {
  const original = jest.requireActual('../../services/gemini');
  return {
    ...original,
    extractBookingInfoFromEmail: jest.fn().mockResolvedValue({
      platform: ['Airbnb'],
      reservationNumber: 'ABC123',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      accommodationName: 'Villa X',
    }),
  };
});

// Mock Airtable service
jest.mock('../../services/airtable', () => {
  const upsertBookingToAirtable = jest.fn().mockResolvedValue(true);
  return {
    upsertBookingToAirtable,
    isMessageProcessed: jest.fn().mockResolvedValue(false),
  };
});

// Silence logger
jest.mock('../../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

describe('Pipeline fallback integration', () => {
  it('fills guestName and bookingDate via fallbacks and upserts to Airtable', async () => {
    // fake req/res
    const req = {} as Request;
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() } as unknown as Response;

    await processEmailsHandler(req, res);

    const { upsertBookingToAirtable } = require('../../services/airtable');
    expect(upsertBookingToAirtable).toHaveBeenCalledTimes(1);
    const dataSent = upsertBookingToAirtable.mock.calls[0][0];
    expect(dataSent.guestName.toLowerCase()).toBe('ronica martínez');
    expect(dataSent.bookingDate).toBe('2025-06-22');
  });
});
