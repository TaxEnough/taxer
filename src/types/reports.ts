/**
 * Vergi özeti veri tipi
 */
export interface TaxSummary {
  shortTermGains: number;
  shortTermTax: number;
  longTermGains: number;
  longTermTax: number;
  totalGains: number;
  totalTax: number;
  taxRate: number;
  monthlyData: MonthlyTaxData[];
  lastCalculated?: Date | string;
}

/**
 * Aylık vergi verisi tipi
 */
export interface MonthlyTaxData {
  month: string;
  gains: number;
  taxes: number;
}

/**
 * Vergi optimizasyon önerisi tipi
 */
export interface TaxOptimizationSuggestion {
  type: 'tax_loss_harvesting' | 'long_term_holding' | 'other';
  title: string;
  description: string;
  potentialSavings?: number;
  ticker?: string;
  daysToHold?: number;
}

/**
 * Aylık performans raporu tipi
 */
export interface MonthlyPerformanceReport {
  year: string;
  months: MonthlyPerformance[];
  totalProfit: number;
  totalTax: number;
  averageReturn: number;
  bestMonth: string;
  worstMonth: string;
}

/**
 * Aylık performans verisi tipi
 */
export interface MonthlyPerformance {
  month: string;
  profit: number;
  tax: number;
  returns: number;
  transactions: number;
} 