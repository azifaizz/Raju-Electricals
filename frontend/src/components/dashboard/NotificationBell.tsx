import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Bell, X, AlertCircle, Info, ChevronRight, Check, Calendar, Clock, Users } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { useGlobalData } from '@/context/GlobalDataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<any>(null);
    const trayRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'notification' | 'customer' | 'product'>('notification');
    const { bills, customers } = useGlobalData();
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (trayRef.current && !trayRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleViewProduct = (notification: any) => {
        markAsRead(notification.id);
        setIsOpen(false);
        setSelectedNotification(null);
        navigate(`/admin/view-product?customerId=${notification.customerId || ''}&phone=${notification.customerPhone || ''}`);
    };

    const handleViewCustomer = (notification: any) => {
        markAsRead(notification.id);
        setIsOpen(false);
        setSelectedNotification(null);
        
        // Navigate to the Customer Details page
        // 1. Try customerId
        if (notification.customerId) {
            navigate(`/admin/customers/${notification.customerId}?billId=${notification.billId}`);
            return;
        } 

        // 2. Try searching by phone in global customers list (Legacy Fallback)
        if (notification.customerPhone) {
            const foundCustomer = customers.find(c => c.phone === notification.customerPhone.toString());
            if (foundCustomer) {
                navigate(`/admin/customers/${foundCustomer.id}?billId=${notification.billId}`);
                return;
            }
        }
        
        // 3. Last fallback to list with highlight
        navigate(`/admin/customers?highlight=${notification.customerPhone || notification.id}&status=${notification.status}&billId=${notification.billId}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OVERDUE': return 'text-red-600 bg-red-100';
            case 'WARNING': return 'text-orange-600 bg-orange-100';
            default: return 'text-green-600 bg-green-100';
        }
    };

    const getStatusBorder = (status: string) => {
        switch (status) {
            case 'OVERDUE': return 'border-red-200';
            case 'WARNING': return 'border-orange-200';
            default: return 'border-green-200';
        }
    };

    return (
        <div className="relative" ref={trayRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
                <div className={unreadCount > 0 ? "animate-bell-ring origin-top inline-block" : "origin-top inline-block"}>
                    <Bell size={24} className="text-gray-600" />
                </div>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">
                        {unreadCount}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] overflow-hidden"
                    >
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="font-bold text-gray-800">Upcoming Deadlines</h3>
                                <p className="text-xs text-gray-500">{unreadCount} Unread</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={markAllAsRead}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                >
                                    <Check size={14} /> Mark all read
                                </button>
                                <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center">
                                    <Bell size={40} className="mx-auto text-gray-200 mb-3" />
                                    <p className="text-gray-500 text-sm">No notifications yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {notifications.map((n) => (
                                        <div
                                            key={n.id}
                                            onClick={() => setSelectedNotification(n)}
                                            className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative group ${!n.read ? 'bg-blue-50/30' : ''}`}
                                        >
                                            {!n.read && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                                            <div className="flex gap-3">
                                                <div className={`p-2 rounded-full h-fit ${getStatusColor(n.status)}`}>
                                                    {n.status === 'OVERDUE' ? <AlertCircle size={18} /> : <Bell size={18} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <h4 className="font-bold text-sm text-gray-800 truncate">Deadline Alert: {n.productName}</h4>
                                                        <span className="text-[10px] text-gray-400">
                                                            {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 mb-1">{n.customerName} | {n.customerPhone}</p>
                                                    <div className="flex items-center justify-between mt-2">
                                                         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getStatusColor(n.status)} uppercase tracking-wider`}>
                                                             {n.status === 'OVERDUE' ? 'Overdue' : `${n.daysRemaining} Days Left`}
                                                         </span>
                                                         <button 
                                                             onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 handleViewCustomer(n);
                                                             }}
                                                             className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 bg-blue-50 px-2 py-1 rounded-lg transition-colors border border-blue-100"
                                                         >
                                                             <Users size={12} /> View Customer
                                                         </button>
                                                     </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Detail Modal */}
            <AnimatePresence>
                {selectedNotification && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className={`p-6 border-b flex justify-between items-center ${getStatusColor(selectedNotification.status)}`}>
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={24} />
                                    <h2 className="text-xl font-black uppercase tracking-tight">DEADLINE ALERT</h2>
                                </div>
                                <button onClick={() => setSelectedNotification(null)} className="p-1 hover:bg-black/10 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8">
                                {viewMode === 'notification' && (
                                    <>
                                        <div className="mb-8">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Product Details</p>
                                            <h3 className="text-2xl font-black text-gray-900 mb-4 truncate text-blue-600">
                                                {selectedNotification.productName}
                                            </h3>

                                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-500">
                                                    <Calendar size={24} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-800">
                                                        {selectedNotification.status === 'OVERDUE' ? 'OVERDUE' : `${selectedNotification.daysRemaining} Days Left`}
                                                    </p>
                                                    <p className="text-xs text-gray-500 font-medium">Customer: {selectedNotification.customerName}</p>
                                                    <p className="text-xs text-gray-500 font-medium">Contact: {selectedNotification.customerPhone}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => handleViewCustomer(selectedNotification)}
                                                    className="flex-1 py-4 px-6 rounded-xl font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all shadow-sm flex items-center justify-center gap-2 transform active:scale-95"
                                                >
                                                    <Users size={20} /> View Customer
                                                </button>
                                                <button
                                                    onClick={() => handleViewProduct(selectedNotification)}
                                                    className={`flex-1 py-4 px-6 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transform active:scale-95 transition-all
                                                    ${selectedNotification.status === 'OVERDUE' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' :
                                                            selectedNotification.status === 'WARNING' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' :
                                                                'bg-green-600 hover:bg-green-700 shadow-green-200'}`}
                                                >
                                                    View Product <ChevronRight size={20} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedNotification(null);
                                                    setViewMode('notification');
                                                }}
                                                className="w-full py-3 px-6 rounded-xl font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </>
                                )}


                                {viewMode === 'product' && (
                                    <div className="animate-in fade-in zoom-in-95 duration-200 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        <button onClick={() => setViewMode('notification')} className="mb-6 text-blue-600 font-bold flex items-center gap-1 hover:text-blue-700 transition">&larr; Back</button>
                                        <h3 className="text-xl font-black text-gray-900 mb-4">Purchased Products</h3>
                                        <div className="space-y-3">
                                            {bills.filter(b => b.customerPhone?.toString() === selectedNotification?.customerPhone?.toString()).flatMap(b => b.items || []).filter((item, index, self) => index === self.findIndex((t) => t.productName === item.productName)).length === 0 ? (
                                                <p className="text-center text-gray-500 py-4">No products found.</p>
                                            ) : (
                                                bills.filter(b => b.customerPhone?.toString() === selectedNotification?.customerPhone?.toString()).flatMap(b => b.items || []).filter((item, index, self) => index === self.findIndex((t) => t.productName === item.productName)).map((p, i) => (
                                                    <div key={i} className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-1">
                                                        <span className="font-bold text-gray-800">{p.productName}</span>
                                                        <div className="flex justify-between items-center text-sm mt-2">
                                                            <span className="text-gray-500 font-mono bg-white px-2 py-0.5 rounded border border-gray-100">Qty: {p.quantity || 1}</span>
                                                            <span className="text-green-600 font-bold">₹{((p.netAmount || 0) || (p.unitPrice * (p.quantity || 1))).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <button onClick={() => { markAsRead(selectedNotification.id); setIsOpen(false); setSelectedNotification(null); setViewMode('notification'); }} className="w-full mt-6 py-3 px-6 bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold rounded-xl transition">Mark as Done & Close</button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default NotificationBell;
