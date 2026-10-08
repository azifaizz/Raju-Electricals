import React, { useEffect, useState } from 'react';
import { ShoppingCart, Package, Users, TrendingUp, AlertTriangle, PlusCircle, CreditCard, Banknote } from 'lucide-react';
import { useGlobalData } from '@/context/GlobalDataContext';
import { format } from 'date-fns';
import { daybookApi } from '@/lib/api';
import LowStockProductsModal from './LowStockProductsModal';
import { useNavigate } from 'react-router-dom';

const CashierDashboard = () => {
  const { bills = [], products = [], customers = [] } = useGlobalData() as any;
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);
  const navigate = useNavigate();

  const todayBills = bills.filter((b: any) => {
    const bDate = new Date(b.createdAt || new Date());
    const isToday = format(bDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    return isToday && b.status !== 'CANCELLED' && b.status !== 'HOLD';
  });

  const todayStats = {
    totalBills: todayBills.length,
    revenue: todayBills.reduce((sum: number, b: any) => sum + (b.finalAmount || b.amountPaid || 0), 0)
  };

  const recentBills = todayBills.slice(0, 5);

  const lowStockProducts = products.filter((p: any) => p.stock <= 5);

  // Calculate payment methods for today
  const txStats = todayBills.reduce((acc: any, bill: any) => {
    const method = (bill.paymentMethod || 'Cash').toUpperCase();
    if (method.includes('UPI')) acc.upi++;
    else if (method.includes('CARD')) acc.card++;
    else if (method.includes('SPLIT')) acc.split++;
    else if (method.includes('PARTIAL')) acc.partial++;
    else acc.cash++;
    return acc;
  }, { cash: 0, upi: 0, card: 0, split: 0, partial: 0 });

  return (
    <div className="p-2 sm:p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Cashier Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here is a quick overview of today's activities.</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex items-center gap-3">
            <button 
                onClick={() => navigate('/cashier')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition shadow-sm text-sm"
            >
                <PlusCircle size={16} /> New Bill
            </button>
            <button 
                onClick={() => navigate('/cashier/products')}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition shadow-sm text-sm"
            >
                <Package size={16} /> Products
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingCart size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</span>
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Today's Transactions</p>
            <h3 className="text-2xl font-black text-slate-800">{todayStats.totalBills}</h3>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</span>
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Today's Revenue</p>
            <h3 className="text-2xl font-black text-slate-800">₹{todayStats.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h3>
          </div>
        </div>

        {/* Metric 3 (Transactions Breakdown) */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-medium text-slate-500">Payment Modes</p>
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center">
              <Banknote size={16} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-auto">
            <div className="flex items-center justify-between text-xs text-slate-600"><span>UPI:</span> <span className="font-bold text-slate-800">{txStats.upi}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Cash:</span> <span className="font-bold text-slate-800">{txStats.cash}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Card:</span> <span className="font-bold text-slate-800">{txStats.card}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Split:</span> <span className="font-bold text-slate-800">{txStats.split}</span></div>
          </div>
        </div>

        {/* Metric 4 (Low Stock) */}
        <div 
          onClick={() => setIsLowStockModalOpen(true)}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-amber-200 transition cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${lowStockProducts.length > 0 ? 'bg-amber-100 text-amber-600 group-hover:bg-amber-200' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alerts</span>
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Low Stock Products</p>
            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                {lowStockProducts.length}
                {lowStockProducts.length > 0 && <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-md">Action needed</span>}
            </h3>
          </div>
        </div>
      </div>

      {/* Recent Bills Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800">Recent Transactions (Today)</h2>
            <button 
                onClick={() => navigate('/cashier/printed-bills')}
                className="text-sm font-bold text-blue-600 hover:text-blue-800"
            >
                View All →
            </button>
        </div>
        {recentBills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-3 font-bold">Bill ID</th>
                  <th className="pb-3 font-bold">Customer</th>
                  <th className="pb-3 font-bold text-right">Amount</th>
                  <th className="pb-3 font-bold text-right">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentBills.map((bill: any) => (
                  <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 font-mono font-bold text-slate-600 text-sm">#{bill.id.slice(-6)}</td>
                    <td className="py-3 font-bold text-slate-700 text-sm">{bill.customerName || 'Walk-in'}</td>
                    <td className="py-3 text-right font-black text-slate-800 text-sm">₹{(bill.finalAmount || bill.amountPaid || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="py-3 text-right">
                      <span className="inline-block px-2 py-1 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 uppercase">
                        {bill.paymentMethod || 'Cash'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
             <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                 <ShoppingCart size={24} />
             </div>
             <p className="text-slate-500 font-bold mb-1">No transactions yet.</p>
             <p className="text-sm text-slate-400">Start billing to see recent transactions here.</p>
          </div>
        )}
      </div>

      <LowStockProductsModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        lowStockProducts={lowStockProducts}
      />
    </div>
  );
};

export default CashierDashboard;
