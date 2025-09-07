/* eslint-disable */
/* prettier-ignore-file */

/**
 * TEST DE DEBUG PARA ENTENDER FALLOS
 */

const SimpleEmailProcessor = require("../processors/SimpleEmailProcessor");

function debugFailedEmails() {
  console.log("=== DEBUG DE EMAILS FALLIDOS ===\n");
  
  const failedEmails = [
    {
      name: "Airbnb #ABC123",
      subject: "Your reservation #ABC123 is confirmed - Mike arriving Jan 15, 2025",
      from: "automated-noreply@airbnb.com"
    },
    {
      name: "Lodgify BOOKING",
      subject: "BOOKING (#B15831191) - Steven Kopel arriving Oct 16 2025",
      from: "noreply@lodgify.com"
    },
    {
      name: "VRBO Booking Confirmation",
      subject: "Booking Confirmation #123456 - David Lee arrives July 4th, 2025",
      from: "noreply@vrbo.com"
    },
    {
      name: "VRBO Your reservation",
      subject: "Your VRBO reservation B987654 confirmed - Lisa arriving June 1, 2025",
      from: "noreply@vrbo.com"
    }
  ];
  
  failedEmails.forEach(email => {
    console.log(`🔍 Testing: ${email.name}`);
    console.log(`   Subject: "${email.subject}"`);
    console.log(`   From: "${email.from}"`);
    
    // Test identificación de plataforma
    const platform = SimpleEmailProcessor.identifyPlatform ? 
      SimpleEmailProcessor.identifyPlatform(email.from) : 'function not exported';
    console.log(`   Platform: ${platform}`);
    
    // Test validación de confirmación
    // Note: Esta función puede no estar exportada
    console.log(`   Confirmation patterns check...`);
    
    // Test procesamiento completo
    const result = SimpleEmailProcessor.processReservationEmail(email.from, email.subject, "Test body");
    console.log(`   Result: ${result ? 'SUCCESS' : 'NULL'}`);
    
    if (result) {
      console.log(`   ✅ Data:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`   ❌ No data extracted`);
    }
    
    console.log(""); // spacer
  });
}

debugFailedEmails();
