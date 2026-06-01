import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseCsvText, parseExcelBuffer } from "./excel";

describe("parseExcelBuffer", () => {
  it("accepts reasonable column variations and normalizes guest fields", async () => {
    const result = await parseExcelBuffer(
      workbookBuffer([
        ["Full Name", "Mobile", "Value", "Payment Status"],
        ["Ava Stone", "+1 (555) 100-2000", "vip", "fully paid"],
        ["Mina Lake", "555-100-2001", 700, "partial"],
      ]),
    );

    expect(result.errors).toEqual([]);
    expect(result.guests).toHaveLength(2);
    expect(result.guests[0]).toMatchObject({
      name: "Ava Stone",
      phoneNumber: "+1 (555) 100-2000",
      normalizedPhoneNumber: "15551002000",
      status: "VIP",
      payment: "full",
      checkInState: "not_entered",
    });
    expect(result.guests[1]).toMatchObject({
      status: "normal",
      payment: "not fully paid",
      amountPaid: 700,
    });
  });

  it("parses headerless CSV rows with value-derived status and Arabic payment statements", async () => {
    const result = await parseCsvText(
      [
        "طه كريم جابر ,7721968342,500,باقي مبلغ,",
        "علي عبد الكريم ,7704888200,700,دفع كامل,",
        "عمر مصطفى ,7727677205,vip,دفع كامل,",
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.guests).toHaveLength(3);
    expect(result.guests[0]).toMatchObject({
      name: "طه كريم جابر",
      phoneNumber: "7721968342",
      normalizedPhoneNumber: "7721968342",
      status: "normal",
      payment: "not fully paid",
      amountPaid: 500,
    });
    expect(result.guests[1]).toMatchObject({
      status: "normal",
      payment: "full",
      amountPaid: 700,
    });
    expect(result.guests[2]).toMatchObject({
      status: "VIP",
      payment: "full",
    });
  });

  it("allows duplicate phone numbers in the imported rows", async () => {
    const result = await parseCsvText(
      [
        "name,phone,value,payment,statement",
        "Ava Stone,555-100-2000,500,full,",
        "Ava Duplicate,(555) 100-2000,700,not fully paid,",
      ].join("\n"),
    );

    expect(result.errors).toEqual([]);
    expect(result.guests).toHaveLength(2);
    expect(result.guests.map((guest) => guest.normalizedPhoneNumber)).toEqual([
      "5551002000",
      "5551002000",
    ]);
  });

  it("reports missing required fields", async () => {
    const result = await parseExcelBuffer(
      workbookBuffer([
        ["name", "phone number", "value", "payment"],
        ["", "555-100-2000", "500", "full"],
        ["Ava Stone", "(555) 100-2000", "vip", "full"],
      ]),
    );

    expect(result.guests).toHaveLength(1);
    expect(result.errors).toEqual([
      {
        rowNumber: 2,
        messages: ["Missing required name."],
      },
    ]);
  });

  it("reports missing required columns", async () => {
    const result = await parseExcelBuffer(
      workbookBuffer([
        ["Full Name", "Mobile"],
        ["Ava Stone", "555-100-2000"],
      ]),
    );

    expect(result.guests).toEqual([]);
    expect(result.errors[0]?.messages).toEqual([
      "Missing value column.",
      "Missing payment or statement column.",
    ]);
  });
});

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Guests");

  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
