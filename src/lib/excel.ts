import type {
  GuestImportCandidate,
  GuestStatus,
  ImportError,
  ImportResult,
  PaymentStatus,
} from "../types/guest";
import { normalizePhoneNumber } from "./phone";

type CanonicalColumn = "name" | "phoneNumber" | "value" | "payment" | "statement";

type HeaderMap = Partial<Record<CanonicalColumn, number>>;
type XlsxModule = typeof import("xlsx");
type XlsxWorkbook = import("xlsx").WorkBook;

const COLUMN_ALIASES: Record<string, CanonicalColumn> = {
  name: "name",
  fullname: "name",
  guestname: "name",
  attendee: "name",
  attendeename: "name",
  phone: "phoneNumber",
  phonevalue: "phoneNumber",
  phonenumber: "phoneNumber",
  mobile: "phoneNumber",
  mobilenumber: "phoneNumber",
  cell: "phoneNumber",
  cellphone: "phoneNumber",
  value: "value",
  amount: "value",
  amountpaid: "value",
  paidamount: "value",
  paid: "value",
  payment: "payment",
  paymentstatement: "payment",
  paymentstatus: "payment",
  paidstatus: "payment",
  statement: "statement",
};

export async function parseRosterFile(file: File): Promise<ImportResult> {
  if (file.name.toLocaleLowerCase().endsWith(".csv")) {
    return parseCsvText(await file.text());
  }

  return parseExcelBuffer(await file.arrayBuffer());
}

export async function parseExcelFile(file: File): Promise<ImportResult> {
  return parseRosterFile(file);
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ImportResult> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

  return parseWorkbook(workbook, XLSX);
}

export async function parseCsvText(csvText: string): Promise<ImportResult> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(csvText, { type: "string", raw: false });

  return parseWorkbook(workbook, XLSX);
}

function parseWorkbook(workbook: XlsxWorkbook, XLSX: XlsxModule): ImportResult {
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      guests: [],
      errors: [{ rowNumber: 1, messages: ["File does not contain a worksheet."] }],
      totalRows: 0,
    };
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return {
      guests: [],
      errors: [{ rowNumber: 1, messages: ["First worksheet could not be read."] }],
      totalRows: 0,
    };
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  if (rows.length === 0) {
    return {
      guests: [],
      errors: [{ rowNumber: 1, messages: ["Worksheet is empty."] }],
      totalRows: 0,
    };
  }

  const headerRow = rows[0] ?? [];
  const headerMode = getHeaderMode(headerRow);

  if (headerMode.errors.length > 0) {
    return {
      guests: [],
      errors: [{ rowNumber: 1, messages: headerMode.errors }],
      totalRows: Math.max(rows.length - 1, 0),
    };
  }

  const importedAt = new Date().toISOString();
  const guests: GuestImportCandidate[] = [];
  const errors: ImportError[] = [];
  const dataRows = headerMode.hasHeader ? rows.slice(1) : rows;

  dataRows.forEach((row, index) => {
    const rowNumber = index + (headerMode.hasHeader ? 2 : 1);
    const rowMessages: string[] = [];
    const rawName = readCell(row, headerMode.headerMap.name);
    const rawPhone = readCell(row, headerMode.headerMap.phoneNumber);
    const rawValue = readCell(row, headerMode.headerMap.value);
    const rawPayment = firstNonEmptyCell(
      readCell(row, headerMode.headerMap.payment),
      readCell(row, headerMode.headerMap.statement),
    );
    const name = normalizeText(rawName);
    const phoneNumber = normalizeText(rawPhone);
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const rosterValue = normalizeRosterValue(rawValue);
    const payment = normalizePayment(rawPayment);

    if (!name) {
      rowMessages.push("Missing required name.");
    }

    if (!phoneNumber) {
      rowMessages.push("Missing required phone number.");
    }

    if (!normalizedPhoneNumber) {
      rowMessages.push("Phone number is invalid after normalization.");
    }

    if (!rosterValue) {
      rowMessages.push("Missing required value.");
    }

    if (!payment) {
      rowMessages.push("Payment must be full or not fully paid.");
    }

    if (rowMessages.length > 0) {
      errors.push({ rowNumber, messages: rowMessages });
      return;
    }

    const guest: GuestImportCandidate = {
      name,
      phoneNumber,
      normalizedPhoneNumber,
      status: rosterValue?.status ?? "normal",
      payment: payment ?? "not fully paid",
      checkInState: "not_entered",
      importedAt,
    };

    if (rosterValue?.displayValue !== undefined) {
      guest.amountPaid = rosterValue.displayValue;
    }

    guests.push(guest);
  });

  return {
    guests,
    errors,
    totalRows: Math.max(rows.length - 1, 0),
  };
}

