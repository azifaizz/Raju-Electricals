import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, Download, Users, Check, X, Pencil
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, startOfYear, endOfMonth, endOfYear, addDays } from 'date-fns';
import { billingApi, productApi, daybookApi, Bill, Product, Vendor, DayBookEntry } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import LowStockProductsModal from './LowStockProductsModal';

type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

const DashboardOverview = () => {
  const { toast } = useToast();
  const { bills, products = [], vendors = [], refreshProducts } = useGlobalData() as any;
    const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dashboardView, setDashboardView] = useState<DashboardPeriod>('month');
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  // Raw data
  const [expenses, setExpenses] = useState<DayBookEntry[]>([]);
    const [chartDataFetched, setChartDataFetched] = useState<any[]>([]);
  
  // UI state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ purchaseRate: number, sellingPrice: number }>({ purchaseRate: 0, sellingPrice: 0 });
  const [selectedProductDetails, setSelectedProductDetails] = useState<any | null>(null);
  const [priceMarginSearch, setPriceMarginSearch] = useState("");

  const getDateRange = (view: DashboardPeriod) => {
    const now = new Date();
    if (view === 'day') {
      // Day view implies current week days (Mon-Sat)
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    if (view === 'week') {
      // Week view implies weeks of current month (1st Week to 5th Week)
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (view === 'month') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    return { start: startOfYear(now), end: endOfYear(now) };
  };

  const handleEditClick = (product: Product) => {
    setEditingProductId(product.id || null);
    setEditValues({
      purchaseRate: product.purchaseRate || 0,
      sellingPrice: product.sellingPrice || 0
    });
  };

  const handleSaveEdit = async (productId: string) => {
    if (editValues.purchaseRate <= 0) {
      toast({ title: 'Invalid Input', description: 'Buying price must be greater than 0', variant: 'destructive' });
      return;
    }
    if (editValues.sellingPrice < editValues.purchaseRate) {
      toast({ title: 'Invalid Input', description: 'Selling price must be greater than or equal to buying price', variant: 'destructive' });
      return;
    }

    try {
      await productApi.update(productId, {
        purchaseRate: editValues.purchaseRate,
        sellingPrice: editValues.sellingPrice
      });

      // Refresh products from context
      await refreshProducts();

      setEditingProductId(null);
      toast({ title: 'Success', description: 'Pricing updated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update pricing', variant: 'destructive' });
    }
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
  };


  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const daybookRes = await daybookApi.getSummary(format(new Date(), 'yyyy-MM-dd'));
        if (daybookRes.data && daybookRes.data.entries) {
          setExpenses(daybookRes.data.entries.filter((e: any) => e.type === 'EXPENSE'));
        }
        
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Filter bills based on time range (Global for charts)
  const dateFilteredBills = useMemo(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    return bills.filter(bill => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return false;
      const billDate = new Date(bill.createdAt || new Date());
      return billDate >= start && billDate <= end;
    });
  }, [bills, startDate, endDate]);

const filteredBills = dateFilteredBills;

