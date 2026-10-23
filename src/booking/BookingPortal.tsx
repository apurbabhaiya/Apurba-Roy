import AdminPushNotifications from './AdminPushNotifications';
import MiniBooking from './MiniBooking';
import FriendlyBooking from './FriendlyBooking';
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  WalletCards,
} from "lucide-react";
import { BookingDiscussionAdmin, BookingPaymentReview, CustomBuilder, CustomPackageAdmin, useCustomConfig, eventTypes, type CustomOptions, type CustomQuote } from './CustomPackages';
import TeamConfirmation from "./TeamConfirmation";
import FinanceCalendar from "./FinanceCalendar";
import { jsPDF } from "jspdf";
import { supabase } from "../services/supabase";

const db = supabase as any;

export type EventInput = {
  end_date?: string;
  special_photos?: number;
  video_edit?: boolean;
  event_name: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  location: string;
  photographers: number;
  cinematographers: number;
  drone: boolean;
  notes: string;
  sort_order: number;
};

export type FormData = {
  client_name: string;
  phone: string;
  alt_phone: string;
  email: string;
  bride_name: string;
  groom_name: string;
  guardian_name: string;
  address: string;
  package_name: string;
  package_amount: number;
  client_extra_charge: number;
  discount: number;
  advance_paid: number;
  photography_details: string;
  cinematography_details: string;
  album_details: string;
  delivery_days: number | null;
  delivery_terms: string;
  client_notes: string;
  signature_name: string;
  signature_data: string;
  consent: boolean;
  events: EventInput[];
};

type Booking = {
  contract_snapshot?: {custom_quote?: CustomQuote; payment_plan?: {city_deposit?:boolean;full_advance?:boolean;initial:number;half_total:number;half_due_date:string;event_date:string;total:number};booking_options?: {payment_proof?:unknown;payment_method?:string}};
  deleted_at?: string | null;
  id: string;
  reference_no: string;
  client_name: string;
  phone: string;
  alt_phone?: string | null;
  email?: string | null;
  bride_name?: string | null;
  groom_name?: string | null;
  guardian_name?: string | null;
  address?: string | null;
  event_count: number;
  package_name?: string | null;
  package_amount: number | string;
  client_extra_charge: number | string;
  discount: number | string;
  advance_paid: number | string;
  photography_details?: string | null;
  cinematography_details?: string | null;
  album_details?: string | null;
  delivery_days?: number | null;
  delivery_terms?: string | null;
  client_notes?: string | null;
  internal_notes?: string | null;
  status: string;
  signature_name: string;
  signature_data: string;
  created_at: string;
};

type EventRow = EventInput & {
  id: string;
  booking_id: string;
};

type Payment = {
  id: string;
  booking_id: string;
  amount: number | string;
  paid_on: string;
  method?: string | null;
  note?: string | null;
};

type Cost = {
  id: string;
  booking_id: string;
  cost_type: string;
  amount: number | string;
  vendor?: string | null;
  paid_on?: string | null;
  note?: string | null;
};

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

