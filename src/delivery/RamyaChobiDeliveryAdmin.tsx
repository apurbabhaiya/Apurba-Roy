import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Settings2,
  ShieldCheck,
  WalletCards,
  XCircle,
} from 'lucide-react';
import {
  DeliveryAdminDashboard,
  DeliveryAdminPortal,
  activateFinalDelivery,
  createDeliveryPortalFromBooking,
  deliveryAdminLogin,
  deliveryAdminLogout,
  getDeliveryAdminDashboard,
  reviewDeliveryPayment,
  updateDeliverySettings,
} from '../services/deliveryPortalService';

const ADMIN_TOKEN_KEY = 'ramya_booking_admin_token_v1';

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function fmt(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadStoredToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function saveStoredToken(token: string) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

function StatusPill({ value }: { value: string }) {
  const positive = ['FULLY_PAID', 'ACTIVE', 'TEMPORARILY_ACTIVE', 'FINAL_DELIVERED', 'VERIFIED', 'ENABLED'].includes(value);
  const warning = ['SUBMITTED', 'READY', 'PREVIEW', 'PENDING'].includes(value);
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${
      positive
        ? 'bg-emerald-100 text-emerald-800'
        : warning
          ? 'bg-amber-100 text-amber-800'
          : 'bg-stone-200 text-stone-700'
    }`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}

export default function RamyaChobiDeliveryAdmin() {
  const [token, setToken] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [dashboard, setDashboard] = useState<DeliveryAdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedBooking, setSelectedBooking] = useState('');
  const [newBkash, setNewBkash] = useState('');
  const [newRetention, setNewRetention] = useState('');
  const [editingPortal, setEditingPortal] = useState<DeliveryAdminPortal | null>(null);
  const [settingsBkash, setSettingsBkash] = useState('');
  const [settingsRetention, setSettingsRetention] = useState('');

  async function load(useToken?: string) {
    const activeToken = useToken || token;
    if (!activeToken) {
      setReady(true);
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      const data = await getDeliveryAdminDashboard(activeToken);
      setDashboard(data);
    } catch (error: any) {
      const message = error?.message || 'Could not load delivery admin data.';
      setNotice(message);
      if (/session expired|invalid admin/i.test(message)) {
        saveStoredToken('');
        setToken('');
        setDashboard(null);
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }

  useEffect(() => {
    const stored = loadStoredToken();
    if (stored) {
      setToken(stored);
      void load(stored);
    } else {
      setReady(true);
    }
  }, []);

  const portals = dashboard?.portals || [];
  const submissions = dashboard?.submissions || [];
  const bookings = dashboard?.bookings || [];
  const availableBookings = bookings.filter((b) => !b.has_portal);
  const pendingRequests = submissions.filter((s) => s.status === 'SUBMITTED');

  const counts = useMemo(() => {
    return {
      portals: portals.length,
      paymentPending: portals.filter((p) => p.payment_status !== 'FULLY_PAID').length,
      finalActive: portals.filter((p) => p.delivery_status === 'FINAL_DELIVERED' && p.gallery_status === 'ACTIVE').length,
      locked: portals.filter((p) => p.gallery_status === 'LOCKED').length,
      requests: pendingRequests.length,
    };
  }, [portals, pendingRequests]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!accessCode.trim()) return;
    setLoading(true);
    setNotice('');
    try {
      const result = await deliveryAdminLogin(accessCode.trim());
      saveStoredToken(result.token);
      setToken(result.token);
      setAccessCode('');
      await load(result.token);
    } catch (error: any) {
      setNotice(error?.message || 'Invalid admin access code.');
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      if (token) await deliveryAdminLogout(token);
    } catch {}
    saveStoredToken('');
    setToken('');
    setDashboard(null);
    setNotice('');
  }

  async function createPortal() {
    if (!selectedBooking) {
      setNotice('Select a booking first.');
      return;
    }
    setLoading(true);
    setNotice('');
    try {
      const result = await createDeliveryPortalFromBooking({
        token,
        bookingId: selectedBooking,
        bkashNumber: newBkash.trim() || null,
        storageRetentionUntil: newRetention ? new Date(newRetention).toISOString() : null,
      });
      setNotice(`Delivery portal created for ${result.client_name}.`);
      setSelectedBooking('');
      setNewBkash('');
      setNewRetention('');
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'Could not create delivery portal.');
    } finally {
      setLoading(false);
    }
  }

  async function review(submissionId: string, decision: 'VERIFY' | 'REJECT') {
    setLoading(true);
    setNotice('');
    try {
      await reviewDeliveryPayment({ token, submissionId, decision });
      setNotice(decision === 'VERIFY' ? 'Payment verified.' : 'Payment rejected.');
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'Could not review payment.');
    } finally {
      setLoading(false);
    }
  }

  async function activate(portalId: string) {
    setLoading(true);
    setNotice('');
    try {
      await activateFinalDelivery({ token, portalId });
      setNotice('Final Delivery activated. The 30-day complimentary access period has started.');
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'Could not activate Final Delivery.');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(portal: DeliveryAdminPortal) {
    setEditingPortal(portal);
    setSettingsBkash(portal.bkash_number || '');
    setSettingsRetention(toDateTimeLocal(portal.storage_retention_until));
  }

  async function saveSettings() {
    if (!editingPortal) return;
    setLoading(true);
    setNotice('');
    try {
      await updateDeliverySettings({
        token,
        portalId: editingPortal.id,
        bkashNumber: settingsBkash.trim() || null,
        storageRetentionUntil: settingsRetention ? new Date(settingsRetention).toISOString() : null,
      });
      setNotice('Delivery settings updated.');
      setEditingPortal(null);
      await load();
    } catch (error: any) {
      setNotice(error?.message || 'Could not update delivery settings.');
    } finally {
      setLoading(false);
    }
  }

  function copyLink(portal: DeliveryAdminPortal) {
    const link = `${window.location.origin}/delivery/${portal.secure_token}`;
    navigator.clipboard?.writeText(link);
    setNotice('Private client link copied.');
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      </div>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-stone-950 px-5 py-12 text-white flex items-center justify-center">
        <form onSubmit={signIn} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-300 text-stone-950">
            <KeyRound className="h-6 w-6" />
          </div>
          <div className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">RamyaChobi</div>
          <h1 className="mt-2 text-3xl font-semibold">Delivery Admin</h1>
          <p className="mt-2 text-sm leading-6 text-white/55">Use the same admin access code as the booking admin system.</p>
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Admin access code"
            className="mt-6 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 outline-none placeholder:text-white/30 focus:border-amber-300"
          />
          <button disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 font-bold text-stone-950 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Sign in
          </button>
          {notice && <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-200">{notice}</div>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-stone-900">
      <header className="bg-stone-950 px-5 py-6 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">RamyaChobi</div>
            <h1 className="mt-1 text-2xl font-semibold">Client Delivery Admin</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={signOut} className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-stone-950">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-8">
        {notice && (
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-sm font-medium shadow-sm">{notice}</div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [Link2, 'Delivery portals', counts.portals],
            [WalletCards, 'Payment pending', counts.paymentPending],
            [CheckCircle2, 'Final active', counts.finalActive],
            [LockKeyhole, 'Locked', counts.locked],
            [Clipboard, 'Review requests', counts.requests],
          ].map(([Icon, label, value]: any) => (
            <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
              <Icon className="h-5 w-5 text-amber-700" />
              <div className="mt-3 text-2xl font-semibold">{value}</div>
              <div className="text-sm text-stone-500">{label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <FileCheck2 className="mt-1 h-6 w-6 text-amber-700" />
            <div>
              <h2 className="text-xl font-semibold">Create delivery from booking</h2>
              <p className="mt-1 text-sm text-stone-500">Select an existing booking. Package amount and verified payments are copied into the private delivery portal.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <select value={selectedBooking} onChange={(e) => setSelectedBooking(e.target.value)} className="rounded-xl border border-stone-300 px-3.5 py-3 lg:col-span-2">
              <option value="">Select booking</option>
              {availableBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.reference_no} · {b.client_name} · Due {money(Number(b.package_total) - Number(b.advance_paid) - Number(b.additional_paid))}
                </option>
              ))}
            </select>
            <input value={newBkash} onChange={(e) => setNewBkash(e.target.value)} placeholder="bKash number" className="rounded-xl border border-stone-300 px-3.5 py-3" />
            <input type="datetime-local" value={newRetention} onChange={(e) => setNewRetention(e.target.value)} className="rounded-xl border border-stone-300 px-3.5 py-3" title="Storage retention end date" />
          </div>
          <button onClick={createPortal} disabled={loading || !selectedBooking} className="mt-4 rounded-xl bg-stone-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">
            Create Private Delivery Link
          </button>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Payment verification</h2>
              <p className="mt-1 text-sm text-stone-500">Package and access-fee submissions stay locked until you verify them.</p>
            </div>
            <StatusPill value={`${pendingRequests.length} SUBMITTED`} />
          </div>
          <div className="mt-5 space-y-3">
            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl bg-stone-50 p-5 text-sm text-stone-500">No payments are waiting for review.</div>
            ) : pendingRequests.map((s) => (
              <div key={s.id} className="grid gap-4 rounded-2xl border border-stone-200 p-4 lg:grid-cols-[1.2fr_.8fr_.7fr_auto] lg:items-center">
                <div>
                  <div className="font-semibold">{s.client_name || 'Client'}</div>
                  <div className="mt-1 text-sm text-stone-500">{s.event_name || 'Delivery'} · {s.payment_type}</div>
                </div>
                <div className="text-sm">
                  <div><span className="text-stone-500">bKash:</span> {s.payer_phone}</div>
                  <div><span className="text-stone-500">TrxID:</span> {s.transaction_id}</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{money(s.amount)}</div>
                  {s.selected_days ? <div className="text-xs text-stone-500">{s.selected_days} access day(s)</div> : null}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => review(s.id, 'VERIFY')} disabled={loading} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white">
                    <BadgeCheck className="h-4 w-4" /> Verify
                  </button>
                  <button onClick={() => review(s.id, 'REJECT')} disabled={loading} className="inline-flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Client delivery portals</h2>
          <div className="mt-5 space-y-4">
            {portals.map((portal) => {
              const canActivate = portal.payment_status === 'FULLY_PAID' && portal.delivery_status !== 'FINAL_DELIVERED';
              return (
                <div key={portal.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{portal.client_name}</div>
                      <div className="mt-1 text-sm text-stone-500">{portal.event_name || 'Event'} · {portal.package_name || 'Package'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill value={portal.payment_status} />
                        <StatusPill value={portal.delivery_status} />
                        <StatusPill value={portal.gallery_status} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-stone-400">Remaining due</div>
                      <div className="mt-1 text-xl font-semibold">{money(portal.remaining_due)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Final Delivery</span><strong>{fmt(portal.final_delivery_at)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Free access ends</span><strong>{fmt(portal.free_access_expires_at)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Temporary access</span><strong>{fmt(portal.access_expires_at)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Storage retention</span><strong>{fmt(portal.storage_retention_until)}</strong></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => copyLink(portal)} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-3.5 py-2 text-sm font-bold text-white">
                      <Copy className="h-4 w-4" /> Copy Client Link
                    </button>
                    <a href={`/delivery/${portal.secure_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3.5 py-2 text-sm font-bold">
                      <ExternalLink className="h-4 w-4" /> Open
                    </a>
                    {canActivate && (
                      <button onClick={() => activate(portal.id)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white">
                        <CheckCircle2 className="h-4 w-4" /> Activate Final Delivery
                      </button>
                    )}
                    <button onClick={() => startEdit(portal)} className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-sm font-bold text-amber-800">
                      <Settings2 className="h-4 w-4" /> Delivery Settings
                    </button>
                  </div>

                  {editingPortal?.id === portal.id && (
                    <div className="mt-4 grid gap-3 rounded-2xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                      <input value={settingsBkash} onChange={(e) => setSettingsBkash(e.target.value)} placeholder="bKash number" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                      <input type="datetime-local" value={settingsRetention} onChange={(e) => setSettingsRetention(e.target.value)} className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                      <div className="flex gap-2">
                        <button onClick={saveSettings} disabled={loading} className="rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white">Save</button>
                        <button onClick={() => setEditingPortal(null)} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-amber-700" />
            <h2 className="text-xl font-semibold">Recent delivery audit</h2>
          </div>
          <div className="mt-4 space-y-2">
            {(dashboard?.audit_logs || []).slice(0, 20).map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-3 text-sm">
                <div>
                  <div className="font-semibold">{log.action.replaceAll('_', ' ')}</div>
                  <div className="text-xs text-stone-500">{log.portal_id || 'System action'}</div>
                </div>
                <div className="text-stone-500">{fmt(log.created_at)}</div>
              </div>
            ))}
            {(dashboard?.audit_logs || []).length === 0 && (
              <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">Audit log entries will appear after admin actions.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
