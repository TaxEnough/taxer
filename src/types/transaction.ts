export interface Transaction {
  id: string;
  date: string;
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  amount: number;
  fee?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

export type TransactionType = "buy" | "sell";

export const transactionTypeOptions = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
]; 