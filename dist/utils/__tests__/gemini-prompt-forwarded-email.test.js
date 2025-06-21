"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gemini_1 = require("../../services/gemini");
const FORWARDED_EMAIL = `
---------- Forwarded message ---------
From: Airbnb <automated@airbnb.com>
Date: Wed, May 21, 2025 at 2:56 PM
Subject: Reservation confirmed - Navi Sandhu arrives Jun 10
To: luxprbahia@gmail.com

New booking confirmed! Navi arrives Jun 10.
Check-in: Tue, Jun 10
Checkout: Sat, Jun 14
Property: Bahia Beach 4 BDRM Penthouse - Villa Clara
Reservation code: HMTRNEDCNZ
`;
describe('Gemini buildPrompt robustness', () => {
    const referenceYear = 2025;
    it('should instruct Gemini to extract the booking date from the original Airbnb header in forwarded emails', () => {
        const FORWARDED_EMAIL = `
---------- Forwarded message ---------
From: Airbnb <automated@airbnb.com>
Date: Wed, May 21, 2025 at 2:56 PM
Subject: Reservation confirmed - Navi Sandhu arrives Jun 10
To: luxprbahia@gmail.com

New booking confirmed! Navi arrives Jun 10.
Check-in: Tue, Jun 10
Checkout: Sat, Jun 14
Property: Bahia Beach 4 BDRM Penthouse - Villa Clara
Reservation code: HMTRNEDCNZ
`;
        const prompt = (0, gemini_1.buildPrompt)(FORWARDED_EMAIL, referenceYear);
        // Debe contener la instrucción de buscar el bloque Forwarded y extraer la línea 'Date:'
        expect(prompt).toMatch(/If the email is a forward, search for a header block that starts with '---------- Forwarded message ---------'/);
        expect(prompt).toMatch(/extract the line starting with 'Date:'/);
        expect(prompt).toMatch(/Prioritize the original Airbnb header date over any forward date or processing date/);
        // Debe contener la fecha de ejemplo
        expect(prompt).toContain("Date: Wed, May 21, 2025 at 2:56 PM");
    });
    it('should handle direct Airbnb emails (no forward)', () => {
        const DIRECT_AIRBNB = `
From: Airbnb <automated@airbnb.com>
Date: Wed, May 21, 2025 at 2:56 PM
Subject: Reservation confirmed - John Doe arrives Jun 20
To: luxprbahia@gmail.com

New booking confirmed! John Doe arrives Jun 20.
Check-in: Thu, Jun 20
Checkout: Sun, Jun 23
Property: Beachfront Villa
Reservation code: ABC123XYZ
`;
        const prompt = (0, gemini_1.buildPrompt)(DIRECT_AIRBNB, referenceYear);
        expect(prompt).toContain('bookingDate');
        expect(prompt).toContain('YYYY-MM-DD');
        expect(prompt).toMatch(/If the email is a forward, search for a header block that starts with '---------- Forwarded message ---------'/);
    });
    it('should handle Vrbo emails', () => {
        const VRBO_EMAIL = `
From: Vrbo <no-reply@vrbo.com>
Date: Wed, May 21, 2025 at 2:56 PM
Subject: Your booking is confirmed
To: guest@email.com

Reservation confirmed! John Doe arrives Jul 10.
Check-in: Thu, Jul 10
Checkout: Sun, Jul 13
Property: Ocean Grace Villa
Reservation code: HA-987654
`;
        const prompt = (0, gemini_1.buildPrompt)(VRBO_EMAIL, referenceYear);
        expect(prompt).toContain('Vrbo');
        expect(prompt).toContain('platform');
        expect(prompt).toContain('propertyCodeVrbo');
    });
    it('should instruct to use reference year if year is missing', () => {
        const EMAIL_NO_YEAR = `
From: Airbnb <automated@airbnb.com>
Subject: Reservation confirmed - Jane Doe arrives Jun 5
To: luxprbahia@gmail.com

New booking confirmed! Jane Doe arrives Jun 5.
Check-in: Thu, Jun 5
Checkout: Sun, Jun 8
Property: Garden Villa
Reservation code: XYZ987
`;
        const prompt = (0, gemini_1.buildPrompt)(EMAIL_NO_YEAR, referenceYear);
        expect(prompt).toContain('if the year is missing, use the provided reference year');
        expect(prompt).toContain(referenceYear.toString());
    });
});
