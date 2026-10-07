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
import { jsPDF } from "jspdf";
import { supabase } from "../services/supabase";
import AdminGoogleConnection from "../components/AdminGoogleConnection";

const db = supabase as any;

type EventInput = {
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

type FormData = {
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

function SignaturePad(props: { onChange: (value: string) => void }) {
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
    form.package_amount + form.client_extra_charge - form.discount
  );
  const due = Math.max(0, total - form.advance_paid);

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
      const saved = await submitBooking(form);
      setSavedRef(saved.reference_no);
      downloadPdf(form, saved.reference_no, 0);
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
              downloadPdf(form, savedRef, 0);
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
            Wedding & Event Booking Form
          </h1>
          <p className="mt-3 max-w-3xl text-slate-300">
            Client information, events, package, payment, delivery and signature in one form.
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
          <h2 className="text-xl font-black">1. Client information</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Client name *">
              <input
                required
                className={inputClass}
                value={form.client_name}
                onChange={function (e) {
                  setValue("client_name", e.target.value);
                }}
              />
            </Field>
            <Field label="Primary phone *">
              <input
                required
                className={inputClass}
                value={form.phone}
                onChange={function (e) {
                  setValue("phone", e.target.value);
                }}
              />
            </Field>
            <Field label="Alternative phone">
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
            <Field label="Bride name">
              <input
                className={inputClass}
                value={form.bride_name}
                onChange={function (e) {
                  setValue("bride_name", e.target.value);
                }}
              />
            </Field>
            <Field label="Groom name">
              <input
                className={inputClass}
                value={form.groom_name}
                onChange={function (e) {
                  setValue("groom_name", e.target.value);
                }}
              />
            </Field>
            <Field label="Guardian / family contact">
              <input
                className={inputClass}
                value={form.guardian_name}
                onChange={function (e) {
                  setValue("guardian_name", e.target.value);
                }}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <textarea
                className={inputClass}
                rows={2}
                value={form.address}
                onChange={function (e) {
                  setValue("address", e.target.value);
                }}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">2. Events</h2>
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
              Add event
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
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Event name *">
                      <input
                        required
                        className={inputClass}
                        value={ev.event_name}
                        placeholder="Holud, Wedding, Reception..."
                        onChange={function (e) {
                          setEvent(index, { event_name: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="Event date *">
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
                    <Field label="Venue">
                      <input
                        className={inputClass}
                        value={ev.venue}
                        onChange={function (e) {
                          setEvent(index, { venue: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="Start time">
                      <input
                        type="time"
                        className={inputClass}
                        value={ev.start_time}
                        onChange={function (e) {
                          setEvent(index, { start_time: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="End time">
                      <input
                        type="time"
                        className={inputClass}
                        value={ev.end_time}
                        onChange={function (e) {
                          setEvent(index, { end_time: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="Location / address">
                      <input
                        className={inputClass}
                        value={ev.location}
                        onChange={function (e) {
                          setEvent(index, { location: e.target.value });
                        }}
                      />
                    </Field>
                    <Field label="Photographers">
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
                    <Field label="Cinematographers">
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
                      Drone coverage
                    </label>
                    <Field
                      label="Event notes"
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
          <h2 className="text-xl font-black">3. Package & accounts</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Package name" className="sm:col-span-2">
              <input
                className={inputClass}
                value={form.package_name}
                placeholder="Premium Wedding Package"
                onChange={function (e) {
                  setValue("package_name", e.target.value);
                }}
              />
            </Field>
            <Field label="Package amount">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.package_amount}
                onChange={function (e) {
                  setValue("package_amount", Number(e.target.value));
                }}
              />
            </Field>
            <Field label="Advance paid">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.advance_paid}
                onChange={function (e) {
                  setValue("advance_paid", Number(e.target.value));
                }}
              />
            </Field>
            <Field label="Extra client charge">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.client_extra_charge}
                onChange={function (e) {
                  setValue("client_extra_charge", Number(e.target.value));
                }}
              />
            </Field>
            <Field label="Discount">
              <input
                type="number"
                min={0}
                className={inputClass}
                value={form.discount}
                onChange={function (e) {
                  setValue("discount", Number(e.target.value));
                }}
              />
            </Field>
          </div>
          <div className="mt-5 grid gap-3 rounded-2xl bg-slate-950 p-5 text-white sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Contract total
              </div>
              <div className="mt-1 text-2xl font-black">{money(total)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400">
                Paid
              </div>
              <div className="mt-1 text-2xl font-black">
                {money(form.advance_paid)}
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
          <h2 className="text-xl font-black">4. Deliverables & delivery</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Photography details">
              <textarea
                className={inputClass}
                rows={3}
                value={form.photography_details}
                onChange={function (e) {
                  setValue("photography_details", e.target.value);
                }}
              />
            </Field>
            <Field label="Cinematography details">
              <textarea
                className={inputClass}
                rows={3}
                value={form.cinematography_details}
                onChange={function (e) {
                  setValue("cinematography_details", e.target.value);
                }}
              />
            </Field>
            <Field label="Album details">
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
          <h2 className="text-xl font-black">5. Client signature</h2>
          <p className="mt-2 text-sm text-slate-500">
            Sign after reviewing the dates, package, payment and delivery information.
          </p>
          <div className="mt-5">
            <SignaturePad
              onChange={function (value) {
                setValue("signature_data", value);
              }}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Signed by *">
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
            I confirm that the event schedule, package, payment and delivery terms entered above are correct.
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
          {saving ? "Submitting..." : "Submit, sign & download PDF"}
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

function AdminPanel() {
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

      if (!selectedId && nextBookings[0]) {
        setSelectedId(nextBookings[0].id);
      } else if (
        selectedId &&
        !nextBookings.some(function (b) {
          return b.id === selectedId;
        })
      ) {
        setSelectedId(nextBookings[0] ? nextBookings[0].id : "");
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
      if (!q) return bookings;
      return bookings.filter(function (b) {
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
    [bookings, search]
  );

  const selected =
    bookings.find(function (b) {
      return b.id === selectedId;
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
            Enter the private admin access code to manage bookings. Connect Google separately for Drive files.
          </p>
          <div className="mt-4"><AdminGoogleConnection /></div>
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
            <h1 className="text-xl font-black">Client Sheet & Accounts</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminGoogleConnection />
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

      <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-5 xl:grid-cols-[1.45fr_1fr]">
        <section className="min-w-0 rounded-3xl bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={function (e) {
                  setSearch(e.target.value);
                }}
                className={inputClass + " pl-9"}
                placeholder="Search client, phone, reference, bride or groom..."
              />
            </div>
            {notice ? (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                {notice}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Events</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Profit</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
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
                        <div className="font-bold">{b.client_name}</div>
                        <div className="text-xs text-slate-500">{b.phone}</div>
                      </td>
                      <td className="px-4 py-3">{b.event_count}</td>
                      <td className="px-4 py-3 font-semibold">
                        {money(t.total)}
                      </td>
                      <td className="px-4 py-3 text-emerald-700">
                        {money(t.paid)}
                      </td>
                      <td className="px-4 py-3 font-black text-red-600">
                        {money(t.due)}
                      </td>
                      <td className="px-4 py-3">{money(t.internalCost)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {money(t.profit)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize">
                          {b.status}
                        </span>
                      </td>
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
              token={token}
              booking={selected}
              events={events}
              payments={payments}
              costs={costs}
              onChanged={load}
            />
          ) : (
            <div className="rounded-3xl bg-white p-8 text-slate-500 shadow-sm">
              Select a client row.
            </div>
          )}
        </aside>
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
            <div className="mt-1 text-sm text-slate-300">{booking.phone}</div>
          </div>
          <button
            onClick={adminPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-slate-900"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-slate-400">Total</div>
            <div className="mt-1 text-lg font-black">
              {money(totals.total)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-slate-400">Due</div>
            <div className="mt-1 text-lg font-black text-amber-300">
              {money(totals.due)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-slate-400">Internal cost</div>
            <div className="mt-1 text-lg font-black">
              {money(totals.internalCost)}
            </div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-xs text-slate-400">Projected profit</div>
            <div className="mt-1 text-lg font-black">
              {money(totals.profit)}
            </div>
          </div>
        </div>
      </section>

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

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 font-black">
          <CalendarDays className="h-5 w-5" />
          Events
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

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 font-black">
          <WalletCards className="h-5 w-5" />
          Add payment
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="number"
            min={0}
            className={inputClass}
            placeholder="Amount"
            value={paymentAmount}
            onChange={function (e) {
              setPaymentAmount(e.target.value);
            }}
          />
          <select
            className={inputClass}
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
            value={paymentDate}
            onChange={function (e) {
              setPaymentDate(e.target.value);
            }}
          />
          <input
            className={inputClass}
            placeholder="Payment note"
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
          Save payment
        </button>
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
                  </span>
                  <b>{money(Number(p.amount))}</b>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="font-black">Internal cost only</div>
        <p className="mt-1 text-xs text-slate-500">
          This is private admin information and never appears in the client PDF.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            className={inputClass}
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
            placeholder="Amount"
            value={costAmount}
            onChange={function (e) {
              setCostAmount(e.target.value);
            }}
          />
          <input
            className={inputClass}
            placeholder="Vendor / person"
            value={costVendor}
            onChange={function (e) {
              setCostVendor(e.target.value);
            }}
          />
          <input
            type="date"
            className={inputClass}
            value={costDate}
            onChange={function (e) {
              setCostDate(e.target.value);
            }}
          />
          <input
            className={inputClass + " sm:col-span-2"}
            placeholder="Cost note"
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
          Save internal cost
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
                  </span>
                  <b>{money(Number(c.amount))}</b>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="font-black">Admin private notes</div>
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
          Save private notes
        </button>
      </section>
    </div>
  );
}

export default function BookingPortal() {
  const isAdmin = window.location.pathname.startsWith("/booking/admin");
  return isAdmin ? <AdminPanel /> : <ClientForm />;
}
