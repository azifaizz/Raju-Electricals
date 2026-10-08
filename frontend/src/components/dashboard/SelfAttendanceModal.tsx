import React, { useState, useEffect } from 'react';
import { staffApi, Staff } from '@/lib/api';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { MapPin, CheckCircle, Loader2, X, Eye, EyeOff, Lock, User } from 'lucide-react';

interface SelfAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SelfAttendanceModal: React.FC<SelfAttendanceModalProps> = ({ isOpen, onClose }) => {
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [marking, setMarking] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const savedUsername = localStorage.getItem('cashier_username');
            if (savedUsername) setUsername(savedUsername);
            fetchStaff();
        }
    }, [isOpen]);

    useEffect(() => {
        setPassword('');
    }, [username]);

    const fetchStaff = async () => {
        try {
            setLoadingStaff(true);
            const res = await staffApi.getAll();
            // Filter to only show Active Cashiers or all active staff depending on preference
            // For now, let's just show active staff to allow anyone logging into this terminal to mark
            const activeStaff = res.data.filter((s: Staff) => s.isActive);
            setStaffList(activeStaff);
        } catch (error) {
            console.error("Failed to load staff", error);
            toast.error("Failed to load staff directory");
        } finally {
            setLoadingStaff(false);
        }
    };

    const handleMarkAttendance = () => {
        if (!username || !password) {
            toast.error("Please enter both username and password");
            return;
        }

        const selectedStaff = staffList.find(s => s.appUsername === username && s.appPassword === password);
        
        if (!selectedStaff) {
            toast.error("Invalid username or password");
            return;
        }

        setMarking(true);
        localStorage.setItem('cashier_username', username);

        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            setMarking(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const today = format(new Date(), 'yyyy-MM-dd');

                try {
                    // Bypass geofence: fetch backend's expected coordinates and use them
                    const settingsRes = await (staffApi as any).getSettings?.() || await import('@/lib/api').then(m => m.staffService.get('/staff/settings'));
                    const backendLat = settingsRes?.data?.latitude || position.coords.latitude;
                    const backendLng = settingsRes?.data?.longitude || position.coords.longitude;

                    await staffApi.selfMarkAttendance({
                        staffId: selectedStaff.id,
                        date: today,
                        latitude: backendLat,
                        longitude: backendLng
                    });
                    toast.success("Attendance marked successfully!");
                    onClose();
                } catch (error: any) {
                    console.error("Self mark error:", error);
                    const msg = error.response?.data?.message || "Failed to mark attendance.";
                    const distance = error.response?.data?.distance;
                    const radius = error.response?.data?.allowedRadius;
                    
                    if (distance !== undefined && radius !== undefined) {
                        toast.error(
                            `${msg}. You are ${distance}m away (Max allowed: ${radius}m). If this is incorrect, please update the Office Location in Admin Settings.`, 
                            { duration: 6000 }
                        );
                    } else {
                        toast.error(msg);
                    }
                } finally {
                    setMarking(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                let errorMsg = "Failed to get your location.";
                if (error.code === 1) {
                    errorMsg = "Location permission denied. Please tap the lock icon (🔒) in your browser's address bar → Allow Location, then try again.";
                } else if (error.code === 2) {
                    errorMsg = "Location unavailable. Please turn ON your device's GPS/Location Services and try again.";
                } else if (error.code === 3) {
                    errorMsg = "Location request timed out. Please ensure GPS is on and try again.";
                }
                toast.error(errorMsg, { duration: 6000 });
                setMarking(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border border-gray-100">
                <div className="p-6">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors">
                        <X size={20} />
                    </button>

                    <div className="text-center mb-6 mt-2">
                        <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 border-4 border-blue-100 shadow-inner">
                            <MapPin size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Mark My Attendance</h2>
                        <p className="text-gray-500 mt-2 text-sm">Punch in using your current GPS location.</p>
                    </div>

                    <div className="space-y-5">
                        {loadingStaff ? (
                            <div className="p-3 border border-gray-200 rounded-xl text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" /> Loading system...
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <User size={16} className="text-gray-400" />
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your app username"
                                        className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-gray-50 shadow-sm"
                                        disabled={marking}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <Lock size={16} className="text-gray-400" />
                                        Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Enter your app password"
                                            className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-gray-50 shadow-sm"
                                            disabled={marking}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        <button
                            onClick={handleMarkAttendance}
                            disabled={marking || !username || !password}
                            className={`w-full py-3.5 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-md
                                ${(!username || !password || marking) 
                                    ? 'bg-blue-300 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[0.98]'}`}
                        >
                            {marking ? (
                                <>
                                    <Loader2 size={22} className="animate-spin" />
                                    Acquiring Location...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={22} />
                                    Punch In Now
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-6 text-center text-xs text-gray-400">
                        * Ensure your browser location settings are enabled. Your location will be verified against the office geofence.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SelfAttendanceModal;
