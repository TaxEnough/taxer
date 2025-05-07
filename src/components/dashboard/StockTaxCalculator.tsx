'use client';

import { useState, useEffect } from 'react';

// Define Stock type
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

// Define Results type
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
    totalTaxes: number;
}

// Tax bracket type definitions
interface TaxBracket {
    rate: number;
    threshold: number;
}

interface StockTaxCalculatorProps {
    initialStocks?: Stock[];
}

export default function StockTaxCalculator({ initialStocks }: StockTaxCalculatorProps) {
    const [stocks, setStocks] = useState<Stock[]>(initialStocks && initialStocks.length > 0 ? initialStocks : [{ id: '1', symbol: '', purchasePrice: 0, sellingPrice: 0, sharesSold: 0, tradingFees: 0, holdingPeriod: 0 }]);
    const [totalIncome, setTotalIncome] = useState<number>(0);
    const [results, setResults] = useState<Results | null>(null);

    useEffect(() => {
        if (initialStocks && initialStocks.length > 0) {
            setStocks(initialStocks);
        }
    }, [initialStocks]);

    // Add stock
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

    // Remove stock
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

    // When stock value changes
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

    // 2024 short-term tax brackets (single filer)
    const shortTermTaxBrackets: TaxBracket[] = [
        { rate: 0.10, threshold: 0 },
        { rate: 0.12, threshold: 11601 },
        { rate: 0.22, threshold: 47151 },
        { rate: 0.24, threshold: 100526 },
        { rate: 0.32, threshold: 191951 },
        { rate: 0.35, threshold: 243726 },
        { rate: 0.37, threshold: 609351 }
    ];

    // 2024 long-term capital gains tax brackets (single filer)
    const longTermTaxBrackets: TaxBracket[] = [
        { rate: 0.00, threshold: 0 },
        { rate: 0.15, threshold: 47025 },
        { rate: 0.20, threshold: 518900 }
    ];

    // Complete tax calculation algorithm according to tax.md
    const calculateTaxes = () => {
        console.log("=== TAX CALCULATION STARTING (2024) ===");
        
        // Validate income input
        if (totalIncome <= 0) {
            alert('Please enter a valid total taxable income');
            return;
        }

        // 1. CALCULATE GAINS AND LOSSES
        let shortTermGains = 0;
        let longTermGains = 0;
        let totalLosses = 0;

        // Calculate gain/loss for each stock transaction
        stocks.forEach(stock => {
            // Skip stocks with insufficient data
            if (!stock.symbol || stock.sharesSold <= 0) return;

            // Calculate gain/loss: (Selling price - Purchase price) × Number of shares - Trading fees
            const gainLoss = (stock.sellingPrice - stock.purchasePrice) * stock.sharesSold - stock.tradingFees;
            const isShortTerm = stock.holdingPeriod < 12;
            
            console.log(`Stock ${stock.symbol}:`);
            console.log(`  Purchase: $${stock.purchasePrice}, Sale: $${stock.sellingPrice}, Shares: ${stock.sharesSold}, Fees: $${stock.tradingFees}`);
            console.log(`  Holding Period: ${stock.holdingPeriod} months, Gain/Loss: ${formatCurrency(gainLoss)}`);

            if (gainLoss > 0) {
                // Less than 12 months is short-term, 12 months or more is long-term
                if (isShortTerm) {
                    shortTermGains += gainLoss;
                    console.log(`  Short-term gain: ${formatCurrency(gainLoss)}`);
                } else {
                    longTermGains += gainLoss;
                    console.log(`  Long-term gain: ${formatCurrency(gainLoss)}`);
                }
            } else if (gainLoss < 0) {
                // Use absolute value for losses
                totalLosses += Math.abs(gainLoss);
                console.log(`  Loss: ${formatCurrency(Math.abs(gainLoss))}`);
            }
        });

        console.log(`\nTotal short-term gain: ${formatCurrency(shortTermGains)}`);
        console.log(`Total long-term gain: ${formatCurrency(longTermGains)}`);
        console.log(`Total losses: ${formatCurrency(totalLosses)}`);

        // 2. BALANCE LOSSES (according to tax.md rules)
        let remainingLosses = totalLosses;
        let shortTermLossesApplied = 0;
        let longTermLossesApplied = 0;
        let lossesAppliedToIncome = 0;

        // a) First, deduct losses from short-term gains
        if (remainingLosses > 0 && shortTermGains > 0) {
            shortTermLossesApplied = Math.min(remainingLosses, shortTermGains);
            shortTermGains -= shortTermLossesApplied;
            remainingLosses -= shortTermLossesApplied;
            console.log(`\nLoss deducted from short-term gains: ${formatCurrency(shortTermLossesApplied)}`);
            console.log(`Remaining short-term gains: ${formatCurrency(shortTermGains)}`);
        }

        // b) Then, deduct losses from long-term gains
        if (remainingLosses > 0 && longTermGains > 0) {
            longTermLossesApplied = Math.min(remainingLosses, longTermGains);
            longTermGains -= longTermLossesApplied;
            remainingLosses -= longTermLossesApplied;
            console.log(`\nLoss deducted from long-term gains: ${formatCurrency(longTermLossesApplied)}`);
            console.log(`Remaining long-term gains: ${formatCurrency(longTermGains)}`);
        }

        // c) Deduct up to $3000 of remaining losses from income (according to tax.md)
        if (remainingLosses > 0) {
            lossesAppliedToIncome = Math.min(remainingLosses, 3000);
            remainingLosses -= lossesAppliedToIncome;
            console.log(`\nLoss deducted from income (max $3000): ${formatCurrency(lossesAppliedToIncome)}`);
        }
        
        // d) Losses to carry forward to next year
        const remainingLossCarryforward = remainingLosses;
        if (remainingLossCarryforward > 0) {
            console.log(`\nLoss carried forward to next year: ${formatCurrency(remainingLossCarryforward)}`);
        }

        // 3. CALCULATE TOTAL INCOME (Normal Income + Investment Income)
        const totalAdjustedIncome = totalIncome + shortTermGains + longTermGains;
        const adjustedIncome = Math.max(0, totalIncome - lossesAppliedToIncome);
        
        console.log(`\nNormal income: ${formatCurrency(totalIncome)}`);
        console.log(`Total income (normal + investment): ${formatCurrency(totalAdjustedIncome)}`);
        console.log(`Adjusted income (after loss deduction): ${formatCurrency(adjustedIncome)}`);
        
        // 4. CALCULATE SHORT-TERM TAX - Based on 2024 tax brackets
        let shortTermTax = 0;
        if (shortTermGains > 0) {
            // Progressive tax calculation
            let remainingGains = shortTermGains;
            let currentIncome = adjustedIncome; // Start with normal income

            // Calculate for each tax bracket
            for (let i = 0; i < shortTermTaxBrackets.length - 1; i++) {
                const currentBracket = shortTermTaxBrackets[i];
                const nextBracket = shortTermTaxBrackets[i + 1];
                
                // If income is above this bracket, move to the next bracket
                if (currentIncome >= nextBracket.threshold) continue;
                
                // Calculate the amount taxable in this bracket
                const taxableInThisBracket = Math.min(
                    remainingGains,
                    nextBracket.threshold - Math.max(currentIncome, currentBracket.threshold)
                );
                
                if (taxableInThisBracket > 0) {
                    // Calculate tax for each bracket and round to nearest dollar
                    const taxForThisBracket = Math.round(taxableInThisBracket * currentBracket.rate);
                    shortTermTax += taxForThisBracket;
                    remainingGains -= taxableInThisBracket;
                    currentIncome += taxableInThisBracket;
                    console.log(`  Bracket ${currentBracket.rate * 100}%: ${formatCurrency(taxableInThisBracket)} × ${currentBracket.rate} = ${formatCurrency(taxForThisBracket)}`);
                }
                
                if (remainingGains <= 0) break;
            }
            
            // Calculate for the highest bracket with remaining gains
            if (remainingGains > 0) {
                const highestBracket = shortTermTaxBrackets[shortTermTaxBrackets.length - 1];
                const taxForHighestBracket = Math.round(remainingGains * highestBracket.rate);
                shortTermTax += taxForHighestBracket;
                console.log(`  Bracket ${highestBracket.rate * 100}%: ${formatCurrency(remainingGains)} × ${highestBracket.rate} = ${formatCurrency(taxForHighestBracket)}`);
            }
            
            console.log(`\nTotal short-term tax: ${formatCurrency(shortTermTax)}`);
        }
        
        // 5. CALCULATE LONG-TERM TAX - Apply rate based on income level
        let longTermTax = 0;
        if (longTermGains > 0) {
            // Calculate tax based on total income
            const totalIncomeForBracket = totalIncome + shortTermGains;
            let remainingGains = longTermGains;
            
            console.log(`\nCalculating long-term tax:`);
            console.log(`Total income base: ${formatCurrency(totalIncomeForBracket)}`);
            console.log(`Total long-term gain: ${formatCurrency(longTermGains)}`);

            // Calculate for 0% bracket
            if (totalIncomeForBracket < longTermTaxBrackets[1].threshold) {
                const taxableAt0 = Math.min(
                    remainingGains,
                    longTermTaxBrackets[1].threshold - totalIncomeForBracket
                );
                if (taxableAt0 > 0) {
                    console.log(`  0% bracket: ${formatCurrency(taxableAt0)} × 0.00 = $0.00`);
                    remainingGains -= taxableAt0;
                }
            }

            // Calculate for 15% bracket
            if (remainingGains > 0 && totalIncomeForBracket < longTermTaxBrackets[2].threshold) {
                const taxableAt15 = Math.min(
                    remainingGains,
                    longTermTaxBrackets[2].threshold - Math.max(totalIncomeForBracket, longTermTaxBrackets[1].threshold)
                );
                if (taxableAt15 > 0) {
                    const taxAt15 = Math.round(taxableAt15 * longTermTaxBrackets[1].rate);
                    longTermTax += taxAt15;
                    console.log(`  15% bracket: ${formatCurrency(taxableAt15)} × 0.15 = ${formatCurrency(taxAt15)}`);
                    remainingGains -= taxableAt15;
                }
            }

            // Calculate for 20% bracket with remaining amount
            if (remainingGains > 0) {
                const taxAt20 = Math.round(remainingGains * longTermTaxBrackets[2].rate);
                longTermTax += taxAt20;
                console.log(`  20% bracket: ${formatCurrency(remainingGains)} × 0.20 = ${formatCurrency(taxAt20)}`);
            }
            
            console.log(`\nTotal long-term tax: ${formatCurrency(longTermTax)}`);
        }
        
        // 6. CALCULATE NIIT (NET INVESTMENT INCOME TAX)
        let niitTax = 0;
        // Calculate total investment income
        const totalInvestmentIncome = shortTermGains + longTermGains;
        
        // If there's investment income and income is over $200,000
        if (totalInvestmentIncome > 0 && totalIncome > 200000) {
            niitTax = Math.round(totalInvestmentIncome * 0.038); // 3.8%
            console.log(`\nNIIT tax (3.8%): ${formatCurrency(niitTax)}`);
        }
        
        // 7. TOTAL TAX
        const totalTaxes = shortTermTax + longTermTax + niitTax;
        console.log(`\nTOTAL TAX LIABILITY: ${formatCurrency(totalTaxes)}`);

        // Update results
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
            totalTaxes
        });
    };

    // Currency format
    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    return (
        <div className="bg-white shadow-sm rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">US Stock Tax Calculator (2024)</h2>
            
            <div className="mb-4">
                <label htmlFor="totalIncome" className="block text-sm font-medium text-gray-700 mb-1">
                    Total Taxable Income Excluding Investment Income ($)
                </label>
                <input
                    type="number"
                    id="totalIncome"
                    className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter your taxable income"
                    value={totalIncome || ''}
                    onChange={(e) => setTotalIncome(parseFloat(e.target.value) || 0)}
                />
            </div>
            
            <div className="overflow-x-auto border border-gray-200 rounded-md mb-4">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price ($)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Selling Price ($)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares Sold</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trading Fees ($)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holding Period (months)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gain/Loss</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
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
                                        placeholder="Enter price"
                                        value={stock.purchasePrice || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'purchasePrice', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Enter price"
                                        value={stock.sellingPrice || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'sellingPrice', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Enter shares"
                                        value={stock.sharesSold || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'sharesSold', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Enter fees"
                                        value={stock.tradingFees || ''}
                                        onChange={(e) => handleStockChange(stock.id, 'tradingFees', e.target.value)}
                                    />
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                        placeholder="Enter months"
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
                    + Add Stock
                </button>
                <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    onClick={calculateTaxes}
                >
                    Calculate Tax
                </button>
            </div>
            
            {results && (
                <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Tax Calculation Results</h3>
                    
                    {/* First row - Gains and Losses */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Short-Term Gains</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.shortTermGains)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Long-Term Gains</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.longTermGains)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Total Losses</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.totalLosses)}</p>
                        </div>
                    </div>
                    
                    {/* Second row - Losses */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Deducted from Short-Term</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.shortTermLossesApplied)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Deducted from Long-Term</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.longTermLossesApplied)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Deducted from Income ($3000 max.)</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.lossesAppliedToIncome)}</p>
                        </div>
                    </div>
                    
                    {/* Third row - Taxes */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Short-Term Tax</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.shortTermTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Long-Term Tax</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.longTermTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">NIIT (3.8%)</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.niitTax)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-md shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Loss Carried Forward</h4>
                            <p className="text-lg font-semibold text-gray-900">{formatCurrency(results.remainingLossCarryforward)}</p>
                        </div>
                    </div>
                    
                    {/* Total tax */}
                    <div className="bg-blue-50 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-700">Total Tax Liability</h4>
                        <p className="text-2xl font-bold text-blue-800">{formatCurrency(results.totalTaxes)}</p>
                    </div>
                </div>
            )}
        </div>
    );
} 