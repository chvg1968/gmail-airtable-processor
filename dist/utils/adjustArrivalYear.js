"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustArrivalYear = void 0;
// Ajusta el año del arrivalDate en formato 'MMM DD' para que nunca sea antes del bookingDate
function adjustArrivalYear(arrivalDate, bookingDate) {
    // Si arrivalDate ya tiene año, retornar igual
    if (/\d{4}/.test(arrivalDate))
        return arrivalDate;
    // Parsear bookingDate
    const booking = new Date(bookingDate);
    // Intentar arrival en el mismo año que booking
    const arrivalThisYear = new Date(`${arrivalDate} ${booking.getFullYear()}`);
    // Si arrival es antes de booking, asumir siguiente año
    if (arrivalThisYear < booking) {
        const arrivalNextYear = new Date(`${arrivalDate} ${booking.getFullYear() + 1}`);
        // Retornar en formato YYYY-MM-DD
        return arrivalNextYear.toISOString().slice(0, 10);
    }
    // Si no, retornar arrival en el año del booking
    return arrivalThisYear.toISOString().slice(0, 10);
}
exports.adjustArrivalYear = adjustArrivalYear;
