export type GuestStatus = "VIP" | "normal";

export type PaymentStatus = "full" | "not fully paid";

export type CheckInState = "not_entered" | "entered" | "left";

export type Guest = {
  id: string;
  name: string;
  phoneNumber: string;
  normalizedPhoneNumber: string;
  status: GuestStatus;
  payment: PaymentStatus;
  amountPaid?: number | string;
  checkInState: CheckInState;
  enteredAt?: string;
  leftAt?: string;
  importedAt: string;
};

export type GuestFilter =
  | "all"
  | "vip"
  | "normal"
  | "entered"
  | "not_entered"
  | "left"
  | "not_fully_paid";

export type GuestImportCandidate = Omit<Guest, "id"> & {
  id?: string;
};

export type ImportError = {
  rowNumber: number;
  messages: string[];
};

export type ImportResult = {
  guests: GuestImportCandidate[];
  errors: ImportError[];
  totalRows: number;
};

export type DashboardStats = {
  totalRegistered: number;
  totalEntered: number;
  enteredVip: number;
  enteredNormal: number;
  totalLeft: number;
  notEntered: number;
  totalVip: number;
  totalNormal: number;
  incompletePayment: number;
};
