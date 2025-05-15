'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getAuthTokenFromClient } from '@/lib/auth-client';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement 
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function Reports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'forms' | 'analytics'>('overview');
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState<boolean>(true);
  
  // Example tax summary data - normally retrieved from API
  const [taxSummary, setTaxSummary] = useState({
    shortTermGains: 2500,
    shortTermTax: 625,
    longTermGains: 5000,
    longTermTax: 500,
    totalGains: 7500,
    totalTax: 1125,
    taxRate: 15,
    monthlyData: [
      { month: 'January', gains: 320, taxes: 80 },
      { month: 'February', gains: 450, taxes: 110 },
      { month: 'March', gains: 280, taxes: 70 },
      { month: 'April', gains: 580, taxes: 145 },
      { month: 'May', gains: 620, taxes: 155 },
      { month: 'June', gains: 750, taxes: 190 },
      { month: 'July', gains: 800, taxes: 200 },
      { month: 'August', gains: 860, taxes: 215 },
      { month: 'September', gains: 920, taxes: 230 },
      { month: 'October', gains: 950, taxes: 240 },
      { month: 'November', gains: 980, taxes: 245 },
      { month: 'December', gains: 1000, taxes: 250 }
    ]
  });

  // For error handling
  const [error, setError] = useState<string | null>(null);

  // Load user data
  useEffect(() => {
    const fetchTaxData = async () => {
      try {
        setLoading(true);
        
        // Get token
        const token = getAuthTokenFromClient();
        
        if (!token) {
          setError('Session may have expired. Please login again.');
          setLoading(false);
          return;
        }
        
        // Fetch tax data from API
        const response = await fetch(`/api/taxes/summary?year=${yearFilter}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load tax data');
        }
        
        const data = await response.json();
        
        // Load API data into state
        setTaxSummary(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching tax data:', err);
        setError('Failed to load tax data. Please try again later.');
        setLoading(false);
      }
    };

    if (user) {
      fetchTaxData();
    }
  }, [user, yearFilter]);

  // PDF generation function
  const generatePDF = (formType: 'schedule1040' | 'scheduleD' | 'form8949' | 'form1099' | 'form1098') => {
    try {
      const doc = new jsPDF();
      
      // Document title
      let title = '';
      
      switch(formType) {
        case 'schedule1040':
          title = 'Form 1040';
          // Form 1040 tax summary information
          doc.setFontSize(20);
          doc.text('Form 1040 - U.S. Individual Income Tax Return', 10, 20);
          doc.setFontSize(12);
          doc.text(`Tax Year: ${yearFilter}`, 10, 30);
          doc.text('Capital Gains and Losses Summary', 10, 40);
          
          // Create table
          (doc as any).autoTable({
            startY: 50,
            head: [['Description', 'Amount']],
            body: [
              ['Short-term capital gains', `$${taxSummary.shortTermGains.toFixed(2)}`],
              ['Short-term capital tax', `$${taxSummary.shortTermTax.toFixed(2)}`],
              ['Long-term capital gains', `$${taxSummary.longTermGains.toFixed(2)}`],
              ['Long-term capital tax', `$${taxSummary.longTermTax.toFixed(2)}`],
              ['Total capital gains', `$${taxSummary.totalGains.toFixed(2)}`],
              ['Total tax', `$${taxSummary.totalTax.toFixed(2)}`],
              ['Effective tax rate', `${taxSummary.taxRate.toFixed(2)}%`]
            ]
          });
          break;
          
        case 'scheduleD':
          title = 'Schedule D';
          // Schedule D capital gains information
          doc.setFontSize(20);
          doc.text('Schedule D - Capital Gains and Losses', 10, 20);
          doc.setFontSize(12);
          doc.text(`Tax Year: ${yearFilter}`, 10, 30);
          
          // Create table - Short Term
          doc.text('Part I - Short-Term Capital Gains and Losses', 10, 40);
          (doc as any).autoTable({
            startY: 50,
            head: [['Description', 'Amount']],
            body: [
              ['Short-term capital gains', `$${taxSummary.shortTermGains.toFixed(2)}`],
              ['Short-term capital tax', `$${taxSummary.shortTermTax.toFixed(2)}`]
            ]
          });
          
          // Create table - Long Term
          doc.text('Part II - Long-Term Capital Gains and Losses', 10, 80);
          (doc as any).autoTable({
            startY: 90,
            head: [['Description', 'Amount']],
            body: [
              ['Long-term capital gains', `$${taxSummary.longTermGains.toFixed(2)}`],
              ['Long-term capital tax', `$${taxSummary.longTermTax.toFixed(2)}`]
            ]
          });
          
          // Create table - Summary
          doc.text('Part III - Summary', 10, 120);
          (doc as any).autoTable({
            startY: 130,
            head: [['Description', 'Amount']],
            body: [
              ['Total capital gains', `$${taxSummary.totalGains.toFixed(2)}`],
              ['Total tax', `$${taxSummary.totalTax.toFixed(2)}`],
              ['Effective tax rate', `${taxSummary.taxRate.toFixed(2)}%`]
            ]
          });
          break;
          
        case 'form8949':
          title = 'Form 8949';
          // Form 8949 asset sales information
          doc.setFontSize(20);
          doc.text('Form 8949 - Sales and Other Dispositions of Capital Assets', 10, 20);
          doc.setFontSize(12);
          doc.text(`Tax Year: ${yearFilter}`, 10, 30);
          doc.text('This is a summary report. Detailed transaction data is required on actual form.', 10, 40);
          
          // Monthly summary table
          doc.text('Monthly Capital Gains Summary', 10, 50);
          const monthlyData = taxSummary.monthlyData.map(item => [
            item.month,
            `$${item.gains.toFixed(2)}`,
            `$${item.taxes.toFixed(2)}`
          ]);
          
          (doc as any).autoTable({
            startY: 60,
            head: [['Month', 'Gains', 'Taxes']],
            body: monthlyData
          });
          break;
          
        case 'form1099':
          title = 'Form 1099';
          // Form 1099 information
          doc.setFontSize(20);
          doc.text('Form 1099 - Miscellaneous Income', 10, 20);
          doc.setFontSize(12);
          doc.text(`Tax Year: ${yearFilter}`, 10, 30);
          doc.text('Summary of income received from various sources', 10, 40);
          
          // Create table
          (doc as any).autoTable({
            startY: 50,
            head: [['Income Source', 'Amount']],
            body: [
              ['Dividend income', '$785.25'],
              ['Interest income', '$342.15'],
              ['Crypto-asset income', '$1,250.00'],
              ['Marketplace income', '$3,475.50'],
              ['Other income', '$520.30'],
              ['Total miscellaneous income', '$6,373.20']
            ]
          });
          break;
          
        case 'form1098':
          title = 'Form 1098';
          // Form 1098 information
          doc.setFontSize(20);
          doc.text('Form 1098 - Mortgage Interest Statement', 10, 20);
          doc.setFontSize(12);
          doc.text(`Tax Year: ${yearFilter}`, 10, 30);
          doc.text('Mortgage interest and related expenses paid', 10, 40);
          
          // Create table
          (doc as any).autoTable({
            startY: 50,
            head: [['Description', 'Amount']],
            body: [
              ['Mortgage interest paid', '$12,458.75'],
              ['Points paid on purchase', '$2,500.00'],
              ['Mortgage insurance premiums', '$1,845.25'],
              ['Property taxes paid', '$4,325.50'],
              ['Total deductible expenses', '$21,129.50']
            ]
          });
          break;
      }
      
      // Download PDF
      doc.save(`${title}-${yearFilter}.pdf`);
    } catch (error) {
      console.error('Error creating PDF:', error);
      setError('Failed to create PDF. Please try again later.');
    }
  };

  // Bar chart data
  const barChartData = {
    labels: taxSummary.monthlyData.map(item => item.month),
    datasets: [
      {
        label: 'Gains',
        data: taxSummary.monthlyData.map(item => item.gains),
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Tax',
        data: taxSummary.monthlyData.map(item => item.taxes),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      }
    ],
  };

  // Pie chart data
  const pieChartData = {
    labels: ['Short-Term Tax', 'Long-Term Tax'],
    datasets: [
      {
        label: 'Tax Distribution',
        data: [taxSummary.shortTermTax, taxSummary.longTermTax],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(53, 162, 235, 0.5)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(53, 162, 235, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tax Reports & Analytics</h1>
          <p className="mt-2 text-gray-600">View tax summaries, generate forms, and analyze your investment performance.</p>
        </div>
        
        <div className="min-h-screen bg-gray-100">
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
              
              {/* Year filter */}
              <div className="flex items-center space-x-2">
                <label htmlFor="yearFilter" className="text-sm font-medium text-gray-700">Year:</label>
                <select
                  id="yearFilter"
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="block w-28 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                  <option value="2023">2023</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Tax Summary
                </button>
                <button
                  onClick={() => setActiveTab('forms')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'forms'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Tax Forms
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'analytics'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Analytics and Charts
                </button>
              </nav>
            </div>
          </header>
          
          <main>
            <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
                </div>
              ) : error ? (
                <div className="bg-red-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error</h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {activeTab === 'overview' && (
                    <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Tax Summary - {yearFilter}
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500">
                          Annual capital gains tax summary
                        </p>
                      </div>
                      <div className="border-t border-gray-200">
                        <dl>
                          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Short-Term Gains
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              ${taxSummary.shortTermGains.toFixed(2)}
                            </dd>
                          </div>
                          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Short-Term Tax
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              ${taxSummary.shortTermTax.toFixed(2)}
                            </dd>
                          </div>
                          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Long-Term Gains
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              ${taxSummary.longTermGains.toFixed(2)}
                            </dd>
                          </div>
                          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Long-Term Tax
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              ${taxSummary.longTermTax.toFixed(2)}
                            </dd>
                          </div>
                          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Total Gains
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              ${taxSummary.totalGains.toFixed(2)}
                            </dd>
                          </div>
                          <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Total Tax
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-bold">
                              ${taxSummary.totalTax.toFixed(2)}
                            </dd>
                          </div>
                          <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">
                              Effective Tax Rate
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              %{taxSummary.taxRate.toFixed(2)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  )}

                  {activeTab === 'forms' && (
                    <div className="bg-white shadow sm:rounded-lg">
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Tax Forms - {yearFilter}
                        </h3>
                        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
                          <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                            <div className="px-4 py-5 sm:px-6">
                              <h3 className="text-lg leading-6 font-medium text-gray-900">Form 1040</h3>
                              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                                Individual Tax Return
                              </p>
                            </div>
                            <div className="px-4 py-4 sm:px-6">
                              <p className="text-sm text-gray-500 mb-3">
                                Form 1040 is the federal income tax return.
                              </p>
                              <a
                                href="https://www.irs.gov/pub/irs-pdf/f1040.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                IRS Form 1040
                              </a>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                            <div className="px-4 py-5 sm:px-6">
                              <h3 className="text-lg leading-6 font-medium text-gray-900">Schedule D</h3>
                              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                                Capital Gains and Losses
                              </p>
                            </div>
                            <div className="px-4 py-4 sm:px-6">
                              <p className="text-sm text-gray-500 mb-3">
                                Schedule D reports gains and losses from the sale of capital assets.
                              </p>
                              <a
                                href="https://www.irs.gov/forms-pubs/about-schedule-d-form-1040"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                IRS Schedule D
                              </a>
                            </div>
                          </div>

                          <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
                            <div className="px-4 py-5 sm:px-6">
                              <h3 className="text-lg leading-6 font-medium text-gray-900">Form 8949</h3>
                              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                                Sales of Capital Assets
                              </p>
                            </div>
                            <div className="px-4 py-4 sm:px-6">
                              <p className="text-sm text-gray-500 mb-3">
                                Form 8949 details sales or exchanges of capital assets.
                              </p>
                              <a
                                href="https://www.irs.gov/pub/irs-pdf/f8949.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                              >
                                IRS Form 8949
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeTab === 'analytics' && (
                    <div className="space-y-6">
                      <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                            Monthly Gains and Tax Analysis - {yearFilter}
                          </h3>
                          <div className="h-80">
                            <Bar 
                              data={barChartData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'top' as const,
                                  },
                                  title: {
                                    display: true,
                                    text: 'Monthly Gains and Tax Distribution',
                                  },
                                },
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                            Tax Distribution - {yearFilter}
                          </h3>
                          <div className="h-80 flex justify-center">
                            <div style={{ width: '50%', height: '100%' }}>
                              <Pie 
                                data={pieChartData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  plugins: {
                                    legend: {
                                      position: 'top' as const,
                                    },
                                    title: {
                                      display: true,
                                      text: 'Short vs Long Term Tax Distribution',
                                    },
                                  },
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white shadow sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                            Tax Optimization Suggestions
                          </h3>
                          <div className="bg-green-50 p-4 rounded-md mb-4">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <h3 className="text-sm font-medium text-green-800">Tax Harvesting Suggestion</h3>
                                <div className="mt-2 text-sm text-green-700">
                                  <p>You can sell your ABC stock for a $320 loss to offset some of your tax liability this year.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="bg-blue-50 p-4 rounded-md">
                            <div className="flex">
                              <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">Long-Term Gain Strategy</h3>
                                <div className="mt-2 text-sm text-blue-700">
                                  <p>If you hold your XYZ stock for 2 more months, it will qualify for long-term capital gains status and have a lower tax rate.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  );
} 