function loadXlsx(): Promise<XlsxModule> {
  return import("xlsx");
}

function getHeaderMode(headerRow: unknown[]): {
  headerMap: HeaderMap;
  hasHeader: boolean;
  errors: string[];
} {
  const headerMap = buildHeaderMap(headerRow);
  const knownHeaderCount = Object.keys(headerMap).length;

  if (knownHeaderCount === 0) {
    return {
      headerMap: {
        name: 0,
        phoneNumber: 1,
        value: 2,
        payment: 3,
        statement: 4,
      },
      hasHeader: false,
      errors: [],
    };
  }

  return {
    headerMap,
    hasHeader: true,
    errors: validateHeaderMap(headerMap),
  };
}

function buildHeaderMap(headerRow: unknown[]): HeaderMap {
  return headerRow.reduce<HeaderMap>((map, header, index) => {
    const normalizedHeader = normalizeHeaderName(header);
    const canonicalColumn = COLUMN_ALIASES[normalizedHeader];

    if (canonicalColumn && map[canonicalColumn] === undefined) {
      map[canonicalColumn] = index;
    }

    return map;
  }, {});
}

function validateHeaderMap(headerMap: HeaderMap): string[] {
  const errors: string[] = [];

  if (headerMap.name === undefined) {
    errors.push("Missing name column.");
  }

  if (headerMap.phoneNumber === undefined) {
    errors.push("Missing phone number column.");
  }

  if (headerMap.value === undefined) {
    errors.push("Missing value column.");
  }

  if (headerMap.payment === undefined && headerMap.statement === undefined) {
    errors.push("Missing payment or statement column.");
  }

  return errors;
}

function normalizeHeaderName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function readCell(row: unknown[], columnIndex: number | undefined): unknown {
  if (columnIndex === undefined) {
    return "";
  }

  return row[columnIndex] ?? "";
}

function firstNonEmptyCell(...values: unknown[]): unknown {
  return values.find((value) => normalizeText(value) !== "") ?? "";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeRosterValue(
  value: unknown,
): { status: GuestStatus; displayValue?: number | string } | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      status: "normal",
      displayValue: value,
    };
  }

  const normalized = normalizeText(value);

  if (!normalized) {
    return undefined;
  }

  if (normalized.toLocaleLowerCase() === "vip") {
    return {
      status: "VIP",
    };
  }

  return {
    status: "normal",
    displayValue: normalized,
  };
}

function normalizePayment(value: unknown): PaymentStatus | undefined {
  const normalizedText = normalizeText(value).toLocaleLowerCase();
  const normalizedArabic = normalizedText.replace(/\s+/g, "");
  const normalized = normalizedText.replace(/[^a-z]/g, "");

  if (normalizedArabic === "دفعكامل") {
    return "full";
  }

  if (normalizedArabic === "باقيمبلغ") {
    return "not fully paid";
  }

  if (["full", "paid", "fullypaid", "complete", "completed"].includes(normalized)) {
    return "full";
  }

  if (
    [
      "notfullypaid",
      "notfull",
      "partial",
      "partiallypaid",
      "unpaid",
      "incomplete",
      "pending",
    ].includes(normalized)
  ) {
    return "not fully paid";
  }

  return undefined;
}