function blankEvent(index: number): EventInput {
  return {
    event_name: "",
    event_date: "",
    start_time: "",
    end_time: "",
    venue: "",
    location: "",
    photographers: 1,
    cinematographers: 1,
    drone: false,
    notes: "",
    sort_order: index,
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(value);
}

function Field(props: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={"block " + (props.className || "")}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}

export function SignaturePad(props: { onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const p = point(e);
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    const p = point(e);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current as HTMLCanvasElement;
    props.onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    props.onChange("");
  }

  return (
    <div>
      <div className="rounded-2xl border border-slate-300 bg-white p-2">
        <canvas
          ref={canvasRef}
          width={900}
          height={220}
          className="h-40 w-full touch-none rounded-xl bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
      >
        Clear signature
      </button>
    </div>
  );
}

function addPdfText(doc: jsPDF, label: string, value: string, y: number) {
  if (!value) return y;
  doc.setFont("helvetica", "bold");
  doc.text(label, 16, y);
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(value, 145);
  doc.text(lines, 56, y);
  return y + Math.max(7, lines.length * 5);
}

function downloadPdf(
  form: FormData,
  reference: string,
  additionalPayments: number
) {
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Ramya Chobi - Client Booking Agreement", 16, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Phone: 01776044951 | Facebook: RamyaChobi", 16, y);
  y += 7;
  doc.text("Reference: " + reference, 16, y);
  y += 9;

  doc.setFontSize(11);
  y = addPdfText(doc, "Client", form.client_name, y);
  y = addPdfText(doc, "Phone", form.phone, y);
  y = addPdfText(doc, "Email", form.email, y);
  y = addPdfText(doc, "Bride", form.bride_name, y);
  y = addPdfText(doc, "Groom", form.groom_name, y);
  y = addPdfText(doc, "Address", form.address, y);

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("Events", 16, y);
  y += 7;
  doc.setFont("helvetica", "normal");

  form.events.forEach(function (ev) {
    const text =
      ev.event_name +
      " | " +
      ev.event_date +
      " | " +
      (ev.venue || ev.location || "") +
      " | Photo " +
      ev.photographers +
      " | Video " +
      ev.cinematographers +
      (ev.drone ? " | Drone" : "");
    const lines = doc.splitTextToSize(text, 178);
    if (y + lines.length * 5 > 275) {
      doc.addPage();
      y = 18;
    }
    doc.text(lines, 18, y);
    y += Math.max(6, lines.length * 5 + 2);
  });

  if (y > 220) {
    doc.addPage();
    y = 18;
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("Package & Payment", 16, y);
  y += 7;
  doc.setFont("helvetica", "normal");

  const total = Math.max(
    0,
    form.package_amount + form.client_extra_charge - form.discount
  );
  const paid = form.advance_paid + additionalPayments;

  doc.text("Package: " + (form.package_name || "-"), 16, y);
  y += 6;
  doc.text("Package Amount: BDT " + form.package_amount.toLocaleString(), 16, y);
  y += 6;
  doc.text("Extra Charge: BDT " + form.client_extra_charge.toLocaleString(), 16, y);
  y += 6;
  doc.text("Discount: BDT " + form.discount.toLocaleString(), 16, y);
  y += 6;
  doc.text("Contract Total: BDT " + total.toLocaleString(), 16, y);
  y += 6;
  doc.text("Paid: BDT " + paid.toLocaleString(), 16, y);
  y += 6;
  doc.text("Due: BDT " + Math.max(0, total - paid).toLocaleString(), 16, y);
  y += 8;

  y = addPdfText(doc, "Photo", form.photography_details, y);
  y = addPdfText(doc, "Video", form.cinematography_details, y);
  y = addPdfText(doc, "Album", form.album_details, y);
  y = addPdfText(
    doc,
    "Delivery",
    form.delivery_days !== null
      ? String(form.delivery_days) + " days. " + form.delivery_terms
      : form.delivery_terms,
    y
  );
  y = addPdfText(doc, "Notes", form.client_notes, y);

  if (y > 225) {
    doc.addPage();
    y = 18;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Client Signature", 16, y);
  y += 5;
  try {
    doc.addImage(form.signature_data, "PNG", 16, y, 70, 20);
  } catch {}
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.text("Signed by: " + form.signature_name, 16, y);
  y += 6;
  doc.text(
    "The client confirms the event, package, payment and delivery information above.",
    16,
    y
  );

  doc.save(reference + "-Ramya-Chobi-Booking.pdf");
}

async function submitBooking(form: FormData) {
  const result = await db.rpc("submit_client_booking", { p_payload: form });
  if (result.error) throw result.error;
  return result.data as {
    id: string;
    reference_no: string;
    created_at: string;
  };
}

function ClientForm() {
  const {config: customConfig, error: configError} = useCustomConfig();
  const [useCustom, setUseCustom] = useState(false);
  const [customOptions, setCustomOptions] = useState<CustomOptions>({travel:{}});
  const [customQuote, setCustomQuote] = useState<CustomQuote|null>(null);
  const customActive = useCustom && !!customConfig?.enabled;

  const [form, setForm] = useState<FormData>({
    client_name: "",
    phone: "",
    alt_phone: "",
    email: "",
    bride_name: "",
    groom_name: "",
    guardian_name: "",
    address: "",
    package_name: "",
    package_amount: 0,
    client_extra_charge: 0,
    discount: 0,
    advance_paid: 0,
    photography_details: "",
    cinematography_details: "",
    album_details: "",
    delivery_days: 30,
    delivery_terms: "",
    client_notes: "",
    signature_name: "",
    signature_data: "",
    consent: false,
    events: [blankEvent(0)],
  });
  const [allowPublish, setAllowPublish] = useState(true);
  const noPublishFee = allowPublish ? 0 : 10000;
  // Persist the policy using the existing booking fields for admin and PDF compatibility.
  const bookingPayload: FormData = {
    ...form,
    package_name: customActive ? 'Custom package - office verification required' : form.package_name,
    package_amount: customActive ? (customQuote?.total || 0) : form.package_amount,
    discount: customActive ? 0 : form.discount,
    advance_paid: customActive ? 0 : form.advance_paid,
    client_extra_charge: (customActive ? 0 : form.client_extra_charge) + noPublishFee,
    client_notes: (allowPublish
      ? "Publication policy: Allow Publish (free). Selected photos may be published on Ramya Chobi portfolio/page."
      : "Publication policy: No-Publish. No publish fee: BDT 10,000 (included in extra charge). Photos must not be published online.") + (form.client_notes ? "\n" + form.client_notes : ""),
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedRef, setSavedRef] = useState("");

  function setValue(key: keyof FormData, value: any) {
    setForm(function (current) {
      return Object.assign({}, current, { [key]: value });
    });
  }

  function setEvent(index: number, patch: Partial<EventInput>) {
    setForm(function (current) {
      return Object.assign({}, current, {
        events: current.events.map(function (ev, i) {
          return i === index ? Object.assign({}, ev, patch) : ev;
        }),
      });
    });
  }

  function addEvent() {
    setForm(function (current) {
      return Object.assign({}, current, {
        events: current.events.concat([blankEvent(current.events.length)]),
      });
    });
  }

  function removeEvent(index: number) {
    setForm(function (current) {
      return Object.assign({}, current, {
        events: current.events
          .filter(function (_, i) {
            return i !== index;
          })
          .map(function (ev, i) {
            return Object.assign({}, ev, { sort_order: i });
          }),
      });
    });
  }

  const total = Math.max(
    0,
    bookingPayload.package_amount + bookingPayload.client_extra_charge - bookingPayload.discount
  );
  const due = Math.max(0, total - bookingPayload.advance_paid);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.signature_data) {
      setError("Please sign in the signature box.");
      return;
    }
    if (!form.consent) {
      setError("Please confirm the agreement checkbox.");
      return;
    }
    if (
      form.events.some(function (ev) {
        return !ev.event_name.trim() || !ev.event_date;
      })
    ) {
      setError("Every event needs a name and date.");
      return;
    }

    setSaving(true);
    try {
      if (customActive && !customQuote) throw new Error('কাস্টম প্যাকেজের সঠিক হিসাব আসা পর্যন্ত অপেক্ষা করুন।');
      let saved: {id:string;reference_no:string;created_at:string};
      if(customActive && customQuote) {
        const response = await db.rpc('submit_custom_booking', {p_payload:bookingPayload,p_options:{...customOptions,allow_publish:allowPublish},p_expected_total:customQuote.total,p_revision:customQuote.revision});
        if(response.error) throw response.error;
        saved=response.data;
      } else saved=await submitBooking(bookingPayload);
      setSavedRef(saved.reference_no);
      downloadPdf(bookingPayload, saved.reference_no, 0);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err && err.message ? err.message : "Could not submit the form.");
    } finally {
      setSaving(false);
    }
  }

  if (savedRef) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-slate-900 shadow-2xl">
          <CheckCircle2 className="mb-4 h-14 w-14 text-emerald-600" />
          <h1 className="text-3xl font-black">Booking form submitted</h1>
          <p className="mt-3 text-slate-600">
            The client details and signature have been saved.
          </p>
          <div className="mt-6 rounded-2xl bg-slate-100 p-5">
            <div className="text-sm text-slate-500">Reference</div>
            <div className="text-2xl font-black">{savedRef}</div>
          </div>
          <button
            type="button"
            onClick={function () {
              downloadPdf(bookingPayload, savedRef, 0);
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"
          >
            <Download className="h-4 w-4" />
            Download signed PDF again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
            Ramya Chobi
          </div>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            রম্যছবি · সহজ বুকিং
          </h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            প্রথমে নাম ও ফোন দিন → অনুষ্ঠান ও সময় বাছুন → প্যাকেজ দেখে সম্মতি দিন।
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <a
              href="tel:01776044951"
              className="font-semibold text-white hover:text-amber-300"
            >
              01776044951
            </a>
            <a
              href="https://www.facebook.com/RamyaChobi/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-white hover:text-amber-300"
            >
              Facebook / RamyaChobi
            </a>
          </div>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="mx-auto max-w-5xl space-y-6 px-4 py-8"
      >
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black">১. আপনার যোগাযোগ</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="আপনার নাম *">
              <input
                required
                className={inputClass}
                value={form.client_name}
                onChange={function (e) {
                  setValue("client_name", e.target.value);
                }}
              />
            </Field>
            <Field label="মোবাইল নম্বর *">
              <input
                required
                className={inputClass}
                value={form.phone}
                onChange={function (e) {
                  setValue("phone", e.target.value);
                }}
              />
            </Field>
            <details className="sm:col-span-2"><summary className="cursor-pointer font-bold text-slate-600">আরও তথ্য দিন (ঐচ্ছিক)</summary><div className="mt-3 grid gap-4 sm:grid-cols-2">            <Field label="বিকল্প ফোন">
              <input
                className={inputClass}
                value={form.alt_phone}
                onChange={function (e) {
                  setValue("alt_phone", e.target.value);
                }}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={function (e) {
                  setValue("email", e.target.value);
                }}
              />
            </Field>
            <Field label="কনের নাম">
              <input
                className={inputClass}
                value={form.bride_name}
                onChange={function (e) {
                  setValue("bride_name", e.target.value);
                }}
              />
            </Field>
            <Field label="বরের নাম">
              <input
                className={inputClass}
                value={form.groom_name}
                onChange={function (e) {
                  setValue("groom_name", e.target.value);
                }}
              />
            </Field>
            <Field label="পরিবারের যোগাযোগ">
              <input
                className={inputClass}
                value={form.guardian_name}
                onChange={function (e) {
                  setValue("guardian_name", e.target.value);
                }}
              />
            </Field>
            <Field label="ঠিকানা" className="sm:col-span-2">
              <textarea
                className={inputClass}
                rows={2}
                value={form.address}
                onChange={function (e) {
                  setValue("address", e.target.value);
                }}
              />
            </Field>
</div></details>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">২. অনুষ্ঠান ও সময়</h2>
              <p className="mt-1 text-sm text-slate-500">
                {form.events.length} event(s)
              </p>
            </div>
            <button
              type="button"
              onClick={addEvent}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              আরেকটি অনুষ্ঠান যোগ করুন
            </button>
          </div>

          <div className="mt-5 space-y-5">
            {form.events.map(function (ev, index) {
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-black">Event {index + 1}</div>
                    {form.events.length > 1 ? (
                      <button
                        type="button"
                        onClick={function () {
                          removeEvent(index);
                        }}
                        className="inline-flex items-center gap-1 text-sm font-bold text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        বাদ দিন
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="ইভেন্টের ধরন *">
                      <select required className={inputClass} value={eventTypes.includes(ev.event_name)?ev.event_name:(ev.event_name?'অন্যান্য':'')} onChange={e=>setEvent(index,{event_name:e.target.value})}><option value="">ইভেন্টের ধরন বাছুন</option>{eventTypes.map(name=><option key={name}>{name}</option>)}</select>
                      {ev.event_name && !eventTypes.slice(0,-1).includes(ev.event_name) && <input aria-label="অন্য অনুষ্ঠানের নাম" className={inputClass+' mt-2'} placeholder="অনুষ্ঠানের নাম লিখুন" value={ev.event_name==='অন্যান্য'?'':ev.event_name} onChange={e=>setEvent(index,{event_name:e.target.value||'অন্যান্য'})}/>}
                    </Field>
                    <Field label="তারিখ *">
                      <input
                        required
                        type="date"
                        className={inputClass}
                        value={ev.event_date}
                        onChange={function (e) {
                          setEvent(index, { event_date: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="ভেন্যু">
                      <input
                        className={inputClass}
                        value={ev.venue}
                        onChange={function (e) {
                          setEvent(index, { venue: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="শুরুর সময়">
                      <input
                        type="time"
                        className={inputClass}
                        value={ev.start_time}
                        onChange={function (e) {
                          setEvent(index, { start_time: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="শেষের সময়">
                      <input
                        type="time"
                        className={inputClass}
                        value={ev.end_time}
                        onChange={function (e) {
                          setEvent(index, { end_time: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="লোকেশন / address">
                      <input
                        className={inputClass}
                        value={ev.location}
                        onChange={function (e) {
                          setEvent(index, { location: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="ফটোগ্রাফার সংখ্যা">
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        value={ev.photographers}
                        onChange={function (e) {
                          setEvent(index, {
                            photographers: Number(e.target.value),
                          });
                        }}
                      />
                    </Field>
                    <Field label="সিনেমাটোগ্রাফার সংখ্যা">
                      <input
                        type="number"
                        min={0}
                        className={inputClass}
                        value={ev.cinematographers}
                        onChange={function (e) {
                          setEvent(index, {
                            cinematographers: Number(e.target.value),
                          });
                        }}
                      />
                    </Field>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-semibold">
                      <input
                        type="checkbox"
                        checked={ev.drone}
                        onChange={function (e) {
                          setEvent(index, { drone: e.target.checked });
                        }}
                      />
                      ড্রোন লাগবে
                    </label>
                    <Field
                      label="অনুষ্ঠানের নোট (ঐচ্ছিক)"
                      className="sm:col-span-2 lg:col-span-3"
                    >
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={ev.notes}
                        onChange={function (e) {
                          setEvent(index, { notes: e.target.value });
                        }}
                      />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black">৩. প্যাকেজ ও খরচ</h2>
          {customConfig?.enabled && <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-bold"><input type="checkbox" checked={useCustom} onChange={e=>setUseCustom(e.target.checked)}/>নিজের প্যাকেজ তৈরি করুন <span className="text-xs font-normal">সময় ও সার্ভিস বেছে খরচ দেখুন</span></label>}
          {configError && <p className="mt-2 text-sm text-amber-800">{configError}</p>}
          {customActive && customConfig && <CustomBuilder events={form.events} options={customOptions} onOptions={setCustomOptions} onEvent={setEvent} onQuote={setCustomQuote} config={customConfig}/>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="প্যাকেজের নাম" className="sm:col-span-2">
              <input
                className={inputClass}
                readOnly={customActive}
                value={customActive ? bookingPayload.package_name : form.package_name}
                placeholder="Premium Wedding Package"
                onChange={function (e) {
                  setValue("package_name", e.target.value);
                }}
              />
            </Field>
            <Field label="প্যাকেজের মূল্য">
              <input
                type="number"
                min={0}
                className={inputClass}
                readOnly={customActive}
                value={customActive ? bookingPayload.package_amount : form.package_amount}
                onChange={function (e) {
                  setValue("package_amount", Number(e.target.value));
                }}
              />
            </Field>
            <Field label="অগ্রিম জমা (অফিস যাচাই করবে)">
              <input
                type="number"
                min={0}
                className={inputClass}
                readOnly={customActive}
                value={customActive ? bookingPayload.advance_paid : form.advance_paid}
                onChange={function (e) {
                  setValue("advance_paid", Number(e.target.value));
                }}
              />
            </Field>
            <Field label="অতিরিক্ত চার্জ">
              <input
                type="number"
                min={0}
                className={inputClass}
                readOnly={customActive}
                value={customActive ? bookingPayload.client_extra_charge : form.client_extra_charge}
                onChange={function (e) {
                  setValue("client_extra_charge", Number(e.target.value));
                }}
              />
            </Field>
            <Field label="ছাড়">
              <input
                type="number"
                min={0}
                className={inputClass}
                readOnly={customActive}
                value={customActive ? bookingPayload.discount : form.discount}
                onChange={function (e) {
                  setValue("discount", Number(e.target.value));
                }}
              />
            </Field>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <Field label="No-Publish (অনলাইনে পাবলিশ না করলে)">
              <select
                className={inputClass}
                value={allowPublish ? "allow" : "no_publish"}
                onChange={(e) => setAllowPublish(e.target.value === "allow")}
              >
                <option value="allow">Allow Publish (ফ্রি)</option>
                <option value="no_publish">No publish fee +৳10,000</option>
              </select>
            </Field>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              BD ইন্ডাস্ট্রিতে টিম সাধারণত পোর্টফোলিও/পেজে নির্বাচিত ছবি পোস্ট করে। ক্লায়েন্ট নিষেধ করলে “No publish fee” প্রযোজ্য।
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900" aria-live="polite">
              {allowPublish ? "প্রকাশের অনুমতি: ফ্রি।" : "অনলাইনে ছবি প্রকাশ করা যাবে না। মোট বিলের সঙ্গে ৳10,000 যোগ হয়েছে।"}
            </p>
          </div>
          <div className="mt-5 grid gap-3 rounded-2xl bg-slate-950 p-5 text-white sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                মোট খরচ
              </div>
              <div className="mt-1 text-2xl font-black">{money(total)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Paid
              </div>
              <div className="mt-1 text-2xl font-black">
                {money(bookingPayload.advance_paid)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Due
              </div>
              <div className="mt-1 text-2xl font-black text-amber-300">
                {money(due)}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black">৪. ছবি, ভিডিও ও ডেলিভারি</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="ছবির বিস্তারিত">
              <textarea
                className={inputClass}
                rows={3}
                value={form.photography_details}
                onChange={function (e) {
                  setValue("photography_details", e.target.value);
                }}
              />
            </Field>
            <Field label="ভিডিওর বিস্তারিত">
              <textarea
                className={inputClass}
                rows={3}
                value={form.cinematography_details}
                onChange={function (e) {
                  setValue("cinematography_details", e.target.value);
                }}
              />
            </Field>
            <Field label="অ্যালবামের বিস্তারিত">
              <textarea
                className={inputClass}
                rows={3}
                value={form.album_details}
                onChange={function (e) {
                  setValue("album_details", e.target.value);
                }}
              />
            </Field>
            <div className="grid gap-4">
              <Field label="Delivery within days">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.delivery_days === null ? "" : form.delivery_days}
                  onChange={function (e) {
                    setValue(
                      "delivery_days",
                      e.target.value === "" ? null : Number(e.target.value)
                    );
                  }}
                />
              </Field>
              <Field label="Delivery terms">
                <input
                  className={inputClass}
                  value={form.delivery_terms}
                  onChange={function (e) {
                    setValue("delivery_terms", e.target.value);
                  }}
                />
              </Field>
            </div>
            <Field label="Client notes" className="sm:col-span-2">
              <textarea
                className={inputClass}
                rows={3}
                value={form.client_notes}
                onChange={function (e) {
                  setValue("client_notes", e.target.value);
                }}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black">৫. সম্মতি ও স্বাক্ষর</h2>
          <p className="mt-2 text-sm text-slate-500">
            তারিখ, প্যাকেজ ও শর্ত দেখে নিচে স্বাক্ষর করুন।
          </p>
          <div className="mt-5">
            <SignaturePad
              onChange={function (value) {
                setValue("signature_data", value);
              }}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="স্বাক্ষরকারীর নাম *">
              <input
                required
                className={inputClass}
                value={form.signature_name}
                onChange={function (e) {
                  setValue("signature_name", e.target.value);
                }}
              />
            </Field>
          </div>
          <label className="mt-5 flex items-start gap-3 rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.consent}
              onChange={function (e) {
                setValue("consent", e.target.checked);
              }}
            />
            অনুষ্ঠানের সময়, প্যাকেজ, মূল্য ও ডেলিভারির শর্ত পড়েছি এবং সম্মতি দিচ্ছি।
          </label>
        </section>

        <button
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-lg font-black text-white shadow-lg disabled:opacity-60"
        >
          {saving ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <Save className="h-5 w-5" />
          )}
          {saving ? "পাঠানো হচ্ছে…" : "বুকিং অনুরোধ পাঠান"}
        </button>
      </form>
    </main>
  );
}

function totalsFor(
  booking: Booking,
  payments: Payment[],
  costs: Cost[]
) {
  const total = Math.max(
    0,
    Number(booking.package_amount || 0) +
      Number(booking.client_extra_charge || 0) -
      Number(booking.discount || 0)
  );
  const laterPaid = payments
    .filter(function (p) {
      return p.booking_id === booking.id;
    })
    .reduce(function (sum, p) {
      return sum + Number(p.amount || 0);
    }, 0);
  const paid = Number(booking.advance_paid || 0) + laterPaid;
  const internalCost = costs
    .filter(function (c) {
      return c.booking_id === booking.id;
    })
    .reduce(function (sum, c) {
      return sum + Number(c.amount || 0);
    }, 0);
  return {
    total: total,
    paid: paid,
    due: Math.max(0, total - paid),
    internalCost: internalCost,
    profit: total - internalCost,
  };
}

function bookingToForm(booking: Booking, events: EventRow[]): FormData {
  return {
    client_name: booking.client_name,
    phone: booking.phone,
    alt_phone: booking.alt_phone || "",
    email: booking.email || "",
    bride_name: booking.bride_name || "",
    groom_name: booking.groom_name || "",
    guardian_name: booking.guardian_name || "",
    address: booking.address || "",
    package_name: booking.package_name || "",
    package_amount: Number(booking.package_amount || 0),
    client_extra_charge: Number(booking.client_extra_charge || 0),
    discount: Number(booking.discount || 0),
    advance_paid: Number(booking.advance_paid || 0),
    photography_details: booking.photography_details || "",
    cinematography_details: booking.cinematography_details || "",
    album_details: booking.album_details || "",
    delivery_days:
      booking.delivery_days === undefined ? null : booking.delivery_days,
    delivery_terms: booking.delivery_terms || "",
    client_notes: booking.client_notes || "",
    signature_name: booking.signature_name,
    signature_data: booking.signature_data,
    consent: true,
    events: events
      .filter(function (e) {
        return e.booking_id === booking.id;
      })
      .map(function (e) {
        return {
          event_name: e.event_name,
          event_date: e.event_date,
          start_time: e.start_time || "",
          end_time: e.end_time || "",
          venue: e.venue || "",
          location: e.location || "",
          photographers: Number(e.photographers || 0),
          cinematographers: Number(e.cinematographers || 0),
          drone: Boolean(e.drone),
          notes: e.notes || "",
          sort_order: Number(e.sort_order || 0),
        };
      }),
  };
}


const ADMIN_TOKEN_KEY = "ramya_booking_admin_token_v1";

function getStoredAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveAdminToken(token: string) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {}
}

function bookingPhoneHref(phone: string) {
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(normalized) && !/^0+$/.test(normalized) ? `tel:${normalized}` : null;
}

function AdminPanel() {
  const [showCustomSettings,setShowCustomSettings] = useState(false);
  const [showDiscussions,setShowDiscussions] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [pendingTrash, setPendingTrash] = useState<Booking | null>(null);
  const [trashBusy, setTrashBusy] = useState(false);
  async function changeTrash(booking: Booking, deleted: boolean) {
    if (trashBusy) return;
    setTrashBusy(true);
    try {
      const result = await db.rpc('booking_admin_set_trash', { p_token: token, p_booking_id: booking.id, p_deleted: deleted });
      if (result.error) throw result.error;
      if (!result.data) throw new Error('Booking was not found. Refresh and try again.');
      setPendingTrash(null);
      setSelectedId('');
      await load();
      setNotice(deleted ? 'Booking moved to Trash. Payments and events are preserved. Use Restore to recover it.' : 'Booking restored.');
    } catch (error: any) { setNotice(error?.message || 'Could not update booking.'); }
    finally { setTrashBusy(false); }
  }

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(activeToken?: string) {
    const useToken = activeToken || token;
    if (!useToken) {
      setReady(true);
      return;
    }

    setLoading(true);
    setNotice("");
    try {
      const result = await db.rpc("booking_admin_dashboard", {
        p_token: useToken,
      });
      if (result.error) throw result.error;

      const payload = result.data || {};
      const nextBookings = (payload.bookings || []) as Booking[];
      setBookings(nextBookings);
      setEvents((payload.events || []) as EventRow[]);
      setPayments((payload.payments || []) as Payment[]);
      setCosts((payload.costs || []) as Cost[]);

      const activeBookings = nextBookings.filter(b => !b.deleted_at);
      if (!selectedId && activeBookings[0]) {
        setSelectedId(activeBookings[0].id);
      } else if (
        selectedId &&
        !nextBookings.some(function (b) {
          return b.id === selectedId && !b.deleted_at && !showTrash;
        })
      ) {
        setSelectedId(activeBookings[0] ? activeBookings[0].id : "");
      }
    } catch (err: any) {
      const message =
        err && err.message ? err.message : "Could not load admin data.";
      setNotice(message);
      if (/session expired|invalid admin/i.test(message)) {
        saveAdminToken("");
        setToken("");
      }
    } finally {
      setLoading(false);
      setReady(true);
    }
  }

  useEffect(function () {
    const stored = getStoredAdminToken();
    if (stored) {
      setToken(stored);
      void load(stored);
    } else {
      setReady(true);
    }
  }, []);

  const filtered = useMemo(
    function () {
      const q = search.trim().toLowerCase();
      const visible = bookings.filter((b) => Boolean(b.deleted_at) === showTrash);
      if (!q) return visible;
      return visible.filter(function (b) {
        return [
          b.reference_no,
          b.client_name,
          b.phone,
          b.email || "",
          b.bride_name || "",
          b.groom_name || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    },
    [bookings, search, showTrash]
  );

  const selected =
    bookings.find(function (b) {
      return b.id === selectedId && !b.deleted_at && !showTrash;
    }) || null;

  async function signIn(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!accessCode.trim()) return;

    setLoading(true);
    setNotice("");
    try {
      const result = await db.rpc("booking_admin_login", {
        p_code: accessCode.trim(),
      });
      if (result.error) throw result.error;

      const nextToken = String(result.data?.token || "");
      if (!nextToken) throw new Error("Admin login token was not returned.");

      saveAdminToken(nextToken);
      setToken(nextToken);
      setAccessCode("");
      await load(nextToken);
    } catch (err: any) {
      setNotice(
        err && err.message ? err.message : "Admin access code is invalid."
      );
    } finally {
      setLoading(false);
      setReady(true);
    }
  }

  async function signOut() {
    try {
      if (token) {
        await db.rpc("booking_admin_logout", { p_token: token });
      }
    } catch {}
    saveAdminToken("");
    setToken("");
    setBookings([]);
    setEvents([]);
    setPayments([]);
    setCosts([]);
    setSelectedId("");
    setNotice("");
  }

  function exportCsv() {
    const rows = [
      [
        "Reference",
        "Client",
        "Phone",
        "Status",
        "Events",
        "Package",
        "Total",
        "Paid",
        "Due",
        "Internal Cost",
        "Projected Profit",
      ],
    ];

    filtered.forEach(function (b) {
      const t = totalsFor(b, payments, costs);
      rows.push([
        b.reference_no,
        b.client_name,
        b.phone,
        b.status,
        String(b.event_count),
        b.package_name || "",
        String(t.total),
        String(t.paid),
        String(t.due),
        String(t.internalCost),
        String(t.profit),
      ]);
    });

    const csv = rows
      .map(function (row) {
        return row
          .map(function (value) {
            return '"' + String(value).replaceAll('"', '""') + '"';
          })
          .join(",");
      })
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ramya-chobi-client-sheet.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <RefreshCw className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <form
          onSubmit={signIn}
          className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
        >
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
            Ramya Chobi
          </div>
          <h1 className="mt-2 text-3xl font-black text-slate-900">
            Admin Client Sheet
          </h1>
          <p className="mt-3 text-slate-600">
            Enter the private admin access code. Google OAuth is not required.
          </p>
          <Field label="Admin access code">
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={accessCode}
              onChange={function (e) {
                setAccessCode(e.target.value);
              }}
              placeholder="Enter access code"
            />
          </Field>
          <button
            disabled={loading || !accessCode.trim()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-60"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Open admin panel
          </button>
          {notice ? (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
              {notice}
            </div>
          ) : null}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              Ramya Chobi
            </div>
            <h1 className="text-xl font-black">ক্লায়েন্ট ও হিসাব</h1>
            <p className="mt-1 text-xs text-slate-500">ক্লায়েন্ট বাছুন → হিসাব দেখুন → জমা বা খরচ যোগ করুন</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={()=>{setShowCustomSettings(v=>!v);setShowDiscussions(false)}} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">{showCustomSettings?'ক্লায়েন্ট হিসাবে ফিরুন':'কাস্টম প্যাকেজ / বুকিং সেটিংস'}</button>
            <button type="button" onClick={()=>{setShowDiscussions(v=>!v);setShowCustomSettings(false)}} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold">{showDiscussions?'ক্লায়েন্ট হিসাবে ফিরুন':'আলোচনার অনুরোধ'}</button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={function () {
                void load();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold"
            >
              <RefreshCw
                className={"h-4 w-4 " + (loading ? "animate-spin" : "")}
              />
              Refresh
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-bold text-white"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <AdminPushNotifications token={token}/>
      {showCustomSettings && <div className="px-4 py-5"><CustomPackageAdmin token={token}/></div>}
      {showDiscussions && <div className="px-4 py-5"><BookingDiscussionAdmin token={token}/></div>}
      <div hidden={showCustomSettings||showDiscussions}>
      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-5 xl:grid-cols-[1.1fr_1fr]">
        <section className="min-w-0 rounded-3xl bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="mb-3 flex gap-2" aria-label="Booking list view">
              <button type="button" aria-pressed={!showTrash} onClick={() => setShowTrash(false)} className="rounded-xl border px-4 py-2 font-bold">ক্লায়েন্ট ({bookings.filter(b => !b.deleted_at).length})</button>
              <button type="button" aria-pressed={showTrash} onClick={() => setShowTrash(true)} className="rounded-xl border px-4 py-2 font-bold">ট্র্যাশ / রিকভারি ({bookings.filter(b => b.deleted_at).length})</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={function (e) {
                  setSearch(e.target.value);
                }}
                className={inputClass + " pl-9"}
                aria-label="ক্লায়েন্ট খুঁজুন"
                placeholder="নাম, ফোন বা বুকিং নম্বর দিয়ে খুঁজুন…"
              />
            </div>
            {notice ? (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                {notice}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">বুকিং নম্বর</th>
                  <th className="px-4 py-3">ক্লায়েন্ট</th>
                  <th className="px-4 py-3">মোট বিল</th>
                  <th className="px-4 py-3">জমা</th>
                  <th className="px-4 py-3">বাকি</th>
                  <th className="px-4 py-3">অবস্থা</th><th className="px-4 py-3">করণীয়</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">{showTrash ? 'ট্র্যাশে কোনো বুকিং নেই।' : 'কোনো ক্লায়েন্ট পাওয়া যায়নি।'}</td></tr>}
                {filtered.map(function (b) {
                  const t = totalsFor(b, payments, costs);
                  const active = b.id === selectedId;
                  return (
                    <tr
                      key={b.id}
                      onClick={function () {
                        setSelectedId(b.id);
                      }}
                      className={
                        "cursor-pointer border-t border-slate-100 hover:bg-slate-50 " +
                        (active ? "bg-amber-50" : "")
                      }
                    >
                      <td className="px-4 py-3 font-black">{b.reference_no}</td>
                      <td className="px-4 py-3">
                        <button type="button" aria-pressed={active} onClick={e => { e.stopPropagation(); setSelectedId(b.id); }} className="text-left font-bold text-slate-950 underline decoration-slate-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-amber-600">{b.client_name}</button>
                        {bookingPhoneHref(b.phone) ? <a onClick={e => e.stopPropagation()} href={bookingPhoneHref(b.phone)!} className="text-xs font-semibold text-blue-700 underline">Call {b.phone}</a> : <span className="text-xs text-slate-500">{b.phone} (invalid phone)</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {money(t.total)}
                      </td>
                      <td className="px-4 py-3 text-emerald-700">
                        {money(t.paid)}
                      </td>
                      <td className="px-4 py-3 font-black text-red-600">
                        {money(t.due)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize">
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3"><button type="button" disabled={trashBusy} onClick={e => { e.stopPropagation(); if (showTrash) void changeTrash(b, false); else setPendingTrash(b); }} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-50">{showTrash ? 'ফিরিয়ে আনুন' : 'ট্র্যাশে নিন'}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="min-w-0">
          {selected ? (
            <BookingDetail
              key={selected.id}
              token={token}
              booking={selected}
              events={events}
              payments={payments}
              costs={costs}
              onChanged={load}
            />
          ) : (
            <div className="rounded-3xl bg-white p-8 text-slate-500 shadow-sm">
              তালিকা থেকে ক্লায়েন্টের নাম চাপুন। তার হিসাব এখানে দেখা যাবে।
            </div>
          )}
          <details className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <summary className="cursor-pointer font-bold text-slate-800">সব ক্লায়েন্টের মাসিক ও বার্ষিক রিপোর্ট</summary>
            <p className="my-3 text-xs text-slate-500">সমস্ত বুকিংয়ের সম্মিলিত হিসাব। ক্লায়েন্টভিত্তিক হিসাব উপরে দেখুন।</p>
            <FinanceCalendar bookings={bookings} payments={payments} costs={costs} />
          </details>
        </aside>
      </div>
      {pendingTrash && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="trash-title" className="w-full max-w-md rounded-2xl bg-white p-6"><h2 id="trash-title" className="text-xl font-bold">বুকিং ট্র্যাশে নিতে চান?</h2><p className="mt-3">{pendingTrash.reference_no} · {pendingTrash.client_name}</p><p className="mt-2 text-sm">জমা, খরচ ও অনুষ্ঠানের তথ্য সংরক্ষিত থাকবে। ট্র্যাশ থেকে বুকিং ফিরিয়ে আনতে পারবেন। ডেলিভারির প্রবেশাধিকার আগের মতো থাকবে।</p><div className="mt-5 flex gap-3"><button autoFocus disabled={trashBusy} onClick={() => setPendingTrash(null)} className="rounded-xl border px-4 py-2">Cancel</button><button disabled={trashBusy} onClick={() => void changeTrash(pendingTrash, true)} className="rounded-xl bg-red-700 px-4 py-2 text-white">{trashBusy ? 'সরানো হচ্ছে…' : 'ট্র্যাশে নিন'}</button></div></section></div>}
      </div>
    </main>
  );
}


function BookingDetail(props: {
  token: string;
  booking: Booking;
  events: EventRow[];
  payments: Payment[];
  costs: Cost[];
  onChanged: () => Promise<void>;
}) {
  const [detailSection, setDetailSection] = useState("overview");
  const booking = props.booking;
  const bookingEvents = props.events.filter(function (e) {
    return e.booking_id === booking.id;
  });
  const bookingPayments = props.payments.filter(function (p) {
    return p.booking_id === booking.id;
  });
  const bookingCosts = props.costs.filter(function (c) {
    return c.booking_id === booking.id;
  });
  const totals = totalsFor(booking, props.payments, props.costs);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentNote, setPaymentNote] = useState("");
  const [costType, setCostType] = useState("freelancer");
  const [costAmount, setCostAmount] = useState("");
  const [costVendor, setCostVendor] = useState("");
  const [costDate, setCostDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [costNote, setCostNote] = useState("");
  const [internalNotes, setInternalNotes] = useState(
    booking.internal_notes || ""
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(
    function () {
      setInternalNotes(booking.internal_notes || "");
      setNotice("");
    },
    [booking.id, booking.internal_notes]
  );

  async function addPayment() {
    const amount = Number(paymentAmount);
    if (!(amount > 0)) return;

    setSaving(true);
    setNotice("");
    try {
      const result = await db.rpc("booking_admin_add_payment", {
        p_token: props.token,
        p_booking_id: booking.id,
        p_amount: amount,
        p_paid_on: paymentDate,
        p_method: paymentMethod || null,
        p_note: paymentNote || null,
      });
      if (result.error) throw result.error;
      setPaymentAmount("");
      setPaymentNote("");
      await props.onChanged();
    } catch (err: any) {
      setNotice(err && err.message ? err.message : "Could not save payment.");
    } finally {
      setSaving(false);
    }
  }

  async function addCost() {
    const amount = Number(costAmount);
    if (!costAmount || amount < 0) return;

    setSaving(true);
    setNotice("");
    try {
      const result = await db.rpc("booking_admin_add_cost", {
        p_token: props.token,
        p_booking_id: booking.id,
        p_cost_type: costType,
        p_amount: amount,
        p_vendor: costVendor || null,
        p_paid_on: costDate || null,
        p_note: costNote || null,
      });
      if (result.error) throw result.error;
      setCostAmount("");
      setCostVendor("");
      setCostNote("");
      await props.onChanged();
    } catch (err: any) {
      setNotice(err && err.message ? err.message : "Could not save cost.");
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setSaving(true);
    setNotice("");
    try {
      const result = await db.rpc("booking_admin_update_booking", {
        p_token: props.token,
        p_booking_id: booking.id,
        p_status: null,
        p_internal_notes: internalNotes,
      });
      if (result.error) throw result.error;
      await props.onChanged();
    } catch (err: any) {
      setNotice(err && err.message ? err.message : "Could not save notes.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: string) {
    setSaving(true);
    setNotice("");
    try {
      const result = await db.rpc("booking_admin_update_booking", {
        p_token: props.token,
        p_booking_id: booking.id,
        p_status: status,
        p_internal_notes: null,
      });
      if (result.error) throw result.error;
      await props.onChanged();
    } catch (err: any) {
      setNotice(err && err.message ? err.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  function adminPdf() {
    const additionalPaid = bookingPayments.reduce(function (sum, p) {
      return sum + Number(p.amount || 0);
    }, 0);
    downloadPdf(
      bookingToForm(booking, props.events),
      booking.reference_no,
      additionalPaid
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400">
              {booking.reference_no}
            </div>
            <h2 className="mt-1 text-2xl font-black">
              {booking.client_name}
            </h2>
            {bookingPhoneHref(booking.phone) ? <a href={bookingPhoneHref(booking.phone)!} className="mt-1 inline-block text-sm text-amber-300 underline">Call {booking.phone}</a> : <div className="mt-1 text-sm text-slate-300">{booking.phone}</div>}
          </div>
          <button
            onClick={adminPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-slate-900"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            {label:'মোট বিল', value:totals.total, style:'text-white'},
            {label:'টাকা পাওয়া', value:totals.paid, style:'text-emerald-300'},
            {label:'বাকি টাকা', value:totals.due, style:totals.due > 0 ? 'text-red-300' : 'text-white'},
            {label:'রেকর্ড করা খরচ', value:totals.internalCost, style:'text-white'},
            {label:totals.profit < 0 ? 'সম্ভাব্য লস' : 'সম্ভাব্য লাভ', value:Math.abs(totals.profit), style:totals.profit < 0 ? 'text-red-300' : 'text-emerald-300'},
          ].map(card => <div key={card.label} className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="text-xs text-slate-300">{card.label}</div><div className={`mt-2 break-words text-lg font-black ${card.style}`}>{money(card.value)}</div></div>)}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">সম্ভাব্য লাভ = মোট বিল − রেকর্ড করা খরচ। বকেয়া টাকা হাতে পাওয়া আয় নয়।</p>
      </section>
      <nav aria-label="Client account sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {['overview','payments','costs','events','team','documents'].map(section => <button key={section} type="button" aria-current={detailSection === section ? 'page' : undefined} onClick={() => setDetailSection(section)} className={`rounded-xl px-3 py-2 text-sm font-bold capitalize focus-visible:outline-2 focus-visible:outline-amber-600 ${detailSection === section ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{({overview:"সারাংশ",payments:"টাকা জমা",costs:"খরচ",events:"অনুষ্ঠান",team:"টিম কনফার্মেশন",documents:"কাগজপত্র"} as Record<string,string>)[section]}</button>)}
      </nav>
      <section hidden={detailSection !== 'overview'} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-black">হিসাবের বিস্তারিত</h3>{booking.contract_snapshot?.payment_plan && <div className="mt-3 rounded-xl border p-3 text-sm"><b>সম্মত পেমেন্টের সময়সূচি</b><p>ক্লায়েন্টের নির্বাচিত মাধ্যম: {booking.contract_snapshot.booking_options?.payment_method||'দেওয়া হয়নি'}</p><p>প্রাথমিক অগ্রিম: {money(booking.contract_snapshot.payment_plan.initial)}</p><p>{booking.contract_snapshot.payment_plan.half_due_date}{booking.contract_snapshot.payment_plan.city_deposit?' শুটের দিন পর্যন্ত প্রি-বুকিং অগ্রিম: ':booking.contract_snapshot.payment_plan.full_advance?' সম্পূর্ণ অগ্রিম: ':'-এর মধ্যে মোট ৫০%: '}{money(booking.contract_snapshot.payment_plan.half_total)}</p><p>{booking.contract_snapshot.payment_plan.full_advance?'পুরো বিল অগ্রিম, শুটের দিন: ':'ইভেন্টের দিনে বাকি বিল: '}{booking.contract_snapshot.payment_plan.event_date}</p></div>}
        {booking.contract_snapshot?.custom_quote && <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm"><b>কাস্টম প্যাকেজ · রেট সংস্করণ {booking.contract_snapshot.custom_quote.revision}</b>{booking.contract_snapshot.custom_quote.lines.map((line,i)=><p key={i}>{line.event_name} · {line.minutes/60} ঘণ্টা: {money(line.amount)}</p>)}<p>ট্রাভেল: {money(booking.contract_snapshot.custom_quote.travel)}</p>{booking.contract_snapshot.custom_quote.needs_review&&<p className="font-bold text-amber-800">চার ঘণ্টার কম বুকিং: লোকেশন ও ব্যতিক্রমের অনুমোদন যাচাই করুন।</p>}</div>}
        <dl className="mt-4 space-y-3 text-sm">
          {[
            ['প্যাকেজের দাম',Number(booking.package_amount || 0)],
            ['অতিরিক্ত চার্জ',Number(booking.client_extra_charge || 0)],
            ['ছাড়',-Number(booking.discount || 0)],
            ['চূড়ান্ত বিল',totals.total],
            ['অগ্রিম জমা',Number(booking.advance_paid || 0)],
            ['পরবর্তী জমা',totals.paid - Number(booking.advance_paid || 0)],
            ['মোট পাওয়া',totals.paid],
            ['বাকি টাকা',totals.due],
          ].map(([label,value]) => <div key={String(label)} className="flex justify-between gap-3 border-b border-slate-100 pb-2"><dt className="text-slate-600">{label}</dt><dd className="font-bold">{money(Number(value))}</dd></div>)}
        </dl>
        {totals.paid > totals.total && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">বিলের অতিরিক্ত জমা: {money(totals.paid - totals.total)}। রিফান্ড বা সমন্বয়ের তথ্য যাচাই করুন।</p>}
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-slate-600">হাতে পাওয়া টাকা − খরচ: </span><strong className={totals.paid - totals.internalCost < 0 ? 'text-red-700' : 'text-emerald-700'}>{money(totals.paid - totals.internalCost)}</strong><p className="mt-1 text-xs text-slate-500">এই ক্লায়েন্টের রেকর্ডভিত্তিক নগদ উদ্বৃত্ত/ঘাটতি।</p></div>
      </section>
      <div hidden={detailSection !== 'team'}><TeamConfirmation key={booking.id} client={booking.client_name} reference={booking.reference_no} status={booking.status} events={bookingEvents} /></div>
      <section hidden={detailSection !== 'documents'} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-black">ক্লায়েন্টের কাগজপত্র</h3><p className="mt-2 text-sm text-slate-500">বুকিং ও পেমেন্টের সারাংশসহ ক্লায়েন্ট PDF। অভ্যন্তরীণ খরচ ও ব্যক্তিগত নোট এতে থাকবে না।</p><button type="button" onClick={adminPdf} className="mt-4 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">ক্লায়েন্ট PDF ডাউনলোড</button>
      </section>


      <div hidden={detailSection !== "overview"}>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">
              Bride
            </div>
            <div className="font-semibold">{booking.bride_name || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">
              Groom
            </div>
            <div className="font-semibold">{booking.groom_name || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">
              Package
            </div>
            <div className="font-semibold">{booking.package_name || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-400">
              Delivery
            </div>
            <div className="font-semibold">
              {booking.delivery_days !== null &&
              booking.delivery_days !== undefined
                ? String(booking.delivery_days) + " days"
                : "-"}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-bold uppercase text-slate-400">
            Status
          </div>
          <select
            value={booking.status}
            disabled={saving}
            onChange={function (e) {
              void changeStatus(e.target.value);
            }}
            className={inputClass + " mt-1"}
          >
            {["new", "contacted", "booked", "confirmed", "completed", "cancelled"].map(
              function (s) {
                return (
                  <option key={s} value={s}>
                    {s}
                  </option>
                );
              }
            )}
          </select>
        </div>
      </section>
      </div>

      <div hidden={detailSection !== "events"}>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 font-black">
          <CalendarDays className="h-5 w-5" />
          অনুষ্ঠানের তথ্য
        </div>
        <div className="mt-4 space-y-3">
          {bookingEvents.map(function (ev) {
            const start = ev.event_date.replaceAll("-", "");
            const nextDay = new Date(ev.event_date + "T00:00:00");
            nextDay.setDate(nextDay.getDate() + 1);
            const end = nextDay
              .toISOString()
              .slice(0, 10)
              .replaceAll("-", "");
            const gcal =
              "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
              encodeURIComponent(
                "Ramya Chobi - " + ev.event_name + " - " + booking.client_name
              ) +
              "&dates=" +
              start +
              "/" +
              end +
              "&details=" +
              encodeURIComponent(booking.reference_no + " | " + booking.phone) +
              "&location=" +
              encodeURIComponent(ev.venue || ev.location || "");

            return (
              <div
                key={ev.id}
                className="rounded-2xl border border-slate-200 p-3"
              >
                <div className="font-black">{ev.event_name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {ev.event_date}
                  {ev.start_time ? " • " + ev.start_time.slice(0, 5) : ""}
                </div>
                <div className="text-sm text-slate-600">
                  {ev.venue || ev.location || "-"}
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500">
                  Photo {ev.photographers} • Video {ev.cinematographers}
                  {ev.drone ? " • Drone" : ""}
                </div>
                <a
                  href={gcal}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-bold text-blue-700"
                >
                  Add to Google Calendar
                </a>
              </div>
            );
          })}
        </div>
      </section>
      </div>

      <div hidden={detailSection !== "payments"}>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 font-black">
          <WalletCards className="h-5 w-5" />
          টাকা জমা করুন
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="number"
            min={0}
            className={inputClass}
            aria-label="জমার পরিমাণ"
            placeholder="টাকার পরিমাণ"
            value={paymentAmount}
            onChange={function (e) {
              setPaymentAmount(e.target.value);
            }}
          />
          <select
            className={inputClass}
            aria-label="জমার মাধ্যম"
            value={paymentMethod}
            onChange={function (e) {
              setPaymentMethod(e.target.value);
            }}
          >
            <option>Cash</option>
            <option>Bank</option>
            <option>bKash</option>
            <option>Nagad</option>
            <option>Card</option>
            <option>Other</option>
          </select>
          <input
            type="date"
            className={inputClass}
            aria-label="জমার তারিখ"
            value={paymentDate}
            onChange={function (e) {
              setPaymentDate(e.target.value);
            }}
          />
          <input
            className={inputClass}
            placeholder="জমার বিবরণ (ঐচ্ছিক)"
            value={paymentNote}
            onChange={function (e) {
              setPaymentNote(e.target.value);
            }}
          />
        </div>
        <button
          disabled={saving}
          onClick={function () {
            void addPayment();
          }}
          className="mt-3 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          জমা সংরক্ষণ করুন
        </button>
        <div className="mt-4"><BookingPaymentReview token={props.token} bookingId={booking.id} onChanged={props.onChanged}/></div><h3 className="mt-5 border-t border-slate-100 pt-4 text-sm font-bold">জমার ইতিহাস</h3>
        <div className="mt-2 flex justify-between rounded-xl bg-emerald-50 p-3 text-sm"><span>অগ্রিম জমা <small className="block text-slate-500">লেনদেনের তারিখ সংরক্ষিত নেই</small></span><strong>{money(Number(booking.advance_paid || 0))}</strong></div>
        {bookingPayments.length ? (
          <div className="mt-4 space-y-2 text-sm">
            {bookingPayments.map(function (p) {
              return (
                <div
                  key={p.id}
                  className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span>
                    {p.paid_on} • {p.method || "Payment"}
                    {p.note && <small className="block text-slate-500">{p.note}</small>}
                  </span>
                  <b>{money(Number(p.amount))}</b>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      </div>

      <div hidden={detailSection !== "costs"}>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="font-black">এই ক্লায়েন্টের কাজের খরচ</div>
        <p className="mt-1 text-xs text-slate-500">
          This is private admin information and never appears in the client PDF.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            className={inputClass}
            aria-label="খরচের ধরন"
            value={costType}
            onChange={function (e) {
              setCostType(e.target.value);
            }}
          >
            <option value="freelancer">Freelancer</option>
            <option value="travel">Travel</option>
            <option value="album">Album / print</option>
            <option value="equipment">Equipment</option>
            <option value="other">Other</option>
          </select>
          <input
            type="number"
            min={0}
            className={inputClass}
            aria-label="খরচের পরিমাণ"
            placeholder="টাকার পরিমাণ"
            value={costAmount}
            onChange={function (e) {
              setCostAmount(e.target.value);
            }}
          />
          <input
            className={inputClass}
            placeholder="কাকে দেওয়া হয়েছে (ঐচ্ছিক)"
            value={costVendor}
            onChange={function (e) {
              setCostVendor(e.target.value);
            }}
          />
          <input
            type="date"
            className={inputClass}
            aria-label="খরচের তারিখ"
            value={costDate}
            onChange={function (e) {
              setCostDate(e.target.value);
            }}
          />
          <input
            className={inputClass + " sm:col-span-2"}
            placeholder="খরচের বিবরণ (ঐচ্ছিক)"
            value={costNote}
            onChange={function (e) {
              setCostNote(e.target.value);
            }}
          />
        </div>
        <button
          disabled={saving}
          onClick={function () {
            void addCost();
          }}
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          খরচ সংরক্ষণ করুন
        </button>
        {bookingCosts.length ? (
          <div className="mt-4 space-y-2 text-sm">
            {bookingCosts.map(function (c) {
              return (
                <div
                  key={c.id}
                  className="flex justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
                  <span>
                    {c.cost_type}
                    {c.vendor ? " • " + c.vendor : ""}
                    <small className="block text-slate-500">{c.paid_on || "তারিখ নেই"}{c.note ? " · " + c.note : ""}</small>
                  </span>
                  <b>{money(Number(c.amount))}</b>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
      </div>

      <div hidden={detailSection !== "overview"}>
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="font-black">নিজস্ব নোট (শুধু অ্যাডমিন)</div>
        <textarea
          className={inputClass + " mt-3"}
          rows={4}
          value={internalNotes}
          onChange={function (e) {
            setInternalNotes(e.target.value);
          }}
        />
        <button
          disabled={saving}
          onClick={function () {
            void saveNotes();
          }}
          className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          নোট সংরক্ষণ করুন
        </button>
      </section>
      </div>
    </div>
  );
}

export default function BookingPortal() {
  const isAdmin = window.location.pathname.startsWith("/booking/admin");
  return isAdmin ? <AdminPanel /> : window.location.pathname==='/booking/city' ? <MiniBooking /> : new URLSearchParams(window.location.search).has('legacy') ? <ClientForm /> : <FriendlyBooking />;
}
