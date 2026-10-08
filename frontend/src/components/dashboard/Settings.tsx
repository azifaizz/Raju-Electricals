import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Save, Trash2, Loader2, MapPin, Navigation } from 'lucide-react';
import { confirmAction } from '@/lib/confirm';
import { clearAllCaches } from '@/lib/clearCache';
import { staffService } from '@/lib/api';

const Settings = () => {
  const [shopName, setShopName] = useLocalStorage("shopName_flipflex", "Raju Electricals");
  const [gstNumberRaw] = useLocalStorage('gstNumber_v3', '33JPNPK3337F1ZR');
  const gstNumber =
    !gstNumberRaw || gstNumberRaw === 'YOUR_GST_NUMBER_HERE'
      ? '33JPNPK3337F1ZR'
      : gstNumberRaw.toString().trim();

  const [billMessage, setBillMessage] = useLocalStorage('billMessage', 'Thank You For Your Purchasing');
  const [defaultGst, setDefaultGst] = useLocalStorage('defaultGst', '');
  const [clearing, setClearing] = useState(false);

  // App Location State
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('500');
  const [halfDayCutoffTime, setHalfDayCutoffTime] = useState('10:30');
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationSaving, setLocationSaving] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  useEffect(() => {
    fetchAppSettings();
  }, []);

  const fetchAppSettings = async () => {
    try {
      const res = await staffService.get('/staff/settings');
      const data = res.data;
      setLocationName(data.locationName || '');
      setLatitude(data.latitude?.toString() || '');
      setLongitude(data.longitude?.toString() || '');
      setRadiusMeters(data.radiusMeters?.toString() || '500');
      setHalfDayCutoffTime(data.halfDayCutoffTime || '10:30');
    } catch (e) {
      console.warn('Failed to load app settings', e);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    setLocationSaving(true);
    try {
      await staffService.post('/staff/settings', {
        id: 'default_location',
        locationName,
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
        radiusMeters: parseInt(radiusMeters) || 500,
        halfDayCutoffTime: halfDayCutoffTime || '10:30',
      });
      toast.success('Location settings saved!');
    } catch (e) {
      toast.error('Failed to save location settings');
    } finally {
      setLocationSaving(false);
    }
  };

  const handleGetMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setFetchingLocation(false);
        toast.success('Location fetched successfully!');
      },
      (error) => {
        setFetchingLocation(false);
        toast.error('Failed to get location. Please enable location services.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = () => {
    toast.success("Settings Saved!");
  };

  const handleClearCache = async () => {
    const confirmed = await confirmAction({
      title: 'Clear All Cached Data',
      message: 'This will delete ALL locally stored cached data including IndexedDB, localStorage, sessionStorage, and in-memory cache. The app will re-fetch everything fresh from the database. This action cannot be undone.',
      confirmText: 'Yes, Clear Everything',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!confirmed) return;

    setClearing(true);
    toast.loading('Clearing all cached data...', { id: 'clear-cache' });

    try {
      await clearAllCaches();
      toast.success('All caches cleared! Reloading...', { id: 'clear-cache' });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      console.error('Failed to clear caches:', err);
      toast.error('Failed to clear caches. Please try again.', { id: 'clear-cache' });
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Settings</h1>

      {/* General Settings */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-bold text-gray-700 mb-4">General</h2>
        <div className="space-y-4 max-w-lg">
          <div>
            <label htmlFor="shopName" className="font-medium text-gray-700">Shop Name</label>
            <input
              id="shopName"
              type="text"
              value={shopName}
              readOnly
              className="form-input mt-1 bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="gstNumber" className="font-medium text-gray-700">GST Number</label>
            <input
              id="gstNumber"
              type="text"
              value={gstNumber}
              readOnly
              className="form-input mt-1 bg-gray-100 cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="billMessage" className="font-medium text-gray-700">Custom Bill Message</label>
            <input
              id="billMessage"
              type="text"
              value={billMessage}
              onChange={e => setBillMessage(e.target.value)}
              className="form-input mt-1"
            />
          </div>

          <div>
            <label htmlFor="defaultGst" className="font-medium text-gray-700">Default GST Percentage (%)</label>
            <input
              id="defaultGst"
              type="number"
              value={defaultGst}
              onChange={e => setDefaultGst(e.target.value)}
              className="form-input mt-1"
            />
          </div>

          <div className="pt-2">
            <button onClick={handleSave} className="px-6 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 flex items-center gap-2">
              <Save size={18} /> Save Settings
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Location Settings */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-blue-100">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="text-blue-600" size={22} />
          <h2 className="text-lg font-bold text-gray-700">Attendance Location (Geofence)</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Set the default office location for staff attendance. Staff must be within this radius to mark attendance from the mobile app.
        </p>

        {locationLoading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 size={18} className="animate-spin" /> Loading location settings...
          </div>
        ) : (
          <div className="space-y-4 max-w-lg">
            <div>
              <label className="font-medium text-gray-700">Location Name</label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="e.g. Main Office"
                className="form-input mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-medium text-gray-700">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  placeholder="e.g. 12.9716"
                  className="form-input mt-1"
                />
              </div>
              <div>
                <label className="font-medium text-gray-700">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  placeholder="e.g. 77.5946"
                  className="form-input mt-1"
                />
              </div>
            </div>

            <div>
              <label className="font-medium text-gray-700">Radius (meters)</label>
              <input
                type="number"
                value={radiusMeters}
                onChange={e => setRadiusMeters(e.target.value)}
                placeholder="500"
                className="form-input mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">Default: 500 meters. Staff must be within this distance to mark attendance.</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Late Punch-In Cutoff Time (Half Day)</label>
              <input
                type="time"
                value={halfDayCutoffTime}
                onChange={e => setHalfDayCutoffTime(e.target.value)}
                className="form-input mt-1"
              />
              <p className="text-xs text-gray-400 mt-1">If a staff member punches in after this time, they will automatically be marked as Half Day instead of Present.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleGetMyLocation}
                disabled={fetchingLocation}
                className="px-5 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50"
              >
                {fetchingLocation ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Navigation size={16} />
                )}
                {fetchingLocation ? 'Fetching...' : 'Get Current Location'}
              </button>

              <button
                onClick={handleSaveLocation}
                disabled={locationSaving}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {locationSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {locationSaving ? 'Saving...' : 'Save Location'}
              </button>
            </div>

            {latitude && longitude && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm">
                <span className="font-medium text-blue-700">Current Setting:</span>{' '}
                <span className="text-blue-600">
                  {locationName || 'Unnamed'} — {latitude}, {longitude} (Radius: {radiusMeters}m)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Danger Zone - Clear All Cached Data */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-red-200">
        <h2 className="text-lg font-bold text-red-600 mb-2">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Clearing cached data will remove all locally stored data (IndexedDB, localStorage, sessionStorage).
          The app will re-fetch everything fresh from the database after reload.
        </p>
        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {clearing ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Clearing...
            </>
          ) : (
            <>
              <Trash2 size={18} /> Clear All Cached Data
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;
