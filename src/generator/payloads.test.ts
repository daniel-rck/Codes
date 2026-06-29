import { describe, expect, it } from "vitest";
import {
  buildBitcoin,
  buildEmail,
  buildEvent,
  buildGeo,
  buildMeCard,
  buildSms,
  buildTel,
  buildUrl,
  buildVCard,
  buildWifi,
  toICalDate,
  validate,
} from "./payloads.ts";

describe("URL builder", () => {
  it("keeps an existing scheme", () => {
    expect(buildUrl({ url: "https://example.com" })).toBe("https://example.com");
    expect(buildUrl({ url: "mailto:a@b.de" })).toBe("mailto:a@b.de");
  });
  it("prepends https:// when no scheme", () => {
    expect(buildUrl({ url: "example.com/x" })).toBe("https://example.com/x");
  });
});

describe("WiFi builder", () => {
  it("builds a WPA payload", () => {
    expect(buildWifi({ ssid: "Home", password: "secret", encryption: "WPA" })).toBe(
      "WIFI:T:WPA;S:Home;P:secret;;",
    );
  });
  it("omits password for open networks", () => {
    expect(buildWifi({ ssid: "Free", encryption: "nopass" })).toBe("WIFI:T:nopass;S:Free;;");
  });
  it("escapes special characters and marks hidden", () => {
    expect(buildWifi({ ssid: "My;Net", password: "a,b\\c", hidden: true })).toBe(
      "WIFI:T:WPA;S:My\\;Net;P:a\\,b\\\\c;H:true;;",
    );
  });
});

describe("email / sms / tel builders", () => {
  it("builds mailto with subject and body", () => {
    expect(buildEmail({ to: "a@b.de", subject: "Hi there", body: "Line 1" })).toBe(
      "mailto:a@b.de?subject=Hi%20there&body=Line%201",
    );
  });
  it("builds SMSTO", () => {
    expect(buildSms({ number: "+49 170 1234567", message: "hello" })).toBe(
      "SMSTO:+491701234567:hello",
    );
  });
  it("builds tel", () => {
    expect(buildTel({ number: "+49 (170) 123" })).toBe("tel:+49170123");
  });
});

describe("geo builder", () => {
  it("builds geo with and without altitude", () => {
    expect(buildGeo({ lat: 48.137, lon: 11.575 })).toBe("geo:48.137,11.575");
    expect(buildGeo({ lat: 48.137, lon: 11.575, altitude: 520 })).toBe("geo:48.137,11.575,520");
  });
});

describe("vCard / MeCard builders", () => {
  it("builds a vCard 3.0 with FN and N", () => {
    const out = buildVCard({
      firstName: "Jane",
      lastName: "Doe",
      phone: "+49123",
      email: "j@d.de",
    });
    expect(out).toContain("BEGIN:VCARD");
    expect(out).toContain("VERSION:3.0");
    expect(out).toContain("N:Doe;Jane;;;");
    expect(out).toContain("FN:Jane Doe");
    expect(out).toContain("TEL;TYPE=CELL:+49123");
    expect(out).toContain("END:VCARD");
  });
  it("builds a MeCard", () => {
    expect(buildMeCard({ firstName: "Jane", lastName: "Doe", phone: "+49123" })).toBe(
      "MECARD:N:Doe,Jane;TEL:+49123;;",
    );
  });
});

describe("event builder", () => {
  it("formats iCal dates as basic UTC", () => {
    expect(toICalDate("2026-01-01T09:00:00Z")).toBe("20260101T090000Z");
  });
  it("builds a VEVENT", () => {
    const out = buildEvent({
      summary: "Launch",
      start: "2026-01-01T09:00:00Z",
      end: "2026-01-01T10:00:00Z",
      location: "Berlin",
    });
    expect(out).toContain("BEGIN:VEVENT");
    expect(out).toContain("SUMMARY:Launch");
    expect(out).toContain("DTSTART:20260101T090000Z");
    expect(out).toContain("DTEND:20260101T100000Z");
    expect(out).toContain("LOCATION:Berlin");
  });
});

describe("bitcoin builder", () => {
  it("builds a BIP21 URI with params", () => {
    expect(
      buildBitcoin({ address: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT", amount: 0.5, label: "Tip" }),
    ).toBe("bitcoin:1BoatSLRHtKNngkdXEeobR76b53LETtpyT?amount=0.5&label=Tip");
  });
});

describe("validation", () => {
  it("rejects empty url and accepts a value", () => {
    expect(validate("url", { url: "" }).ok).toBe(false);
    expect(validate("url", { url: "x.de" }).ok).toBe(true);
  });
  it("validates email format", () => {
    expect(validate("email", { to: "nope" }).ok).toBe(false);
    expect(validate("email", { to: "a@b.de" }).ok).toBe(true);
  });
  it("bounds geo coordinates", () => {
    expect(validate("geo", { lat: 99, lon: 0 }).ok).toBe(false);
    expect(validate("geo", { lat: 48, lon: 11 }).ok).toBe(true);
  });
  it("requires a name for contact cards", () => {
    expect(validate("vcard", {}).ok).toBe(false);
    expect(validate("vcard", { firstName: "Jane" }).ok).toBe(true);
  });
});
