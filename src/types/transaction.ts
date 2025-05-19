export interface Transaction {
  id: string;
  date: string;
  ticker: string;
  type: "buy" | "sell" | "dividend";
  shares: number;
  price: number;
  amount: number;
  fee?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

export type TransactionType = "buy" | "sell" | "dividend";

export const transactionTypeOptions = [
  { value: "buy", label: "Alış" },
  { value: "sell", label: "Satış" },
  { value: "dividend", label: "Temettü" },
]; 