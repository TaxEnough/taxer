'use client';

import { useState } from 'react';


interface Stock {
    id: string;
    symbol: string;
    purchasePrice: number;
    sellingPrice: number;
    sharesSold: number;
    tradingFees: number;
    holdingPeriod: number;
    gainLoss?: number;
    isShortTerm?: boolean;
}


interface Results {
    shortTermGains: number;
    longTermGains: number;
    totalLosses: number;
    shortTermLossesApplied: number;
    longTermLossesApplied: number;
    lossesAppliedToIncome: number;
    remainingLossCarryforward: number;
    shortTermTax: number;
    longTermTax: number;
    niitTax: number;
    ordinaryIncomeTax: number;
    totalTaxes: number;
}

// Vergi dilimleri için tip tanımlamaları
interface TaxBracket {
    rate: number;
    threshold: number;
}

export default function StockTaxCalculator() {
    const [stocks, setStocks] = useState<Stock[]>([
        { id: '1', symbol: '', purchasePrice: 0, sellingPrice: 0, sharesSold: 0, tradingFees: 0, holdingPeriod: 0 }
    ]);
    const [totalIncome, setTotalIncome] = useState<number>(0);
    const [results, setResults] = useState<Results | null>(null);


    const addStock = () => {
        const newId = String(new Date().getTime());
        setStocks([...stocks, { 
            id: newId, 
            symbol: '', 
            purchasePrice: 0, 
            sellingPrice: 0, 
            sharesSold: 0, 
            tradingFees: 0, 
            holdingPeriod: 0 
        }]);
    };

    // Stock silme
    const removeStock = (id: string) => {
        if (stocks.length === 1) {
            // Don't remove the last stock, just reset it
            setStocks([{ 
                id: '1', 
                symbol: '', 
                purchasePrice: 0, 
                sellingPrice: 0, 
                sharesSold: 0, 
                tradingFees: 0, 
                holdingPeriod: 0 
            }]);
        } else {
            setStocks(stocks.filter(stock => stock.id !== id));
        }
    };

    // Stock değeri değiştiğinde
    const handleStockChange = (id: string, field: keyof Stock, value: string | number) => {
        setStocks(stocks.map(stock => {
            if (stock.id === id) {
                // Parse string values to numbers where needed
                const parsedValue = ['purchasePrice', 'sellingPrice', 'sharesSold', 'tradingFees', 'holdingPeriod'].includes(field)
                    ? parseFloat(value as string) || 0
                    : value;
                
                const updatedStock = { ...stock, [field]: parsedValue };
                
                // Calculate gain/loss and determine if short-term
                const gainLoss = (updatedStock.sellingPrice - updatedStock.purchasePrice) * updatedStock.sharesSold - updatedStock.tradingFees;
                const isShortTerm = updatedStock.holdingPeriod < 12;
                
                return { 
                    ...updatedStock, 
                    gainLoss: gainLoss,
                    isShortTerm: isShortTerm 
                };
            }
            return stock;
        }));
    };

    // 2024 kısa vadeli vergi dilimleri (tek kişi beyannamesi)
    const shortTermTaxBrackets: TaxBracket[] = [
        { rate: 0.10, threshold: 0 },
        { rate: 0.12, threshold: 11601 },
        { rate: 0.22, threshold: 47151 },
        { rate: 0.24, threshold: 100526 },
        { rate: 0.32, threshold: 191951 },
        { rate: 0.35, threshold: 243726 },
        { rate: 0.37, threshold: 609351 }
    ];

    // 2024 uzun vadeli sermaye kazancı dilimleri (tek kişi beyannamesi)
    const longTermTaxBrackets: TaxBracket[] = [
        { rate: 0.00, threshold: 0 },
        { rate: 0.15, threshold: 47025 },
        { rate: 0.20, threshold: 518900 }
    ];

    // Tax.md'ye uygun tam vergi hesaplama algoritması
    const calculateTaxes = () => {
        console.log("=== VERGİ HESAPLAMA BAŞLIYOR (2024) ===");
        
        // Validate income input
        if (totalIncome <= 0) {
            alert('Lütfen geçerli bir toplam vergilendirilebilir gelir girin');
            return;
        }

        // 1. KAZANÇ VE KAYIPLARI HESAPLA
        let shortTermGains = 0;
        let longTermGains = 0;
        let totalLosses = 0;

        // Her hisse senedi işlemi için kazanç/kayıp hesapla
        stocks.forEach(stock => {
            // Yetersiz veri olan hisseleri atla
            if (!stock.symbol || stock.sharesSold <= 0) return;

            // Kazanç/kayıp hesapla: (Satış fiyatı - Alış fiyatı) × Hisse adedi - İşlem ücretleri
            const gainLoss = (stock.sellingPrice - stock.purchasePrice) * stock.sharesSold - stock.tradingFees;
            const isShortTerm = stock.holdingPeriod < 12;
            
            console.log(`Hisse ${stock.symbol}:`);
            console.log(`  Alış: $${stock.purchasePrice}, Satış: $${stock.sellingPrice}, Adet: ${stock.sharesSold}, Ücret: $${stock.tradingFees}`);
            console.log(`  Elde Tutma Süresi: ${stock.holdingPeriod} ay, Kazanç/Kayıp: ${formatCurrency(gainLoss)}`);

            if (gainLoss > 0) {
                // 12 aydan az elde tutulursa kısa vadeli, 12 ay ve üzeri uzun vadeli
                if (isShortTerm) {
                    shortTermGains += gainLoss;
                    console.log(`  Kısa vadeli kazanç: ${formatCurrency(gainLoss)}`);
                } else {
                    longTermGains += gainLoss;
                    console.log(`  Uzun vadeli kazanç: ${formatCurrency(gainLoss)}`);
                }
            } else if (gainLoss < 0) {
                // Kayıplar için mutlak değeri alıyoruz
                totalLosses += Math.abs(gainLoss);
                console.log(`  Kayıp: ${formatCurrency(Math.abs(gainLoss))}`);
            }
        });

        console.log(`\nToplam kısa vadeli kazanç: ${formatCurrency(shortTermGains)}`);
        console.log(`Toplam uzun vadeli kazanç: ${formatCurrency(longTermGains)}`);
        console.log(`Toplam kayıplar: ${formatCurrency(totalLosses)}`);

        // 2. KAYIPLARI DENGE ALTINA AL (tax.md kurallarına göre)
        let remainingLosses = totalLosses;
        let shortTermLossesApplied = 0;
        let longTermLossesApplied = 0;
        let lossesAppliedToIncome = 0;

        // a) Önce kısa vadeli kazançlardan kayıpları düş
        if (remainingLosses > 0 && shortTermGains > 0) {
            shortTermLossesApplied = Math.min(remainingLosses, shortTermGains);
            shortTermGains -= shortTermLossesApplied;
            remainingLosses -= shortTermLossesApplied;
            console.log(`\nKısa vadeli kazançlardan düşülen kayıp: ${formatCurrency(shortTermLossesApplied)}`);
            console.log(`Kalan kısa vadeli kazançlar: ${formatCurrency(shortTermGains)}`);
        }

        // b) Sonra uzun vadeli kazançlardan kayıpları düş
        if (remainingLosses > 0 && longTermGains > 0) {
            longTermLossesApplied = Math.min(remainingLosses, longTermGains);
            longTermGains -= longTermLossesApplied;
            remainingLosses -= longTermLossesApplied;
            console.log(`\nUzun vadeli kazançlardan düşülen kayıp: ${formatCurrency(longTermLossesApplied)}`);
            console.log(`Kalan uzun vadeli kazançlar: ${formatCurrency(longTermGains)}`);
        }

        // c) Kalan $3000'a kadar olan kayıpları gelirden düş (tax.md'ye göre)
        if (remainingLosses > 0) {
            lossesAppliedToIncome = Math.min(remainingLosses, 3000);
            remainingLosses -= lossesAppliedToIncome;
            console.log(`\nGelirden düşülen kayıp (max $3000): ${formatCurrency(lossesAppliedToIncome)}`);
        }
        
        // d) Gelecek yıla devreden kayıplar
        const remainingLossCarryforward = remainingLosses;
        if (remainingLossCarryforward > 0) {
            console.log(`\nGelecek yıla devreden kayıp: ${formatCurrency(remainingLossCarryforward)}`);
        }

        // 3. TOPLAM GELİRİ HESAPLA (Normal Gelir + Yatırım Gelirleri)
        const totalAdjustedIncome = totalIncome + shortTermGains + longTermGains;
        const adjustedIncome = Math.max(0, totalIncome - lossesAppliedToIncome);
        
        console.log(`\nNormal gelir: ${formatCurrency(totalIncome)}`);
        console.log(`Toplam gelir (normal + yatırım): ${formatCurrency(totalAdjustedIncome)}`);
        console.log(`Düzeltilmiş gelir (kayıp indirimi sonrası): ${formatCurrency(adjustedIncome)}`);
        
        // 3.1 ORDINARY INCOME TAX HESAPLA
        let ordinaryIncomeTax = 0;
        let remainingIncome = adjustedIncome;

        for (let i = 0; i < shortTermTaxBrackets.length - 1; i++) {
            const currentBracket = shortTermTaxBrackets[i];
            const nextBracket = shortTermTaxBrackets[i + 1];
            
            if (remainingIncome <= 0) break;
            
            const taxableInThisBracket = Math.min(
                remainingIncome,
                nextBracket.threshold - currentBracket.threshold
            );
            
            if (taxableInThisBracket > 0) {
                // Sent hassasiyetinde hesapla, yuvarlama yapma
                const taxForThisBracket = taxableInThisBracket * currentBracket.rate;
                ordinaryIncomeTax += taxForThisBracket;
                remainingIncome -= taxableInThisBracket;
            }
        }

        // En yüksek dilim için kalan geliri hesapla
        if (remainingIncome > 0) {
            const highestBracket = shortTermTaxBrackets[shortTermTaxBrackets.length - 1];
            // Sent hassasiyetinde hesapla, yuvarlama yapma
            const taxForHighestBracket = remainingIncome * highestBracket.rate;
            ordinaryIncomeTax += taxForHighestBracket;
        }

        // En son toplamı en yakın dolara yuvarla
        ordinaryIncomeTax = Math.round(ordinaryIncomeTax);

        console.log(`\nOrdinary Income Tax: ${formatCurrency(ordinaryIncomeTax)}`);
        
        // 4. KISA VADELİ VERGİYİ HESAPLA
        let shortTermTax = 0;
        if (shortTermGains > 0) {
            let remainingGains = shortTermGains;
            let currentIncome = adjustedIncome;

            for (let i = 0; i < shortTermTaxBrackets.length - 1; i++) {
                const currentBracket = shortTermTaxBrackets[i];
                const nextBracket = shortTermTaxBrackets[i + 1];
                
                if (currentIncome >= nextBracket.threshold) continue;
                
                const taxableInThisBracket = Math.min(
                    remainingGains,
                    nextBracket.threshold - Math.max(currentIncome, currentBracket.threshold)
                );
                
                if (taxableInThisBracket > 0) {
                    // Sent hassasiyetinde hesapla, yuvarlama yapma
                    const taxForThisBracket = taxableInThisBracket * currentBracket.rate;
                    shortTermTax += taxForThisBracket;
                    remainingGains -= taxableInThisBracket;
                    currentIncome += taxableInThisBracket;
                }
                
                if (remainingGains <= 0) break;
            }
            
            // En yüksek dilim için kalan kazançları hesapla
            if (remainingGains > 0) {
                const highestBracket = shortTermTaxBrackets[shortTermTaxBrackets.length - 1];
                // Sent hassasiyetinde hesapla, yuvarlama yapma
                const taxForHighestBracket = remainingGains * highestBracket.rate;
                shortTermTax += taxForHighestBracket;
            }
            
            // En son toplamı en yakın dolara yuvarla
            shortTermTax = Math.round(shortTermTax);
            
            console.log(`\nToplam kısa vadeli vergi: ${formatCurrency(shortTermTax)}`);
        }
        
        // 5. UZUN VADELİ VERGİYİ HESAPLA
        let longTermTax = 0;
        if (longTermGains > 0) {
            const totalIncomeForBracket = totalIncome + shortTermGains;
            let remainingGains = longTermGains;
            
            // 0% dilimi için hesaplama
            if (totalIncomeForBracket < longTermTaxBrackets[1].threshold) {
                const taxableAt0 = Math.min(
                    remainingGains,
                    longTermTaxBrackets[1].threshold - totalIncomeForBracket
                );
                if (taxableAt0 > 0) {
                    // Sent hassasiyetinde hesapla, yuvarlama yapma
                    const taxAt0 = taxableAt0 * longTermTaxBrackets[0].rate;
                    longTermTax += taxAt0;
                    remainingGains -= taxableAt0;
                }
            }

            // 15% dilimi için hesaplama
            if (remainingGains > 0 && totalIncomeForBracket < longTermTaxBrackets[2].threshold) {
                const taxableAt15 = Math.min(
                    remainingGains,
                    longTermTaxBrackets[2].threshold - Math.max(totalIncomeForBracket, longTermTaxBrackets[1].threshold)
                );
                if (taxableAt15 > 0) {
                    // Sent hassasiyetinde hesapla, yuvarlama yapma
                    const taxAt15 = taxableAt15 * longTermTaxBrackets[1].rate;
                    longTermTax += taxAt15;
                    remainingGains -= taxableAt15;
                }
            }

            // 20% dilimi için kalan miktar
            if (remainingGains > 0) {
                // Sent hassasiyetinde hesapla, yuvarlama yapma
                const taxAt20 = remainingGains * longTermTaxBrackets[2].rate;
                longTermTax += taxAt20;
            }
            
            // En son toplamı en yakın dolara yuvarla
            longTermTax = Math.round(longTermTax);
            
            console.log(`\nToplam uzun vadeli vergi: ${formatCurrency(longTermTax)}`);
        }
        
        // 6. NIIT (NET INVESTMENT INCOME TAX) HESAPLA
        let niitTax = 0;
        // Toplam yatırım geliri hesapla
        const totalInvestmentIncome = shortTermGains + longTermGains;
        
        // Yatırım geliri varsa ve $200,000'dan yüksek gelir varsa
        if (totalInvestmentIncome > 0 && totalIncome > 200000) {
            niitTax = Math.round(totalInvestmentIncome * 0.038); // %3.8
            console.log(`\nNIIT vergi (%3.8): ${formatCurrency(niitTax)}`);
        }
        
        // 7. TOPLAM VERGİ
        const totalTaxes = ordinaryIncomeTax + shortTermTax + longTermTax + niitTax;
        console.log(`\nTOPLAM VERGİ YÜKÜMLÜLÜĞÜ: ${formatCurrency(totalTaxes)}`);

        // Sonuçları güncelle
        setResults({
            shortTermGains,
            longTermGains,
            totalLosses,
            shortTermLossesApplied,
            longTermLossesApplied,
            lossesAppliedToIncome,
            remainingLossCarryforward,
            shortTermTax,
            longTermTax,
            niitTax,
            ordinaryIncomeTax,
            totalTaxes
        });
    };

    // Para birimi formatı
    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ABD Hisse Senedi Vergi Hesaplayıcı (2024)</h2>
            
            <div className="mb-4">
                <label htmlFor="totalIncome" className="block text-sm font-medium text-gray-700 mb-1">
                    Yatırım Gelirleri Dışında Toplam Vergilendirilebilir Gelir ($)
                </label>
                <input
                    type="number"
                    id="totalIncome"
                    className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Vergilendirilebilir gelirinizi girin"
                    value={totalIncome || ''}
                    onChange={(e) => setTotalIncome(parseFloat(e.target.value) || 0)}
                />
            </div>
            
            <div className="overflow-x-auto border border-gray-200 rounded-md mb-4">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sembol</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alış Fiyatı ($)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Satış Fiyatı ($)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hisse Adedi</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem Ücretleri ($)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Elde Tutma Süresi (ay)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kazanç/Kayıp</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {stocks.map((stock, index) => (
                            <tr key={stock.id}>
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <input
                                        type="text"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="AAPL"
                                        value={stock.symbol}
                                        onChange={(e) => handleStockChange(stock.id, 'symbol', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Fiyat girin"
                                        value={stock.purchasePrice || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'purchasePrice', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Fiyat girin"
                                        value={stock.sellingPrice || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'sellingPrice', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Adet girin"
                                        value={stock.sharesSold || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'sharesSold', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Ücret girin"
                                        value={stock.tradingFees || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'tradingFees', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Ay girin"
                                        value={stock.holdingPeriod || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'holdingPeriod', e.target.value)}
                                    />
                                </td>
                                <td className={`px-3 py-4 whitespace-nowrap text-sm font-medium ${stock.gainLoss !== undefined && stock.gainLoss < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {stock.gainLoss !== undefined ? formatCurrency(stock.gainLoss) : '$0.00'}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <button
                                        type="button"
                                        className="text-red-600 hover:text-red-900"
                                        onClick={() => removeStock(stock.id)}
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="flex space-x-4 mb-6">
                <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={addStock}
                >
                    + Hisse Senedi Ekle
                </button>
                <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={calculateTaxes}
                >
                    Vergiyi Hesapla
                </button>
            </div>
            
            {results && (
                <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Vergi Hesaplama Sonuçları</h3>
                    
                    {/* İlk satır - Kazançlar ve Kayıplar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Kısa Vadeli Kazançlar</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.shortTermGains)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Uzun Vadeli Kazançlar</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.longTermGains)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Toplam Kayıplar</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.totalLosses)}</p>
                        </div>
                    </div>
                    
                    {/* İkinci satır - Kayıplar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Kısa Vadeliden Düşülen</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.shortTermLossesApplied)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Uzun Vadeliden Düşülen</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.longTermLossesApplied)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Gelirden Düşülen ($3000 maks.)</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.lossesAppliedToIncome)}</p>
                        </div>
                    </div>
                    
                    {/* Üçüncü satır - Vergiler */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Ordinary Income Tax</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.ordinaryIncomeTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Kısa Vadeli Vergi</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.shortTermTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Uzun Vadeli Vergi</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.longTermTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">NIIT (%3.8)</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.niitTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Loss Carryover</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.remainingLossCarryforward)}</p>
                        </div>
                    </div>
                    
                    {/* Toplam vergi */}
                    <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-700">Toplam Vergi Yükümlülüğü</h4>
                        <p className="text-2xl font-bold text-blue-800">{formatCurrency(results.totalTaxes)}</p>
                    </div>
                </div>
            )}
        </div>
    );
} 
