/* eslint-disable */
/* prettier-ignore-file */
const { TestFramework, Assert } = require("./TestFramework");
const { SharedUtils } = require("../shared/SharedUtils");
const { CONSTANTS } = require("../shared/Constants");

function runSharedUtilsTests() {
  const tf = new TestFramework();

  tf.test("SharedUtils.hasValidReservationData - válido", () => {
    const dto = {
      guestName: "John Doe",
      checkInDate: "2025-12-01",
      checkOutDate: "2025-12-05",
    };
    Assert.isTrue(SharedUtils.hasValidReservationData(dto));
  });

  tf.test("SharedUtils.hasValidReservationData - inválido (sin fechas)", () => {
    const dto = { guestName: "John Doe" };
    Assert.isFalse(SharedUtils.hasValidReservationData(dto));
  });

  tf.test("SharedUtils.createReservationKey - genera clave estable", () => {
    const dto = {
      guestName: "Jane Roe",
      checkInDate: "2025-01-10",
      checkOutDate: "2025-01-12",
    };
    const key = SharedUtils.createReservationKey(dto);
    Assert.equals(key, "Jane Roe::2025-01-10::2025-01-12");
  });

  // normalizeDate
  tf.test("SharedUtils.normalizeDate - ISO", () => {
    Assert.equals(SharedUtils.normalizeDate("2024-12-25"), "2024-12-25");
  });

  tf.test("SharedUtils.normalizeDate - US", () => {
    Assert.equals(SharedUtils.normalizeDate("12/25/2024"), "2024-12-25");
  });

  tf.test("SharedUtils.normalizeDate - Date object", () => {
    Assert.equals(SharedUtils.normalizeDate(new Date("2024-12-25")), "2024-12-25");
  });

  tf.test("SharedUtils.normalizeDate - inválida", () => {
    Assert.isNull(SharedUtils.normalizeDate("xx/yy/zzzz"));
  });

  // normalizeName
  tf.test("SharedUtils.normalizeName - espacios y mayúsculas", () => {
    Assert.equals(SharedUtils.normalizeName("  MARIA   GONZALEZ  "), "maria gonzalez");
  });

  tf.test("SharedUtils.normalizeName - null/number", () => {
    Assert.equals(SharedUtils.normalizeName(null), "");
    Assert.equals(SharedUtils.normalizeName(123), "");
  });

  // extractReservationNumber (por plataforma)
  tf.test("SharedUtils.extractReservationNumber - Airbnb", () => {
    const num = SharedUtils.extractReservationNumber(
      CONSTANTS.PLATFORMS.AIRBNB,
      "Reservation code: ABC123",
      ""
    );
    Assert.equals(num, "ABC123");
  });

  tf.test("SharedUtils.extractReservationNumber - VRBO/HomeAway", () => {
    const num = SharedUtils.extractReservationNumber(
      CONSTANTS.PLATFORMS.VRBO,
      "Your booking",
      "Reservation 12345678 details"
    );
    Assert.equals(num, "12345678");
  });

  // normalizePlatform
  tf.test("SharedUtils.normalizePlatform - array/string", () => {
    Assert.equals(SharedUtils.normalizePlatform(["airbnb", "vrbo"]), "airbnb");
    Assert.equals(SharedUtils.normalizePlatform("vrbo"), "vrbo");
  });

  tf.runAll();
}

module.exports = { runSharedUtilsTests };