const filteredProducts = products;

  // Helper to aggregate chart data
  const aggregateChartData = (view: DashboardPeriod, rawData: any[], start: Date) => {
    if (view === 'year') {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyAgg: Record<string, { income: number; expense: number }> = {};
      months.forEach(m => monthlyAgg[m] = { income: 0, expense: 0 });

      rawData.forEach((d: any) => {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime())) {
          const mName = months[dDate.getMonth()];
          if (monthlyAgg[mName]) {
            monthlyAgg[mName].income += (d.income || 0);
            monthlyAgg[mName].expense += (d.expense || 0);
          }
        }
      });
      return months.map(m => ({ date: m, income: monthlyAgg[m].income, expense: monthlyAgg[m].expense }));
    } else if (view === 'month') {
      const fullMonthData = [];
      const dataMap = new Map();
      rawData.forEach((d: any) => {
        const dayNum = new Date(d.date).getDate();
        dataMap.set(dayNum, d);
      });
      for (let i = 1; i <= 31; i++) {
        const dayData = dataMap.get(i);
        fullMonthData.push({ date: i.toString(), income: dayData?.income || 0, expense: dayData?.expense || 0 });
      }
      return fullMonthData;
    } else if (view === 'week') {
      const weeksData = [
        { date: '1st Week', income: 0, expense: 0 },
        { date: '2nd Week', income: 0, expense: 0 },
        { date: '3rd Week', income: 0, expense: 0 },
        { date: '4th Week', income: 0, expense: 0 },
        { date: '5th Week', income: 0, expense: 0 }
      ];
      rawData.forEach((d: any) => {
        const dayNum = new Date(d.date).getDate();
        let weekIdx = Math.floor((dayNum - 1) / 7);
        if (weekIdx > 4) weekIdx = 4;
        weeksData[weekIdx].income += (d.income || 0);
        weeksData[weekIdx].expense += (d.expense || 0);
      });
      return weeksData;
    } else { // day
      const fullWeekData = [];
      const dataMap = new Map();
      rawData.forEach((d: any) => {
        const dayStr = format(new Date(d.date), 'EEE');
        dataMap.set(dayStr, d);
      });
      for (let i = 0; i < 6; i++) {
        const currentDay = addDays(start, i);
        const dayStr = format(currentDay, 'EEE');
        const fullDayName = format(currentDay, 'EEEE');
        const dayData = dataMap.get(dayStr);
        fullWeekData.push({ date: fullDayName, income: dayData?.income || 0, expense: dayData?.expense || 0 });
      }
      return fullWeekData;
    }
  };

  const [allPeriodsData, setAllPeriodsData] = useState<Record<DashboardPeriod, any[]>>({
    day: [], week: [], month: [], year: []
  });

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const res = await daybookApi.getRange(startDate, endDate);
        const rawData = res.data?.chartData || res.data?.dailyBreakdown || [];

        const start = startOfDay(new Date(startDate));

        const dayData = aggregateChartData('day', rawData, start);
        const weekData = aggregateChartData('week', rawData, start);
        const monthData = aggregateChartData('month', rawData, start);
        const yearData = aggregateChartData('year', rawData, start);

        setAllPeriodsData({ day: dayData, week: weekData, month: monthData, year: yearData });

        // Update the main chart view
        if (dashboardView === 'day') setChartDataFetched(dayData);
        else if (dashboardView === 'week') setChartDataFetched(weekData);
        else if (dashboardView === 'month') setChartDataFetched(monthData);
        else if (dashboardView === 'year') setChartDataFetched(yearData);

      } catch (err) {
        console.log("Chart data fetch issue: ", err);
      }
    };
    fetchChartData();
  }, [dashboardView, startDate, endDate]);



  // KPIs
  const { totalRevenue, totalTransactions, totalProfit, totalCOGS } = useMemo(() => {
    let rev = 0;
    let profit = 0;
    let cogs = 0;

    // Create a product map for quick lookup using ALL products
    const combinedProducts = products;
    const productMap = new Map(combinedProducts.map(p => [p.name, p]));
    const productIdMap = new Map(combinedProducts.map(p => [p.id, p]));

    filteredBills.forEach(bill => {
      const finalAmt = bill.finalAmount || bill.amountPaid || 0;
      rev += finalAmt;

      // Estimate profit and COGS
      let billCost = 0;
      bill.items?.forEach(item => {
        const prod = productIdMap.get(item.productId) || productMap.get(item.productName);
        if (prod) {
          billCost += (prod.purchaseRate || 0) * item.quantity;
        } else {
          // rough estimate if product not found (30% margin)
          billCost += item.unitPrice * item.quantity * 0.7;
        }
      });
      cogs += billCost;
      profit += (finalAmt - billCost);
    });

    return {
      totalRevenue: rev,
      totalTransactions: filteredBills.length,
      totalProfit: profit,
      totalCOGS: cogs
    };
  }, [filteredBills, filteredProducts]);

  // Transaction Stats for Dropdown
  const txStats = useMemo(() => {
    let upi = 0, cash = 0, card = 0, split = 0, partial = 0;
    filteredBills.forEach(b => {
      const method = (b.paymentMethod || 'Cash').toLowerCase();
      if (method.includes('upi') || method.includes('online')) upi++;
      else if (method.includes('split') || method.includes('mixed')) split++;
      else if (method.includes('card')) card++;
      else if (method.includes('partial')) partial++;
      else cash++;
    });
    return { upi, cash, card, split, partial };
  }, [filteredBills]);

  // Product Analysis (Best Sellers & Pricing Insights)
  const productPerformance = useMemo(() => {
    const perf: Record<string, {
      id: string,
      name: string,
      qtySold: number,
      revenue: number,
      category: string,
      margin: number,
      purchaseRate: number,
      sellingPrice: number,
      vendorName: string,
      vendorId: string,
      weaverName: string,
      weaverId: string,
      stock: number,
      purchaseDate?: string,
      hashtagNumber?: string
    }> = {};

    const combinedProducts = products;
    const productMap = new Map<string, any>(combinedProducts.map(p => [p.id, p] as [string, any]));
    const productNameMap = new Map<string, any>(combinedProducts.map(p => [p.name, p] as [string, any]));
    const productBarcodeMap = new Map<string, any>(
      combinedProducts
        .filter(p => p.barcode)
        .map(p => [p.barcode, p] as [string, any])
    );

    filteredBills.forEach(bill => {
      bill.items?.forEach(item => {
        const prod = productMap.get(item.productId) || productNameMap.get(item.productName) || productBarcodeMap.get(item.productId);
        const pid = prod ? prod.id : item.productName;

        if (!perf[pid]) {
          const pr = prod?.purchaseRate || (item.unitPrice * 0.7);
          const sp = prod?.sellingPrice || item.unitPrice;
          perf[pid] = {
            id: prod?.id || 'N/A',
            name: item.productName,
            qtySold: 0,
            revenue: 0,
            category: prod?.category || 'General',
            purchaseRate: pr,
            sellingPrice: sp,
            margin: sp > 0 ? ((sp - pr) / sp) * 100 : 0,
            vendorName: prod?.vendorName || 'N/A',
            vendorId: prod?.vendorId || 'N/A',
            weaverName: (prod as any)?.weaverName || (prod as any)?.vendorName || 'N/A',
            weaverId: (prod as any)?.weaverId || (prod as any)?.vendorId || 'N/A',
            stock: prod?.stockQuantity || 0,
            purchaseDate: prod?.purchaseDate || prod?.createdAt || '',
            hashtagNumber: prod?.hashtagNumber || prod?.id || ''
          };
        }
        perf[pid].qtySold += item.quantity;
        perf[pid].revenue += (item.unitPrice * item.quantity);
      });
    });

    return Object.values(perf).sort((a, b) => b.qtySold - a.qtySold);
  }, [filteredBills, products]);

  const topSellingProducts = useMemo(() => {
    return productPerformance.map(p => ({
      ...p,
      totalQty: (p.qtySold || 0) + (p.stock || 0),
      chartLabel: `${p.name} (${p.weaverName && p.weaverName !== 'N/A' ? p.weaverName : p.vendorName})`
    })).sort((a, b) => b.qtySold - a.qtySold);
  }, [productPerformance]);

  const topPerformingByRevenue = useMemo(() => {
    return [...topSellingProducts].sort((a, b) => b.revenue - a.revenue);
  }, [topSellingProducts]);

  const topPerformingByMargin = useMemo(() => {
    return [...topSellingProducts].sort((a, b) => b.margin - a.margin);
  }, [topSellingProducts]);

  const [bottomTableSearch, setBottomTableSearch] = useState("");

  const productPurchases = useMemo(() => {
    if (!selectedProductDetails) return [];

    return bills.filter(bill => {
      if (bill.status === 'CANCELLED') return false;
      return bill.items?.some(item =>
        item.productId === selectedProductDetails.id ||
        item.productName === selectedProductDetails.name
      );
    }).map(bill => {
      const item = bill.items?.find(i =>
        i.productId === selectedProductDetails.id ||
        i.productName === selectedProductDetails.name
      );
      return {
        customerName: bill.customerName,
        customerPhone: bill.customerPhone,
        quantity: item?.quantity || 1,
        date: bill.createdAt,
        total: (item?.unitPrice || 0) * (item?.quantity || 1)
      };
    });
  }, [selectedProductDetails, bills]);

  const lowStockProducts = useMemo(() => {
    return productPerformance.filter(p => (p.stock || 0) <= 5);
  }, [productPerformance]);



  const totalExpenseAmount = useMemo(() => expenses.reduce((sum, e) => sum + (e.amount || 0), 0), [expenses]);

  // Helper to calculate pie data
  const getPieDataForRange = (start: Date, end: Date) => {
    let revenue = 0;
    let cogs = 0;

    const filteredRangeBills = bills.filter(bill => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return false;
      const billDate = new Date(bill.createdAt || new Date());
      return billDate >= start && billDate <= end;
    });

    const combinedProducts = products;
    const productMap = new Map(combinedProducts.map(p => [p.name, p]));
    const productIdMap = new Map(combinedProducts.map(p => [p.id, p]));

    filteredRangeBills.forEach(bill => {
      revenue += (bill.finalAmount || bill.amountPaid || 0);
      bill.items?.forEach(item => {
        const prod = productIdMap.get(item.productId) || productMap.get(item.productName);
        cogs += prod ? ((prod.purchaseRate || 0) * item.quantity) : (item.unitPrice * item.quantity * 0.7);
      });
    });

    const filteredRangeExpenses = expenses.filter((entry: any) => {
      const dateStr = entry.date || entry.createdAt;
      if (!dateStr) return false;
      const expenseDate = new Date(dateStr);
      return !isNaN(expenseDate.getTime()) && expenseDate >= start && expenseDate <= end;
    });

    const profit = revenue - cogs;
    const expenseAmount = filteredRangeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return [
      { name: 'Revenue', value: revenue, color: '#3b82f6' },
      { name: 'Profit', value: profit, color: '#10b981' },
      { name: 'Cost of Goods', value: cogs, color: '#facc15' },
      { name: 'Expenses', value: expenseAmount, color: '#ef4444' }
    ];
  };

  const pieData = useMemo(() => {
    return getPieDataForRange(startOfDay(new Date(startDate)), endOfDay(new Date(endDate)));
  }, [bills, expenses, products, startDate, endDate]);

  const allPieData = useMemo(() => {
    const now = new Date();
    return {
      day: getPieDataForRange(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })),
      week: getPieDataForRange(startOfMonth(now), endOfMonth(now)),
      month: getPieDataForRange(startOfMonth(now), endOfMonth(now)),
      year: getPieDataForRange(startOfYear(now), endOfYear(now))
    };
  }, [bills, expenses, products]);



  const handleDownloadReport = async () => {
    const element = document.getElementById("report-container");
    if (!element) return;

    // Temporarily make it visible for capture (off-screen)
    element.style.display = "block";
    element.style.position = "absolute";
    element.style.left = "-9999px";
    element.style.top = "0";

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1200 // Ensure consistent width for report
    });

    element.style.display = "none";

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`Business_Dashboard_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

    toast({ title: "Success", description: "Report downloaded successfully" });
  };

  // Helper to aggregate data for report
  const getReportData = () => {
    // Current date range stats
    const reportKpis = [
      { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}` },
      { label: 'Total Profit', value: `₹${totalProfit.toLocaleString()}` },
      { label: 'Total Expense', value: `₹${totalExpenseAmount.toLocaleString()}` },
      { label: 'Total Transactions', value: totalTransactions },
      { label: 'Low Stock Count', value: lowStockProducts.length }
    ];

    // Top 5 Products with full data
    const topProducts = topSellingProducts.slice(0, 5).map((p, i) => ({
      rank: i + 1,
      date: p.purchaseDate ? format(new Date(p.purchaseDate), 'dd MMM yyyy') : 'N/A',
      productId: p.id || 'N/A',
      name: p.name,
      category: p.category || 'N/A',
      supplierId: (p.weaverId && p.weaverId !== 'N/A' ? p.weaverId : p.vendorId) || 'N/A',
      supplierInfo: (p.weaverName && p.weaverName !== 'N/A' ? p.weaverName : p.vendorName) || 'N/A',
      purchasePrice: `₹${p.purchaseRate.toLocaleString()}`,
      sellingPrice: `₹${p.sellingPrice.toLocaleString()}`,
      qtySold: p.qtySold,
      stock: p.stock
    }));

    return { reportKpis, topProducts };
  };

  const { reportKpis, topProducts } = getReportData();

  if (loading && totalRevenue === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Business performance and analytics</p>
        </div>
        <div className="flex gap-4 items-center">


          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-blue-500 px-3 py-1.5 border outline-none font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-blue-500 px-3 py-1.5 border outline-none font-bold"
              />
            </div>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Download size={16} /> Download Report
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Revenue</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <DollarSign size={18} />
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Profit</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Expense</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalExpenseAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
            <TrendingDown size={18} />
          </div>
        </div>

        {/* Mode of Transactions */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-medium text-slate-500">Transactions</p>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="flex items-center justify-between text-xs text-slate-600"><span>UPI:</span> <span className="font-bold">{txStats.upi}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Cash:</span> <span className="font-bold">{txStats.cash}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Card:</span> <span className="font-bold">{txStats.card}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Split:</span> <span className="font-bold">{txStats.split}</span></div>
            <div className="flex items-center justify-between text-xs text-purple-600 font-bold"><span>Partial:</span> <span className="font-bold">{txStats.partial}</span></div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition cursor-pointer"
          onClick={() => setIsLowStockModalOpen(true)}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock</p>
            <h3 className="text-xl font-bold text-slate-800">
              {lowStockProducts.length}
            </h3>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${(lowStockProducts.length) > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      <LowStockProductsModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        lowStockProducts={lowStockProducts}
      />

      {/* Time Range Toggle Row */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm">
          {(['day', 'week', 'month', 'year'] as const).map(view => (
            <button
              key={view}
              onClick={() => setDashboardView(view)}
              className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${dashboardView === view ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {view.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-lg">Earnings vs Expenses</h3>
          </div>
          <div className="h-[300px]">
            {chartDataFetched.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 font-medium">
                No transactions for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataFetched} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="income" name="Earnings" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-lg">Revenue Distribution</h3>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <span className="text-[10px] font-black text-blue-600 px-2 py-1 bg-white rounded shadow-sm">SYNCED VIEW</span>
            </div>
          </div>
          <div className="h-[250px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={65} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 gap-6">

        {/* Top 5 Performing Products Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" />
              Top 5 Performing Products
            </h3>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
              Based on Quantity Sold
            </span>
          </div>

          <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">
                  <th className="p-3 font-bold text-center">Rank</th>
                  <th className="p-3 font-bold whitespace-nowrap">Date</th>
                  <th className="p-3 font-bold">Product ID</th>
                  <th className="p-3 font-bold">Product Name</th>
                  <th className="p-3 font-bold">Category</th>
                  <th className="p-3 font-bold">Supplier ID</th>
                  <th className="p-3 font-bold">Supplier Info</th>
                  <th className="p-3 font-bold whitespace-nowrap">Purchase Price</th>
                  <th className="p-3 font-bold whitespace-nowrap">Selling Price</th>
                  <th className="p-3 font-bold text-center">Qty Sold</th>
                  <th className="p-3 font-bold text-center">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSellingProducts.slice(0, 5).map((p, i) => {
                  let badge = "";
                  if (i === 0) badge = "🥇 #1";
                  else if (i === 1) badge = "🥈 #2";
                  else if (i === 2) badge = "🥉 #3";
                  else badge = `#${i + 1}`;

                  let badgeClasses = "inline-flex items-center justify-center font-black px-2.5 py-1 rounded-full shadow-sm text-xs whitespace-nowrap border ";
                  if (i === 0) badgeClasses += "bg-yellow-100 text-yellow-800 border-yellow-300";
                  else if (i === 1) badgeClasses += "bg-slate-200 text-slate-800 border-slate-300";
                  else if (i === 2) badgeClasses += "bg-amber-100 text-amber-800 border-amber-300";
                  else badgeClasses += "bg-slate-50 text-slate-500 border-slate-200";

                  const isTop3 = i < 3;

                  return (
                    <tr key={i} className={`group transition-colors ${isTop3 ? 'bg-amber-50/20 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'}`}>
                      <td className="p-3 text-center">
                        <span className={badgeClasses} title={`Rank ${i + 1} Top Seller`}>{badge}</span>
                      </td>
                      <td className="p-3 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                        {(() => {
                          try {
                            return p.purchaseDate && !isNaN(new Date(p.purchaseDate).getTime())
                              ? format(new Date(p.purchaseDate), 'dd MMM yyyy')
                              : 'N/A';
                          } catch (e) { return 'N/A'; }
                        })()}
                      </td>
                      <td className="p-3 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">
                        {p.id || 'N/A'}
                      </td>
                      <td className="p-3 min-w-[140px]">
                        <p className="font-black text-slate-800 text-sm leading-tight group-hover:text-amber-700 transition-colors">{p.name}</p>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {p.category || 'N/A'}
                      </td>
                      <td className="p-3 text-[11px] font-mono font-bold text-slate-400">
                        {(p.weaverId && p.weaverId !== 'N/A' ? p.weaverId : p.vendorId) || 'N/A'}
                      </td>
                      <td className="p-3 min-w-[140px]">
                        <p className="text-xs font-bold text-slate-700 leading-tight">
                          {(p.weaverName && p.weaverName !== 'N/A' ? p.weaverName : p.vendorName) || 'N/A'}
                        </p>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-600 whitespace-nowrap">
                        ₹{p.purchaseRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-600 whitespace-nowrap">
                        ₹{p.sellingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100/50 block mx-auto w-fit">
                          {p.qtySold}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-xs font-black px-2 py-1 rounded-md flex items-center justify-center gap-1 mx-auto w-fit ${p.stock <= 5 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                          {p.stock <= 5 && <AlertTriangle size={12} className="text-red-500" />} {p.stock}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {topSellingProducts.length === 0 && (
                  <tr><td colSpan={12} className="p-6 text-center text-slate-400 font-medium">No sales data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* View Product Modal */}
      {selectedProductDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                  <Package className="text-blue-600" size={28} />
                  Product Sales Intelligence
                </h2>
                <p className="text-slate-500 font-bold text-sm mt-1">
                  Showing customers who purchased <span className="text-blue-600">"{selectedProductDetails.name}"</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-600 p-4 rounded-2xl text-white">
                  <p className="text-[10px] uppercase font-black opacity-80">Product ID</p>
                  <p className="text-lg font-mono font-black truncate">{selectedProductDetails.id}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Total Units Sold</p>
                  <p className="text-xl font-black text-slate-800">{selectedProductDetails.qtySold}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Total Revenue</p>
                  <p className="text-xl font-black text-slate-800">₹{selectedProductDetails.revenue.toLocaleString()}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Remaining Stock</p>
                  <p className={`text-xl font-black ${selectedProductDetails.stock <= 5 ? 'text-rose-600' : 'text-slate-800'}`}>{selectedProductDetails.stock}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-5 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    <Users size={18} className="text-blue-500" />
                    Purchasing Customers
                  </h3>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-[10px] text-slate-400 uppercase font-bold tracking-widest border-b border-slate-100">
                      <th className="p-4">Customer Details</th>
                      <th className="p-4">Purchase Qty</th>
                      <th className="p-4">Purchase Date</th>
                      <th className="p-4 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 font-medium">
                    {productPurchases.map((hist: any, idx: number) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{hist.customerName}</p>
                          <p className="text-[10px] text-slate-400">PH: {hist.customerPhone}</p>
                        </td>
                        <td className="p-4">
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-black">{hist.quantity} Units</span>
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-bold">
                          {format(new Date(hist.date), 'dd MMM yyyy')}
                        </td>
                        <td className="p-4 text-right font-black text-slate-800">
                          ₹{hist.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {productPurchases.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-400 font-bold italic">No purchase history found for this product</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-black text-sm hover:bg-slate-900 transition"
              >
                CLOSE DETAILS
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Pricing Insights */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6 text-lg">Best Selling Products UI (Pricing)</h3>
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSellingProducts} layout="horizontal" margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="colorSold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="colorRemain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#fb923c" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="chartLabel" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} dy={15} width={80} interval={0} angle={-15} textAnchor="end" />
              <YAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-5} />
              <RechartsTooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xl min-w-[240px]">
                        <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2 flex items-center justify-between">
                          <span className="line-clamp-1 text-sm">{data.chartLabel}</span>
                          <span className="text-[9px] font-mono text-slate-400 ml-2">#{data.hashtagNumber || data.id?.slice(-6) || 'N/A'}</span>
                        </p>
                        <div className="space-y-2 text-xs">
                          <div className="pt-2">
                            <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-wider">Inventory Insight</p>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex flex-col justify-center">
                                <div className="text-slate-400 font-bold uppercase mb-0.5 text-[9px]">Total Qty</div>
                                <div className="font-black text-slate-700">{data.totalQty}</div>
                              </div>
                              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 flex flex-col justify-center">
                                <div className="text-emerald-600 font-bold uppercase mb-0.5 text-[9px]">Qty Sold</div>
                                <div className="font-black text-emerald-700">{data.qtySold}</div>
                              </div>
                              <div className={`p-2 rounded-lg border flex flex-col justify-center ${data.stock <= 5 ? 'bg-rose-50 border-rose-100' : 'bg-orange-50 border-orange-100'}`}>
                                <div className={`${data.stock <= 5 ? 'text-rose-500' : 'text-orange-600'} font-bold uppercase mb-0.5 text-[9px]`}>Remaining</div>
                                <div className={`font-black ${data.stock <= 5 ? 'text-rose-600' : 'text-orange-700'}`}>{data.stock}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 600 }} />

              {/* Thin, rounded bars with spacing */}
              <Bar
                dataKey="totalQty"
                name="Total Quantity"
                fill="url(#colorTotal)"
                radius={[4, 4, 0, 0]}
                barSize={16}
              />
              <Bar
                dataKey="qtySold"
                name="Quantity Sold"
                fill="url(#colorSold)"
                radius={[4, 4, 0, 0]}
                barSize={16}
              />
              <Bar
                dataKey="stock"
                name="Remaining Stock"
                fill="url(#colorRemain)"
                radius={[4, 4, 0, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pricing Insights & Margins Row */}
      <div className="pb-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm font-sans">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <DollarSign size={20} className="text-blue-500" /> Pricing Insights & Margins
            </h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Search Product Name..."
                value={bottomTableSearch}
                onChange={(e) => setBottomTableSearch(e.target.value)}
                className="pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none w-48 font-medium"
              />
              <Package size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
          <div className="max-h-[500px] overflow-auto custom-scrollbar border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
                <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                  <th className="p-4 text-center">Rank</th>
                  <th className="p-4 whitespace-nowrap">Date</th>
                  <th className="p-4">Product ID</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Supplier ID</th>
                  <th className="p-4">Supplier Info</th>
                  <th className="p-4 whitespace-nowrap">Buying Price (₹)</th>
                  <th className="p-4 whitespace-nowrap">Selling Price (₹)</th>
                  <th className="p-4 whitespace-nowrap">Margin (₹)</th>
                  <th className="p-4">Margin (%)</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.filter(p => {
                  if (!bottomTableSearch) return true;
                  const search = bottomTableSearch.toLowerCase();
                  return p.name.toLowerCase().includes(search);
                }).map(p => {
                  const isEditing = editingProductId === p.id;
                  const buy = isEditing ? editValues.purchaseRate : (p.purchaseRate || 0);
                  const sell = isEditing ? editValues.sellingPrice : (p.sellingPrice || 0);
                  const marginAmt = sell - buy;
                  const marginPct = buy > 0 ? (marginAmt / buy) * 100 : 0;
                  const isProfitable = marginAmt >= 0;

                  const topRankIndex = topSellingProducts.findIndex(tp => tp.id === p.id);
                  const isTop5 = topRankIndex !== -1 && topRankIndex < 5;

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors group cursor-pointer ${isEditing ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                      onClick={() => {
                        if (!isEditing && p.id) {
                          handleEditClick(p);
                        }
                      }}
                    >
                      <td className="p-4 text-center">
                        {isTop5 ? (
                          <span className={`inline-flex items-center justify-center font-black px-2.5 py-1 rounded-full shadow-sm text-[10px] whitespace-nowrap border ${topRankIndex === 0 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                              topRankIndex === 1 ? 'bg-slate-200 text-slate-800 border-slate-300' :
                                topRankIndex === 2 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                  'bg-blue-50 text-blue-600 border-blue-200'
                            }`}>
                            {topRankIndex === 0 ? '🥇 #1' : topRankIndex === 1 ? '🥈 #2' : topRankIndex === 2 ? '🥉 #3' : `#${topRankIndex + 1}`}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">#{topRankIndex + 1 > 0 ? topRankIndex + 1 : '-'}</span>
                        )}
                      </td>
                      <td className="p-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">
                        {(() => {
                          try {
                            const dateVal = p.purchaseDate || p.createdAt;
                            return dateVal && !isNaN(new Date(dateVal).getTime())
                              ? format(new Date(dateVal), 'dd MMM yyyy')
                              : 'N/A';
                          } catch (e) { return 'N/A'; }
                        })()}
                      </td>
                      <td className="p-4 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-tight">
                        {p.id || 'N/A'}
                      </td>
                      <td className="p-4 font-medium text-slate-800">
                        <div className="flex flex-col items-start gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-800">{p.name}</span>
                            {isEditing && <span className="px-1.5 py-0.5 text-[9px] uppercase font-black text-blue-600 bg-blue-100 rounded-md animate-pulse">EDITING</span>}
                          </div>
                          {isTop5 && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-sm">
                              ⭐ TOP SELLER
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {p.category || 'N/A'}
                      </td>
                      <td className="p-4 text-[11px] font-mono font-bold text-slate-400">
                        {(p.weaverId && p.weaverId !== 'N/A' ? p.weaverId : p.vendorId) || 'N/A'}
                      </td>
                      <td className="p-4 min-w-[120px]">
                        <p className="text-[11px] font-bold text-slate-700 leading-tight">
                          {(p.weaverName && p.weaverName !== 'N/A' ? p.weaverName : p.vendorName) || 'N/A'}
                        </p>
                      </td>
                      <td className="p-4" onClick={(e) => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input
                            type="number"
                            autoFocus
                            className="w-24 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                            value={editValues.purchaseRate === 0 ? '' : editValues.purchaseRate}
                            onChange={e => setEditValues(prev => ({ ...prev, purchaseRate: parseFloat(e.target.value) || 0 }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && p.id) {
                                e.preventDefault();
                                handleSaveEdit(p.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs font-bold text-slate-600">₹{buy.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        )}
                      </td>
                      <td className="p-4" onClick={(e) => isEditing && e.stopPropagation()}>
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-24 px-2 py-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                            value={editValues.sellingPrice === 0 ? '' : editValues.sellingPrice}
                            onChange={e => setEditValues(prev => ({ ...prev, sellingPrice: parseFloat(e.target.value) || 0 }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && p.id) {
                                e.preventDefault();
                                handleSaveEdit(p.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                        ) : (
                          <span className="text-xs font-bold text-slate-600">₹{sell.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        )}
                      </td>
                      <td className="p-4 font-bold">
                        <span className={`text-xs ${isProfitable ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isProfitable ? '+' : ''}₹{marginAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black ${isProfitable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isProfitable ? '+' : ''}{(marginPct || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); if (p.id) handleSaveEdit(p.id); }}
                              className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                              title="Save (Enter)"
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                              className="p-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                              title="Cancel (Esc)"
                            >
                              <X size={16} strokeWidth={3} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                            title="Edit Pricing"
                            onClick={(e) => { e.stopPropagation(); if (p.id) handleEditClick(p); }}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-500">No product data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Hidden Report Container */}
      <div id="report-container" style={{ display: 'none', width: '1000px', backgroundColor: 'white', color: 'black', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0' }}>Business Dashboard Report</h1>
          <p style={{ color: '#64748b', marginTop: '10px', fontSize: '16px' }}>
            Period: {format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>
            Generated on: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
          {reportKpis.map((kpi, i) => (
            <div key={i} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 'medium', marginBottom: '8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Sections */}
        {(['day', 'week', 'month', 'year'] as const).map((view) => (
          <div key={view} style={{ 
            marginBottom: '40px', 
            breakBefore: (view === 'month' || view === 'year') ? 'page' : 'auto',
            paddingTop: (view === 'month' || view === 'year') ? '20px' : '0' 
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #3b82f6', paddingLeft: '15px', color: '#1e293b', textTransform: 'capitalize' }}>
              {view === 'day' ? 'Daily' : view === 'week' ? 'Weekly' : view === 'month' ? 'Monthly' : 'Yearly'} Analytics
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '15px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Revenue vs Expenses</h3>
                <BarChart width={440} height={220} data={allPeriodsData[view]} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{fontSize: 9}} />
                  <YAxis tick={{fontSize: 9}} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Bar dataKey="income" name="Earnings" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </div>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '15px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Revenue Distribution</h3>
                <PieChart width={440} height={220}>
                  <Pie data={allPieData[view]} innerRadius={35} outerRadius={65} dataKey="value" stroke="#fff" strokeWidth={2}>
                    {allPieData[view].map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px'}} />
                </PieChart>
              </div>
            </div>
          </div>
        ))}

        {/* Best Selling Products Graph (Pricing) */}
        <div style={{ marginBottom: '40px', breakBefore: 'page', paddingTop: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #6366f1', paddingLeft: '15px', color: '#1e293b' }}>
            Best Selling Products UI (Pricing)
          </h2>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px', backgroundColor: '#fff' }}>
            <BarChart width={900} height={350} data={topSellingProducts.slice(0, 8)} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="chartLabel" interval={0} angle={-20} textAnchor="end" tick={{fontSize: 10, fontWeight: 600}} dy={15} />
              <YAxis tick={{fontSize: 10}} />
              <Bar dataKey="totalQty" name="Total Quantity" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="qtySold" name="Quantity Sold" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="stock" name="Remaining Stock" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '12px'}} />
            </BarChart>
          </div>
        </div>

        {/* Top Performing Products */}
        <div style={{ marginBottom: '40px', breakBefore: 'page' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #10b981', paddingLeft: '15px' }}>Top 5 Performing Products</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <thead style={{ backgroundColor: '#f8fafc', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Rank</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Product ID</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Product Name</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Supplier ID</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Supplier Info</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Purchase Price</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Selling Price</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Qty Sold</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Stock</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '10px' }}>
              {topProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>{p.rank}</td>
                  <td style={{ padding: '10px' }}>{p.date}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{p.productId}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: '10px' }}>{p.category}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{p.supplierId}</td>
                  <td style={{ padding: '10px' }}>{p.supplierInfo}</td>
                  <td style={{ padding: '10px' }}>{p.purchasePrice}</td>
                  <td style={{ padding: '10px' }}>{p.sellingPrice}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#059669' }}>{p.qtySold}</td>
                  <td style={{ padding: '10px', color: p.stock <= 5 ? '#ef4444' : '#64748b' }}>{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Low Stock Products Section */}
        <div style={{ marginBottom: '50px', breakBefore: 'page' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #ef4444', paddingLeft: '15px', color: '#1e293b' }}>
            Low Stock Products Details
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <thead style={{ backgroundColor: '#fef2f2' }}>
              <tr style={{ textAlign: 'left', fontSize: '9px', textTransform: 'uppercase', color: '#64748b' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>S.No</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Supplier Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Supplier ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Series</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Purchase Price</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Qty</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Sold Out (qty sold)</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Available Stock</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '9px' }}>
              {lowStockProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: p.stock === 0 ? '#fff1f2' : 'transparent' }}>
                  <td style={{ padding: '8px' }}>{i + 1}</td>
                  <td style={{ padding: '8px' }}>{p.purchaseDate ? format(new Date(p.purchaseDate), 'dd MMM yyyy') : 'N/A'}</td>
                  <td style={{ padding: '8px' }}>{p.vendorName || 'N/A'}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>#{p.vendorId?.slice(-8) || 'N/A'}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: '8px' }}>#{p.hashtagNumber || 'N/A'}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{p.id}</td>
                  <td style={{ padding: '8px' }}>{p.category || 'N/A'}</td>
                  <td style={{ padding: '8px' }}>₹{p.purchaseRate.toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{(p.qtySold || 0) + (p.stock || 0)}</td>
                  <td style={{ padding: '8px', color: '#059669', fontWeight: 'bold' }}>{p.qtySold || 0}</td>
                  <td style={{ padding: '8px', color: '#ef4444', fontWeight: 'bold' }}>{p.stock}</td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No low stock products</td></tr>}
            </tbody>
          </table>
        </div>


      </div>
    </div>
  );
};

export default DashboardOverview;

