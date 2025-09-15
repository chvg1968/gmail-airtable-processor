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

    // Filtros simplificados basados en el trigger de n8n
    // Solo correos de confirmación reales de plataformas principales
    const airbnb = 'from:@airbnb.com subject:"Reservation confirmed"';
    const lodgify = 'from:no-reply@messaging.lodgify.com subject:"New Confirmed Booking"';
    const vrbo = '(from:@homeaway.com OR from:@vrbo.com) subject:"confirmed booking"';

    // Exclusiones mínimas: solo soporte y ayuda
    const globalExcludes = "-from:help@lodgify.com -subject:(update OR request OR ticket OR help OR support)";

    return `${scope} ((${airbnb}) OR (${lodgify}) OR (${vrbo})) ${timeFilter} ${globalExcludes}`;
  },

  fetch: function () {
    const query = this.buildGmailSearchQuery();
    Logger.log(`[EmailService] Gmail query: ${query}`);
    const threads = GmailApp.search(query);
    Logger.log(`[EmailService] Threads encontrados: ${threads.length}`);
    const messages = threads.flatMap((t) => t.getMessages());
    Logger.log(`[EmailService] Mensajes encontrados: ${messages.length}`);
    // Procesar en orden cronológico (más reciente primero)
    return messages.sort((a, b) => b.getDate() - a.getDate());
  },

  getCleanBody: function (message) {
    const body = message.getBody();
    return Utils.stripForwardHeaders(body);
  },
};
