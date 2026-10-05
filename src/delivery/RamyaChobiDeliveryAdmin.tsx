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
  Images,
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
  DeliveryAdminFile,
  listDeliveryFiles,
  upsertDeliveryFile,
  deleteDeliveryFile,
  syncDeliveryFolder,
  validateAndSaveDeliveryFile,
  updateDeliveryPortal,
  listDeliveryPayments,
  addDeliveryPayment,
  updateDeliveryPayment,
  deleteDeliveryPayment,
  restoreDeliveryAccess,
  DeliveryPaymentLedger,
} from '../services/deliveryPortalService';
import PortfolioManager from '../components/PortfolioManager';

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
  const [newBkash, setNewBkash] = useState('01776044951');
  const [newRetention, setNewRetention] = useState('');
  const [editingPortal, setEditingPortal] = useState<DeliveryAdminPortal | null>(null);
  const [settingsBkash, setSettingsBkash] = useState('');
  const [settingsRetention, setSettingsRetention] = useState('');
  const [filesByPortal, setFilesByPortal] = useState<Record<string, DeliveryAdminFile[]>>({});
  const [fileDrafts, setFileDrafts] = useState<Record<string, { url: string; fileName: string; title: string; type: 'PHOTO' | 'VIDEO' | 'FOLDER'; sortOrder: string }>>({});
  const [fileMetaByPortal, setFileMetaByPortal] = useState<Record<string, { name?: string; mimeType?: string; size?: string | null }>>({});
  const [ledgerByPortal, setLedgerByPortal] = useState<Record<string, DeliveryPaymentLedger[]>>({});
  const [portalSearch, setPortalSearch] = useState('');
  const [selectedPortalId, setSelectedPortalId] = useState('');
  const [portalEdit, setPortalEdit] = useState<Record<string, any>>({});
  const [ledgerDrafts, setLedgerDrafts] = useState<Record<string, { date: string; method: DeliveryPaymentLedger['payment_method']; amount: string; transactionId: string; note: string; status: DeliveryPaymentLedger['status'] }>>({});

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
      const fileEntries = await Promise.all((data.portals || []).map(async (portal: DeliveryAdminPortal) => {
        try { return [portal.id, await listDeliveryFiles({ token: activeToken, portalId: portal.id })] as const; }
        catch { return [portal.id, []] as const; }
      }));
      setFilesByPortal(Object.fromEntries(fileEntries));
      const ledgerEntries = await Promise.all((data.portals || []).map(async (portal: DeliveryAdminPortal) => {
        try { return [portal.id, await listDeliveryPayments({ token: activeToken, portalId: portal.id })] as const; }
        catch { return [portal.id, []] as const; }
      }));
      setLedgerByPortal(Object.fromEntries(ledgerEntries));
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
  const filteredPortals = portals.filter((portal) => {
    const query = portalSearch.trim().toLowerCase();
    if (!query) return true;
    return [portal.client_name, portal.event_name, portal.client_phone, portal.whatsapp_number]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
  });

  const counts = useMemo(() => {
    return {
      portals: portals.length,
      paymentPending: portals.filter((p) => p.payment_status !== 'FULLY_PAID').length,
      finalActive: portals.filter((p) => p.delivery_status === 'FINAL_DELIVERED' && p.gallery_status === 'ACTIVE').length,
      locked: portals.filter((p) => p.gallery_status === 'LOCKED').length,
      requests: pendingRequests.length,
    };
  }, [portals, pendingRequests]);

  function startPortalEdit(portal: DeliveryAdminPortal) {
    setSelectedPortalId(portal.id);
    setPortalEdit({
      clientName: portal.client_name || '',
      clientPhone: portal.client_phone || '',
      whatsappNumber: portal.whatsapp_number || portal.client_phone || '',
      eventName: portal.event_name || '',
      packagePrice: String(portal.package_price || ''),
      finalDeliveryAt: toDateTimeLocal(portal.final_delivery_at),
      accessExpiryAt: toDateTimeLocal(portal.free_access_expires_at || portal.access_expires_at),
      freeAccessDays: String(portal.free_access_days ?? 30),
      gracePeriodDays: String(portal.grace_period_days ?? 0),
      dailyLateFee: String(portal.daily_late_fee ?? 10),
      lateFeeEnabled: portal.late_fee_enabled !== false,
      lateFeeWaived: portal.late_fee_waived === true,
      lateFeeOverride: portal.late_fee_override == null ? '' : String(portal.late_fee_override),
      clientMessage: portal.client_message || '',
      clientNote: portal.client_note || '',
      internalAdminNote: portal.internal_admin_note || '',
    });
  }

  function updatePortalEdit(patch: Record<string, unknown>) {
    setPortalEdit((current) => ({ ...current, ...patch }));
  }

  async function savePortalEdit() {
    if (!selectedPortalId) return;
    setLoading(true); setNotice('');
    try {
      await updateDeliveryPortal({
        token, portalId: selectedPortalId,
        clientName: portalEdit.clientName || null,
        clientPhone: portalEdit.clientPhone || null,
        whatsappNumber: portalEdit.whatsappNumber || null,
        eventName: portalEdit.eventName || null,
        packagePrice: Number(portalEdit.packagePrice || 0),
        finalDeliveryAt: portalEdit.finalDeliveryAt ? new Date(portalEdit.finalDeliveryAt).toISOString() : null,
        accessExpiryAt: portalEdit.accessExpiryAt ? new Date(portalEdit.accessExpiryAt).toISOString() : null,
        freeAccessDays: Number(portalEdit.freeAccessDays || 30),
        gracePeriodDays: Number(portalEdit.gracePeriodDays || 0),
        dailyLateFee: Number(portalEdit.dailyLateFee || 0),
        lateFeeEnabled: Boolean(portalEdit.lateFeeEnabled),
        lateFeeWaived: Boolean(portalEdit.lateFeeWaived),
        lateFeeOverride: portalEdit.lateFeeOverride === '' ? null : Number(portalEdit.lateFeeOverride),
        clientMessage: portalEdit.clientMessage || null,
        clientNote: portalEdit.clientNote || null,
        internalAdminNote: portalEdit.internalAdminNote || null,
      });
      setNotice('Client portal details updated.');
      await load();
    } catch (error: any) { setNotice(error?.message || 'Could not update client portal.'); }
    finally { setLoading(false); }
  }

  function ledgerDraft(portalId: string) {
    return ledgerDrafts[portalId] || { date: new Date().toISOString().slice(0, 10), method: 'CASH' as const, amount: '', transactionId: '', note: '', status: 'VERIFIED' as const };
  }

  function updateLedgerDraft(portalId: string, patch: Partial<ReturnType<typeof ledgerDraft>>) {
    setLedgerDrafts((current) => ({ ...current, [portalId]: { ...ledgerDraft(portalId), ...patch } }));
  }

  async function saveLedgerPayment(portalId: string) {
    const draft = ledgerDraft(portalId);
    if (!Number(draft.amount)) { setNotice('Enter a payment amount first.'); return; }
    setLoading(true); setNotice('');
    try {
      await addDeliveryPayment({ token, portalId, paymentDate: draft.date, paymentMethod: draft.method, amount: Number(draft.amount), transactionId: draft.transactionId || null, note: draft.note || null, status: draft.status });
      setNotice('Payment ledger entry added.');
      await load();
    } catch (error: any) { setNotice(error?.message || 'Could not add payment.'); }
    finally { setLoading(false); }
  }

  async function setLedgerStatus(payment: DeliveryPaymentLedger, status: DeliveryPaymentLedger['status']) {
    setLoading(true); setNotice('');
    try {
      await updateDeliveryPayment({ token, paymentId: payment.id, status });
      setNotice(`Payment marked ${status.toLowerCase()}.`);
      await load();
    } catch (error: any) { setNotice(error?.message || 'Could not update payment.'); }
    finally { setLoading(false); }
  }

  async function removeLedgerPayment(paymentId: string) {
    if (!window.confirm('Delete this payment ledger entry?')) return;
    setLoading(true); setNotice('');
    try { await deleteDeliveryPayment({ token, paymentId }); setNotice('Payment entry deleted.'); await load(); }
    catch (error: any) { setNotice(error?.message || 'Could not delete payment.'); }
    finally { setLoading(false); }
  }

  async function restorePortal(portalId: string, waiveFee: boolean) {
    setLoading(true); setNotice('');
    try {
      await restoreDeliveryAccess({ token, portalId, restoreDays: 30, waiveFee });
      setNotice(waiveFee ? 'Late fee waived and access restored.' : 'Access restored after late fee review.');
      await load();
    } catch (error: any) { setNotice(error?.message || 'Could not restore access.'); }
    finally { setLoading(false); }
  }

  function portalWhatsapp(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '');
    const normalized = digits.startsWith('880') ? digits : digits.startsWith('0') ? `88${digits}` : `880${digits}`;
    const text = encodeURIComponent('আসসালামু আলাইকুম। আপনার RamyaChobi Final Delivery সম্পর্কে যোগাযোগ করছি। আপনার বাকি পেমেন্ট ও ফাইল ডাউনলোডের বিষয়ে বিস্তারিত জানাতে চাই।');
    return `https://wa.me/${normalized}?text=${text}`;
  }

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
      setNewBkash('01776044951');
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
    setSettingsBkash(portal.bkash_number || '01776044951');
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
  function updateFileDraft(portalId: string, patch: Partial<{ url: string; fileName: string; title: string; type: 'PHOTO' | 'VIDEO' | 'FOLDER'; sortOrder: string }>) {
    setFileDrafts((current) => ({
      ...current,
      [portalId]: { url: current[portalId]?.url || '', fileName: current[portalId]?.fileName || '', title: current[portalId]?.title || '', type: current[portalId]?.type || 'PHOTO', sortOrder: current[portalId]?.sortOrder || '', ...patch },
    }));
  }

  async function addFinalDeliveryFile(portalId: string) {
    const draft = fileDrafts[portalId] || { url: '', fileName: '', title: '', type: 'PHOTO' as const, sortOrder: '' };
    if (!draft.url.trim()) { setNotice('Paste a Google Drive file or folder link first.'); return; }
    setLoading(true); setNotice('Validating private Google Drive link...');
    try {
      if (draft.type === 'FOLDER') {
        const verified = await validateAndSaveDeliveryFile({ adminToken: token, portalId, sourceUrl: draft.url.trim(), fileType: 'FOLDER', persist: false });
        const result = await syncDeliveryFolder({ adminToken: token, portalId, folderUrl: draft.url.trim() });
        setFileMetaByPortal((current) => ({ ...current, [portalId]: { name: verified.metadata.name, mimeType: verified.metadata.mimeType, size: verified.metadata.size || null } }));
        setNotice(`Link verified: ${verified.metadata.name}. ${result.imported} file(s) imported from the private folder.`);
      } else {
        const verified = await validateAndSaveDeliveryFile({
          adminToken: token,
          portalId,
          sourceUrl: draft.url.trim(),
          fileType: draft.type,
          fileName: draft.fileName.trim() || null,
          title: draft.title.trim() || null,
          sortOrder: Number(draft.sortOrder || 0),
          persist: true,
        });
        setFileMetaByPortal((current) => ({ ...current, [portalId]: { name: verified.metadata.name, mimeType: verified.metadata.mimeType, size: verified.metadata.size || null } }));
        setNotice(`Link verified successfully: ${verified.metadata.name} (${verified.metadata.mimeType}). Private file connected.`);
      }
      const files = await listDeliveryFiles({ token, portalId });
      setFilesByPortal((current) => ({ ...current, [portalId]: files }));
      setFileDrafts((current) => ({ ...current, [portalId]: { url: '', fileName: '', title: '', type: draft.type, sortOrder: '' } }));
    } catch (error: any) { setNotice(error?.message || 'Google Drive link validation failed.'); }
    finally { setLoading(false); }
  }

  async function removeFinalDeliveryFile(portalId: string, fileId: string) {
    setLoading(true); setNotice('');
    try {
      await deleteDeliveryFile({ token, fileId });
      setFilesByPortal((current) => ({ ...current, [portalId]: (current[portalId] || []).filter((file) => file.id !== fileId) }));
      setNotice('Final Delivery file removed.');
    } catch (error: any) { setNotice(error?.message || 'Could not remove Final Delivery file.'); }
    finally { setLoading(false); }
  }


  async function editFinalDeliveryFile(portalId: string, file: DeliveryAdminFile) {
    const nextUrl = window.prompt('Google Drive file or folder link', file.source_url);
    if (!nextUrl?.trim()) return;
    const nextTitle = window.prompt('Display title (optional)', file.title || '') ?? (file.title || '');
    setLoading(true); setNotice('Validating replacement link...');
    try {
      if (file.file_type === 'FOLDER') {
        await validateAndSaveDeliveryFile({ adminToken: token, portalId, sourceUrl: nextUrl.trim(), fileType: 'FOLDER', persist: false });
        await upsertDeliveryFile({
          token, portalId, fileId: file.id, sourceUrl: nextUrl.trim(), fileType: file.file_type,
          title: nextTitle.trim() || null, fileName: file.file_name || null, mimeType: file.mime_type || null,
          sortOrder: file.sort_order || 0, isVisible: file.is_visible,
        });
      } else {
        await validateAndSaveDeliveryFile({
          adminToken: token, portalId, fileId: file.id, sourceUrl: nextUrl.trim(), fileType: file.file_type,
          title: nextTitle.trim() || null, fileName: file.file_name || null, sortOrder: file.sort_order || 0,
          isVisible: file.is_visible, persist: true,
        });
      }
      const files = await listDeliveryFiles({ token, portalId });
      setFilesByPortal((current) => ({ ...current, [portalId]: files }));
      setNotice('Replacement link verified and saved.');
    } catch (error: any) { setNotice(error?.message || 'Replacement Google Drive link failed validation.'); }
    finally { setLoading(false); }
  }

  async function toggleFinalDeliveryFile(portalId: string, file: DeliveryAdminFile) {
    setLoading(true); setNotice('');
    try {
      await upsertDeliveryFile({
        token, portalId, fileId: file.id, sourceUrl: file.source_url, fileType: file.file_type,
        title: file.title || null, fileName: file.file_name || null, mimeType: file.mime_type || null,
        sortOrder: file.sort_order || 0, isVisible: !file.is_visible,
      });
      const files = await listDeliveryFiles({ token, portalId });
      setFilesByPortal((current) => ({ ...current, [portalId]: files }));
      setNotice(file.is_visible ? 'File hidden from client.' : 'File shown to client.');
    } catch (error: any) { setNotice(error?.message || 'Could not change file visibility.'); }
    finally { setLoading(false); }
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
            <h1 className="mt-1 text-2xl font-semibold">RamyaChobi Admin Panel</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/photo-selection"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3.5 py-2 text-sm font-bold text-stone-950"
            >
              <Images className="h-4 w-4" /> Photo Selection
            </a>
            <a
              href="/booking/admin"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold"
            >
              <FileCheck2 className="h-4 w-4" /> Booking Admin
            </a>
            <a
              href="/delivery"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold"
            >
              <ExternalLink className="h-4 w-4" /> Delivery Demo
            </a>
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

        <section className="grid gap-4 md:grid-cols-3">
          <a href="/photo-selection" className="group rounded-3xl bg-stone-950 p-6 text-white shadow-sm transition hover:-translate-y-0.5">
            <Images className="h-8 w-8 text-amber-300" />
            <h2 className="mt-4 text-xl font-semibold">Photo Selection</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Open the existing Google Drive photo-selection admin and client gallery system.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-amber-300">
              Open Photo Selection <ExternalLink className="h-4 w-4" />
            </div>
          </a>

          <a href="/booking/admin" className="group rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
            <FileCheck2 className="h-8 w-8 text-amber-700" />
            <h2 className="mt-4 text-xl font-semibold">Booking Management</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Manage bookings, client details, payments, events and agreements.
            </p>
          </a>

          <a href="/delivery" target="_blank" rel="noreferrer" className="group rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
            <Link2 className="h-8 w-8 text-amber-700" />
            <h2 className="mt-4 text-xl font-semibold">Client Delivery</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Preview the RamyaChobi payment, Final Delivery and access-restoration landing page.
            </p>
          </a>
        </section>

        <PortfolioManager adminToken={token} />

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Client delivery portals</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input value={portalSearch} onChange={(e) => setPortalSearch(e.target.value)} placeholder="Search client, event or phone" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
              <span className="text-sm text-stone-500">{filteredPortals.length} of {portals.length}</span>
              <button type="button" onClick={() => {
                if (!filteredPortals.length) return;
                const current = filteredPortals.findIndex((p) => p.id === selectedPortalId);
                const next = filteredPortals[(current <= 0 ? filteredPortals.length : current) - 1];
                setSelectedPortalId(next.id);
                document.getElementById(`portal-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold">Previous</button>
              <button type="button" onClick={() => {
                if (!filteredPortals.length) return;
                const current = filteredPortals.findIndex((p) => p.id === selectedPortalId);
                const next = filteredPortals[(current + 1) % filteredPortals.length];
                setSelectedPortalId(next.id);
                document.getElementById(`portal-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold">Next</button>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {filteredPortals.map((portal) => {
              const canActivate = portal.payment_status === 'FULLY_PAID' && portal.delivery_status !== 'FINAL_DELIVERED';
              return (
                <div id={`portal-${portal.id}`} key={portal.id} className={`rounded-2xl border p-4 ${selectedPortalId === portal.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-stone-200'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{portal.client_name}</div>
                      <div className="mt-1 text-sm text-stone-500">{portal.event_name || 'Event'} · {portal.package_name || 'Package'}</div>
                      <div className="mt-2 text-xs text-stone-500">{portal.client_phone || portal.whatsapp_number || 'No phone saved'}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill value={portal.payment_status} />
                        <StatusPill value={portal.delivery_status} />
                        <StatusPill value={portal.gallery_status} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-stone-400">Remaining due</div>
                      <div className="mt-1 text-xl font-semibold">{money(portal.remaining_due)}</div>
                      <div className="mt-1 text-xs text-stone-500">Paid {money(portal.total_paid ?? portal.verified_total_paid)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Final Delivery</span><strong>{fmt(portal.final_delivery_at)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Free access ends</span><strong>{fmt(portal.free_access_expires_at)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Temporary access</span><strong>{fmt(portal.access_expires_at)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Storage retention</span><strong>{fmt(portal.storage_retention_until)}</strong></div>
                    <div className="rounded-xl bg-stone-50 p-3"><span className="block text-stone-500">Late fee</span><strong>{Number((portal.late_fee as any)?.balance ?? (portal.late_fee as any)?.calculated_fee ?? 0) > 0 ? money((portal.late_fee as any)?.balance ?? (portal.late_fee as any)?.calculated_fee) : 'None'}</strong></div>
                  </div>

                  <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">Final Delivery Files</h3>
                        <p className="mt-1 text-xs text-stone-600">Paste private Google Drive photo, video or folder links. Raw links stay hidden from the client.</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-stone-600">{(filesByPortal[portal.id] || []).length} file(s)</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.6fr_120px_1fr_1fr_90px_auto]">
                      <input value={fileDrafts[portal.id]?.url || ''} onChange={(e) => updateFileDraft(portal.id, { url: e.target.value })} placeholder="Private Google Drive file or folder link" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm" />
                      <select value={fileDrafts[portal.id]?.type || 'PHOTO'} onChange={(e) => updateFileDraft(portal.id, { type: e.target.value as 'PHOTO' | 'VIDEO' | 'FOLDER' })} className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm">
                        <option value="PHOTO">Photo</option><option value="VIDEO">Video</option><option value="FOLDER">Folder</option>
                      </select>
                      <input value={fileDrafts[portal.id]?.fileName || ''} onChange={(e) => updateFileDraft(portal.id, { fileName: e.target.value })} placeholder="File name (optional)" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm" />
                      <input value={fileDrafts[portal.id]?.title || ''} onChange={(e) => updateFileDraft(portal.id, { title: e.target.value })} placeholder="Display title (optional)" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm" />
                      <input value={fileDrafts[portal.id]?.sortOrder || ''} onChange={(e) => updateFileDraft(portal.id, { sortOrder: e.target.value })} type="number" placeholder="Order" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm" />
                      <button onClick={() => addFinalDeliveryFile(portal.id)} disabled={loading} className="rounded-xl bg-amber-300 px-3.5 py-2 text-sm font-bold text-stone-950 disabled:opacity-50">{loading ? 'Validating...' : 'Verify & Save'}</button>
                    </div>
                    {fileMetaByPortal[portal.id] && (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        <strong>Private file connected:</strong> {fileMetaByPortal[portal.id].name || 'Google Drive item'} · {fileMetaByPortal[portal.id].mimeType || 'Unknown type'}{fileMetaByPortal[portal.id].size ? ` · ${fileMetaByPortal[portal.id].size} bytes` : ''}
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {(filesByPortal[portal.id] || []).map((file) => (
                        <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                          <div className="min-w-0"><span className="font-semibold">{file.title || file.file_name || 'Untitled delivery file'}</span><span className="ml-2 text-xs text-stone-500">{file.file_type}</span></div>
                          <div className="flex gap-1.5"><button onClick={() => editFinalDeliveryFile(portal.id, file)} disabled={loading} className="rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50">Edit</button><button onClick={() => toggleFinalDeliveryFile(portal.id, file)} disabled={loading} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 disabled:opacity-50">{file.is_visible ? 'Hide' : 'Show'}</button><button onClick={() => removeFinalDeliveryFile(portal.id, file.id)} disabled={loading} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50">Remove</button></div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Payment ledger</h3><span className="text-xs text-stone-500">Verified payments count toward total paid</span></div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                      <input type="date" value={ledgerDraft(portal.id).date} onChange={(e) => updateLedgerDraft(portal.id, { date: e.target.value })} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                      <select value={ledgerDraft(portal.id).method} onChange={(e) => updateLedgerDraft(portal.id, { method: e.target.value as any })} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"><option value="CASH">Cash</option><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">Bank</option></select>
                      <input type="number" min="0" value={ledgerDraft(portal.id).amount} onChange={(e) => updateLedgerDraft(portal.id, { amount: e.target.value })} placeholder="Amount" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                      <input value={ledgerDraft(portal.id).transactionId} onChange={(e) => updateLedgerDraft(portal.id, { transactionId: e.target.value })} placeholder="Transaction ID" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                      <select value={ledgerDraft(portal.id).status} onChange={(e) => updateLedgerDraft(portal.id, { status: e.target.value as any })} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"><option value="VERIFIED">Verified</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option></select>
                      <button onClick={() => saveLedgerPayment(portal.id)} disabled={loading} className="rounded-xl bg-stone-950 px-3 py-2 text-sm font-bold text-white">Add payment</button>
                    </div>
                    <input value={ledgerDraft(portal.id).note} onChange={(e) => updateLedgerDraft(portal.id, { note: e.target.value })} placeholder="Payment note" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
                    <div className="mt-3 space-y-2">
                      {(ledgerByPortal[portal.id] || []).map((payment) => (
                        <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                          <div><strong>{money(payment.amount)}</strong> · {payment.payment_method} · {payment.payment_date} <StatusPill value={payment.status} />{payment.note ? <span className="ml-2 text-stone-500">{payment.note}</span> : null}</div>
                          <div className="flex gap-1"><button onClick={() => setLedgerStatus(payment, payment.status === 'VERIFIED' ? 'PENDING' : 'VERIFIED')} className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{payment.status === 'VERIFIED' ? 'Mark pending' : 'Verify'}</button><button onClick={() => removeLedgerPayment(payment.id)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Delete</button></div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {portal.client_phone && <a href={portalWhatsapp(portal.whatsapp_number || portal.client_phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-3.5 py-2 text-sm font-bold text-white">WhatsApp</a>}
                    <button onClick={() => startPortalEdit(portal)} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3.5 py-2 text-sm font-bold text-amber-900">Edit Client</button>
                    <button onClick={() => restorePortal(portal.id, false)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3.5 py-2 text-sm font-bold text-indigo-800">Restore Access</button>
                    <button onClick={() => restorePortal(portal.id, true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-3.5 py-2 text-sm font-bold text-violet-800">Waive Fee</button>
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

                  {selectedPortalId === portal.id && Object.keys(portalEdit).length > 0 && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <h3 className="font-semibold">Edit client details, message and access policy</h3>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <input value={portalEdit.clientName || ''} onChange={(e) => updatePortalEdit({ clientName: e.target.value })} placeholder="Client name" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.eventName || ''} onChange={(e) => updatePortalEdit({ eventName: e.target.value })} placeholder="Event name" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.clientPhone || ''} onChange={(e) => updatePortalEdit({ clientPhone: e.target.value })} placeholder="Phone number" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.whatsappNumber || ''} onChange={(e) => updatePortalEdit({ whatsappNumber: e.target.value })} placeholder="WhatsApp number" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.packagePrice || ''} onChange={(e) => updatePortalEdit({ packagePrice: e.target.value })} type="number" placeholder="Package price" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.freeAccessDays || ''} onChange={(e) => updatePortalEdit({ freeAccessDays: e.target.value })} type="number" placeholder="Free access days" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.dailyLateFee || ''} onChange={(e) => updatePortalEdit({ dailyLateFee: e.target.value })} type="number" placeholder="Daily late fee" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.gracePeriodDays || ''} onChange={(e) => updatePortalEdit({ gracePeriodDays: e.target.value })} type="number" placeholder="Grace days" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.lateFeeOverride || ''} onChange={(e) => updatePortalEdit({ lateFeeOverride: e.target.value })} type="number" placeholder="Fee override (optional)" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(portalEdit.lateFeeEnabled)} onChange={(e) => updatePortalEdit({ lateFeeEnabled: e.target.checked })} /> Late fee enabled</label>
                        <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(portalEdit.lateFeeWaived)} onChange={(e) => updatePortalEdit({ lateFeeWaived: e.target.checked })} /> Waive fee</label>
                        <input value={portalEdit.finalDeliveryAt || ''} onChange={(e) => updatePortalEdit({ finalDeliveryAt: e.target.value })} type="datetime-local" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                        <input value={portalEdit.accessExpiryAt || ''} onChange={(e) => updatePortalEdit({ accessExpiryAt: e.target.value })} type="datetime-local" className="rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                      </div>
                      <textarea value={portalEdit.clientMessage || ''} onChange={(e) => updatePortalEdit({ clientMessage: e.target.value })} placeholder="Client-facing delivery message" className="mt-3 min-h-20 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                      <textarea value={portalEdit.clientNote || ''} onChange={(e) => updatePortalEdit({ clientNote: e.target.value })} placeholder="Client note" className="mt-3 min-h-16 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                      <textarea value={portalEdit.internalAdminNote || ''} onChange={(e) => updatePortalEdit({ internalAdminNote: e.target.value })} placeholder="Internal admin note" className="mt-3 min-h-16 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5" />
                      <div className="mt-3 flex gap-2"><button onClick={savePortalEdit} disabled={loading} className="rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-bold text-white">Save changes</button><button onClick={() => setPortalEdit({})} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold">Cancel</button></div>
                    </div>
                  )}

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
