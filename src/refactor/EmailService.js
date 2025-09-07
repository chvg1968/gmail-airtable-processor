/* global Logger GmailApp CONFIG Utils */

var EmailService = {
  calculateSearchDate: function () {
    const date = new Date();
    date.setDate(date.getDate() - CONFIG.CONSTANTS.EMAIL_SEARCH.DAYS_BACK);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  },

  buildGmailSearchQuery: function () {
    const days = CONFIG.CONSTANTS.EMAIL_SEARCH.DAYS_BACK;
    const timeFilter = `newer_than:${days}d`;
    const scope = "in:anywhere";
    // Broadened patterns to catch forwards/varied senders
    const airbnb =
      '((from:airbnb.com) OR (subject:"Reservation confirmed" AND (Airbnb OR airbnb)))';
    // Vrbo: permitimos asunto que contenga "Vrbo" ya que Lodgify puede reenviar/transformar
    const vrbo = '((from:vrbo.com OR from:homeaway.com) OR subject:(Vrbo))';
    // Lodgify: solo las confirmaciones de reserva enviadas por el messaging gateway
    // con subject que empieza con "New Confirmed Booking"
    const lodgify =
      '(from:no-reply@messaging.lodgify.com subject:"New Confirmed Booking" subject:-update -request -ticket -help -support)';
    // Exclusiones globales de remitentes de soporte/recordatorios
    const globalExcludes = "-from:help@lodgify.com";
    // Agrupar la consulta para que los excludes apliquen al conjunto
    return `${scope} ((${airbnb}) OR (${vrbo}) OR (${lodgify})) ${timeFilter} ${globalExcludes}`;
  },

  fetch: function () {
    const query = this.buildGmailSearchQuery();
    Logger.log(`[EmailService] Gmail query: ${query}`);
    const threads = GmailApp.search(query);
    Logger.log(`[EmailService] Threads encontrados: ${threads.length}`);
    const messages = threads.flatMap((t) => t.getMessages());
    Logger.log(`[EmailService] Mensajes encontrados: ${messages.length}`);
    // Orden: procesar Lodgify al final (para que preferencia Airbnb tenga oportunidad de existir primero)
    return messages.sort((a, b) => {
      const aIsL = /lodgify/i.test(a.getFrom());
      const bIsL = /lodgify/i.test(b.getFrom());
      if (aIsL === bIsL) return 0;
      return aIsL ? 1 : -1;
    });
  },

  // Alias para compatibilidad con EmailProcessor
  getMessages: function (_config) {
    return this.fetch();
  },

  getCleanBody: function (message) {
    const body = message.getBody();
    return Utils.stripForwardHeaders(body);
  },
};

// Export for GAS environment
if (typeof globalThis.EmailService === "undefined") {
  globalThis.EmailService = EmailService;
}
