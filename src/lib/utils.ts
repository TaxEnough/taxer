import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * className'leri birleştirmek için yardımcı fonksiyon
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Tarih formatlamak için yardımcı fonksiyon
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(dateObj);
  } catch (error) {
    console.error('Tarih formatlanırken hata:', error);
    return '-';
  }
}

/**
 * Para birimi formatlamak için yardımcı fonksiyon
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Yüzde formatlamak için yardımcı fonksiyon
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "percent",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

/**
 * Büyük sayıları kısaltmak için yardımcı fonksiyon
 * Örnek: 1000 -> 1K, 1000000 -> 1M
 */
export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    notation: "compact",
  }).format(value);
} 