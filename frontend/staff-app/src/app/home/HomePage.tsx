import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import { locationService, GeoPosition } from '@/services/location.service';
import api from '@/services/api.service';
import {
  getTodayString,
  getCurrentYearMonth,
  formatTime12h,
  relativeDayLabel,
  getLastDayOfMonth,
  statusLabel,
} from '@/utils/date';

interface TodayStatus {
  marked: boolean;
  status?: string;
  inTime?: string;
}

interface OfficeLocation {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

type Phase = 'idle' | 'loading' | 'done' | 'marked';

const HomePage = () => {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState<TodayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');

  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [locState, setLocState] = useState<'checking' | 'ok' | 'far' | 'denied' | 'prompt' | 'off' | 'info'>('checking');
  const [locMsg, setLocMsg] = useState('');

  const [month, setMonth] = useState<Record<string, any>>({});
  const [failMsg, setFailMsg] = useState('');

  const yearMonth = getCurrentYearMonth();

  // ── Init: today status + office settings ──
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      try {
        const [statusRes, settingsRes] = await Promise.all([
          attendanceService.checkToday(user.staffId, getTodayString()),
          api.get('/settings').catch(() => ({ data: { latitude: 0, longitude: 0, radiusMeters: 500 } })),
        ]);
        setTodayStatus(statusRes);
        if (statusRes.marked) setPhase('marked');
        const lat = Number(settingsRes.data.latitude) || 0;
        const lng = Number(settingsRes.data.longitude) || 0;
        const rad = Number(settingsRes.data.radiusMeters) || 500;
        setOffice({ latitude: lat, longitude: lng, radiusMeters: rad });
        // If the office point is not configured (0,0), we can't enforce a geofence.
        setGeofenceEnabled(lat !== 0 || lng !== 0);
      } catch (e) {
        console.error('Init error', e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  // ── This month attendance (stats + activity) ──
  useEffect(() => {
    const fetchMonth = async () => {
      if (!user) return;
      try {
        const data = await attendanceService.getMyAttendance(user.staffId, yearMonth);
        const map: Record<string, any> = {};
        if (data && typeof data === 'object') {
          Object.entries(data).forEach(([day, val]: [string, any]) => {
            if (val && typeof val === 'object') map[day] = val;
          });
        }
        setMonth(map);
      } catch (e) {
        console.error('Month error', e);
      }
    };
    fetchMonth();
  }, [user, yearMonth]);

  // ── Location ──
  const refreshLocation = useCallback(async () => {
    setLocState('checking');
    setLocMsg('Verifying your location…');

    if (!geofenceEnabled) {
      // Office point not configured: can't enforce a geofence. Still try to read a position.
      const res = await locationService.ensureLocation();
      if (res.status === 'granted' && res.position) setPosition(res.position);
      setLocState('info');
      setLocMsg('Office location not set — marking without geofence.');
      return;
    }

    const res = await locationService.ensureLocation();
    if (res.status === 'granted' && res.position && office) {
      setPosition(res.position);
      const { getDistanceMeters } = await import('@/utils/geofence');
      const dist = Math.round(getDistanceMeters(res.position.latitude, res.position.longitude, office.latitude, office.longitude));
      setDistance(dist);
      if (dist <= office.radiusMeters || window.location.hostname === 'localhost') {
        setLocState('ok');
        setLocMsg(window.location.hostname === 'localhost' ? 'Local testing: Geofence bypassed' : 'Within office premises');
      } else {
        setLocState('far');
        setLocMsg(`You're ${dist}m from the office (limit ${office.radiusMeters}m).`);
      }
    } else if (res.status === 'prompt') {
      setLocState('prompt');
      setLocMsg('Location permission is required to mark attendance.');
    } else if (res.status === 'denied') {
      setLocState('denied');
      setLocMsg('Location permission denied. Allow access to mark attendance.');
    } else if (res.status === 'off') {
      setLocState('off');
      setLocMsg('Device location is turned off. Turn it on to mark attendance.');
    } else {
      setLocState('denied');
      setLocMsg('Could not access your location. Please try again.');
    }
  }, [office, geofenceEnabled]);

  useEffect(() => {
    refreshLocation();
     
  }, [office, geofenceEnabled]);

  const withinRange = geofenceEnabled ? locState === 'ok' : locState === 'info';

  const handleCheckIn = async () => {
    if (!user || !withinRange || phase === 'loading' || phase === 'marked') return;
    setPhase('loading');
    setFailMsg('');
    const lat = position?.latitude ?? 0;
    const lng = position?.longitude ?? 0;
    try {
      const res = await attendanceService.selfMark(user.staffId, getTodayString(), lat, lng);
      if (res.alreadyMarked || res.success) {
        setTodayStatus({ marked: true, status: res.status || 'PRESENT', inTime: res.inTime });
        setPhase('done');
        setTimeout(() => setPhase('marked'), 1300);
        // refresh month data so stats update
        const data = await attendanceService.getMyAttendance(user.staffId, yearMonth);
        const map: Record<string, any> = {};
        Object.entries(data).forEach(([day, val]: [string, any]) => {
          if (val && typeof val === 'object') map[day] = val;
        });
        setMonth(map);
      } else {
        setPhase('idle');
        setFailMsg(res.message || 'Could not mark attendance.');
      }
    } catch (err: any) {
      setPhase('idle');
      const msg = err?.response?.data;
      setFailMsg(msg?.message || 'Could not mark attendance.');
    }
  };

  // ── Derived stats ──
  const entries = Object.entries(month);
  const presentCount = entries.filter(([, v]) => ['PRESENT', 'FULL_DAY', 'PERMISSION'].includes(v.status)).length;
  const leaveCount = entries.filter(([, v]) => ['LEAVE', 'SICK_LEAVE'].includes(v.status)).length;
  const absentCount = entries.filter(([, v]) => v.status === 'ABSENT').length;

  const activity = entries
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => Number(b.day) - Number(a.day))
    .slice(0, 6);

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/,?\s*\d{4}/, '');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div className="spinner dark" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  const marked = todayStatus?.marked || phase === 'marked';

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="t-page-title" style={{ fontSize: 26 }}>
          {greeting} <span role="img" aria-label="wave">👋</span>
        </h1>
        <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{user?.name}</p>
        <p className="t-muted" style={{ fontSize: 14, marginTop: 2 }}>{dateLabel}</p>
      </div>

      {/* Today's Status (always visible) */}
      <div className="card">
        <div className="status-hero">
          <div className={`status-icon ${marked ? 'is-pop' : 'is-pending'}`}>
            <ion-icon name={marked ? 'checkmark' : 'time-outline'} style={{ fontSize: 24 }} />
          </div>
          <div>
            <div className="status-title">{marked ? 'Present' : 'Not checked in'}</div>
            <div className="status-sub">
              {marked ? (todayStatus?.inTime ? formatTime12h(todayStatus.inTime) : 'On time') : 'Tap below to mark attendance'}
            </div>
          </div>
        </div>
      </div>

      {/* Check-in button — only when not marked */}
      {!marked && (
        <>
          <div className={`loc-note ${locState === 'ok' ? 'ok' : locState === 'far' || locState === 'denied' || locState === 'off' ? 'err' : locState === 'prompt' ? 'warn' : ''}`} style={{ marginTop: 16 }}>
            <ion-icon
              name={locState === 'ok' ? 'location' : locState === 'far' || locState === 'denied' || locState === 'off' ? 'location-outline' : 'locate-outline'}
              style={{ fontSize: 18 }}
            />
            <span>{locMsg}</span>
          </div>

          {failMsg && (
            <div className="loc-note err shake" style={{ marginBottom: 0 }}>
              <ion-icon name="alert-circle-outline" style={{ fontSize: 18 }} />
              <span>{failMsg}</span>
            </div>
          )}

          {(locState === 'prompt' || locState === 'denied' || locState === 'off') ? (
            <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={refreshLocation}>
              <ion-icon name="location-outline" style={{ fontSize: 18 }} />
              Enable Location
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              disabled={!withinRange || phase === 'loading'}
              onClick={handleCheckIn}
            >
              {phase === 'loading' && <span className="spinner" />}
              {phase === 'loading' ? 'Checking in…' : phase === 'done' ? <><ion-icon name="checkmark" className="pop" style={{ fontSize: 18 }} /> Checked In</> : <><ion-icon name="checkmark-circle-outline" style={{ fontSize: 18 }} /> Tap to Check In</>}
            </button>
          )}
        </>
      )}

      {/* This Month */}
      <div className="section-head">This Month</div>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-num">{presentCount}</div>
          <div className="stat-label">Present Days</div>
        </div>
        <div className="stat">
          <div className="stat-num">{leaveCount}</div>
          <div className="stat-label">Leave</div>
        </div>
        <div className="stat">
          <div className="stat-num">{absentCount}</div>
          <div className="stat-label">Absent</div>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="section-head">Quick Summary</div>
      <div className="group">
        <div className="row">
          <span className="row-label">Working Hours</span>
          <span className="row-value">9h</span>
        </div>
        <div className="row">
          <span className="row-label">Present</span>
          <span className="row-value">{presentCount}</span>
        </div>
        <div className="row">
          <span className="row-label">Leaves</span>
          <span className="row-value">{leaveCount}</span>
        </div>
        <div className="row">
          <span className="row-label">Next Salary</span>
          <span className="row-value">{getLastDayOfMonth(new Date())}</span>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="section-head">Recent Activity</div>
      {activity.length === 0 ? (
        <div className="card t-muted" style={{ textAlign: 'center', fontSize: 14 }}>
          No activity yet
        </div>
      ) : (
        <div className="timeline">
          {activity.map((item) => {
            const isPresent = ['PRESENT', 'FULL_DAY', 'PERMISSION'].includes(item.status);
            const isLeave = ['LEAVE', 'SICK_LEAVE'].includes(item.status);
            const dotClass = isPresent ? '' : isLeave ? 'is-leave' : 'is-absent';
            const title = isPresent
              ? `✓ ${relativeDayLabel(`${yearMonth}-${String(item.day).padStart(2, '0')}`)}`
              : `${statusLabel(item.status)} · ${relativeDayLabel(`${yearMonth}-${String(item.day).padStart(2, '0')}`)}`;
            const time = isPresent ? formatTime12h(item.in) : '';
            return (
              <div className="timeline-item" key={item.day}>
                <div className={`timeline-dot ${dotClass}`}>
                  <ion-icon name={isPresent ? 'checkmark' : isLeave ? 'calendar' : 'close'} style={{ fontSize: 15 }} />
                </div>
                <div className="timeline-body">
                  <span className="timeline-title">{title}</span>
                  {time && <span className="timeline-time">{time}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HomePage;
