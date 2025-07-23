import { TaxSummary } from '@/types/reports';


 * @param year Vergi özeti istenilen yıl (default: mevcut yıl)
 */
export async function fetchTaxSummary(year: string = new Date().getFullYear().toString()): Promise<TaxSummary> {
  try {
    const response = await fetch(`/api/taxes/summary?year=${year}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Vergi özeti alınırken bir hata oluştu');
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Vergi özeti (${year}) alınırken hata:`, error);
    throw error;
  }
}

/**
 * PDF formatında vergi raporu oluşturan API fonksiyonu
 * @param year Rapor yılı
 * @param formType Form tipi (1040, scheduleD, form8949)
 */
export async function generateTaxReport(
  year: string = new Date().getFullYear().toString(),
  formType: 'schedule1040' | 'scheduleD' | 'form8949'
): Promise<Blob> {
  try {
    const response = await fetch(`/api/taxes/reports?year=${year}&formType=${formType}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/pdf',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Vergi raporu oluşturulurken bir hata oluştu');
    }
    
    return await response.blob();
  } catch (error) {
    console.error(`Vergi raporu (${formType}, ${year}) oluşturulurken hata:`, error);
    throw error;
  }
}

/**
 * Vergi optimizasyon önerilerini getiren API fonksiyonu
 * @param year Öneriler için yıl (default: mevcut yıl)
 */
export async function fetchTaxOptimizationSuggestions(
  year: string = new Date().getFullYear().toString()
): Promise<any[]> {
  try {
    const response = await fetch(`/api/taxes/suggestions?year=${year}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Vergi optimizasyon önerileri alınırken bir hata oluştu');
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Vergi optimizasyon önerileri (${year}) alınırken hata:`, error);
    throw error;
  }
}

/**
 * Aylık performans analizini getiren API fonksiyonu
 * @param year Analiz yılı (default: mevcut yıl)
 */
export async function fetchMonthlyPerformance(
  year: string = new Date().getFullYear().toString()
): Promise<any> {
  try {
    const response = await fetch(`/api/reports/monthly-performance?year=${year}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Aylık performans verileri alınırken bir hata oluştu');
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Aylık performans verileri (${year}) alınırken hata:`, error);
    throw error;
  }
} 
