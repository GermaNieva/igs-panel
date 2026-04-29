"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import IGSLogo from "@/components/ui/IGSLogo";
import IGSCard from "@/components/ui/IGSCard";
import { IGS, formatARS } from "@/lib/tokens";
import {
  saveBarInfoAction,
  saveFirstCategoryAction,
  saveInitialTablesAction,
  inviteFirstStaffAction,
  completeOnboardingAction,
} from "./actions";

const STEPS = [
  { id: 1, title: "Tu bar", desc: "Datos básicos" },
  { id: 2, title: "Carta", desc: "Primera categoría y platos" },
  { id: 3, title: "Mesas", desc: "Salón y QR" },
  { id: 4, title: "Equipo", desc: "Invitar staff (opcional)" },
  { id: 5, title: "Listo", desc: "Tour del panel" },
];

const STATIONS = [
  { value: "barra", label: "Barra (bebidas)" },
  { value: "frio", label: "Cocina fría" },
  { value: "caliente", label: "Cocina caliente" },
  { value: "postres", label: "Postres" },
];

type BarInfo = {
  name: string;
  tagline: string;
  welcome_msg: string;
  address: string;
  city: string;
};

type ItemDraft = {
  name: string;
  price: string;
  description: string;
  station: string;
};

export default function OnboardingClient({
  initialBar,
  ownerName,
}: {
  initialBar: BarInfo;
  ownerName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 state
  const [bar, setBar] = useState<BarInfo>(initialBar);

  // Step 2 state
  const [categoryName, setCategoryName] = useState("Para comer");
  const [items, setItems] = useState<ItemDraft[]>([
    { name: "", price: "", description: "", station: "caliente" },
    { name: "", price: "", description: "", station: "caliente" },
    { name: "", price: "", description: "", station: "caliente" },
  ]);

  // Step 3 state
  const [zoneName, setZoneName] = useState("Salón principal");
  const [tableCount, setTableCount] = useState("8");
  const [seatsPerTable, setSeatsPerTable] = useState("4");

  // Step 4 state
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<"manager" | "waiter" | "kitchen">("waiter");

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function prev() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleStep1() {
    setError(null);
    if (!bar.name.trim()) {
      setError("El nombre del bar es obligatorio.");
      return;
    }
    startTransition(async () => {
      const res = await saveBarInfoAction({
        name: bar.name,
        tagline: bar.tagline || null,
        welcome_msg: bar.welcome_msg || null,
        address: bar.address || null,
        city: bar.city || null,
      });
      if (res.ok) next();
      else setError(res.error);
    });
  }

  function handleStep2() {
    setError(null);
    const validItems = items
      .map((i) => ({
        name: i.name.trim(),
        price: parseInt(i.price, 10) || 0,
        description: i.description.trim(),
        station: i.station,
      }))
      .filter((i) => i.name.length > 0);

    if (!categoryName.trim()) {
      setError("Ponele un nombre a la categoría.");
      return;
    }
    if (validItems.length === 0) {
      setError("Agregá al menos un plato.");
      return;
    }

    startTransition(async () => {
      const res = await saveFirstCategoryAction({
        categoryName,
        items: validItems,
      });
      if (res.ok) next();
      else setError(res.error);
    });
  }

  function handleStep3() {
    setError(null);
    startTransition(async () => {
      const res = await saveInitialTablesAction({
        zoneName: zoneName || "Salón principal",
        tableCount: parseInt(tableCount, 10) || 0,
        seatsPerTable: parseInt(seatsPerTable, 10) || 4,
      });
      if (res.ok) next();
      else setError(res.error);
    });
  }

  function handleStep3Skip() {
    setError(null);
    next();
  }

  function handleStep4() {
    setError(null);
    if (!staffEmail.trim()) {
      next();
      return;
    }
    startTransition(async () => {
      const res = await inviteFirstStaffAction({
        email: staffEmail,
        full_name: staffName,
        role: staffRole,
      });
      if (res.ok) next();
      else setError(res.error);
    });
  }

  function handleStep4Skip() {
    setError(null);
    next();
  }

  function handleFinish() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboardingAction();
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function setItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { name: "", price: "", description: "", station: "caliente" }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: IGS.bg,
        color: IGS.ink,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "20px 32px",
          borderBottom: `1px solid ${IGS.line}`,
          background: IGS.surface,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <IGSLogo size={26} />
        <div style={{ fontSize: 12, color: IGS.muted }}>
          Hola {ownerName} · armemos tu bar
        </div>
      </header>

      {/* Stepper */}
      <div
        style={{
          padding: "20px 32px",
          background: IGS.surface,
          borderBottom: `1px solid ${IGS.line}`,
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", gap: 8 }}>
          {STEPS.map((s) => (
            <div key={s.id} style={{ flex: 1 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: s.id <= step ? IGS.accent : IGS.line2,
                  marginBottom: 8,
                  transition: "background 200ms",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: s.id === step ? IGS.ink : IGS.muted,
                  letterSpacing: 0.3,
                  textTransform: "uppercase",
                }}
              >
                {s.id}. {s.title}
              </div>
              <div style={{ fontSize: 10.5, color: IGS.muted, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main style={{ flex: 1, padding: "32px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: "rgba(194,78,47,0.1)",
              border: "1px solid rgba(194,78,47,0.3)",
              color: "#a3391e",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {step === 1 && (
          <Step1
            bar={bar}
            setBar={setBar}
            pending={pending}
            onNext={handleStep1}
          />
        )}

        {step === 2 && (
          <Step2
            categoryName={categoryName}
            setCategoryName={setCategoryName}
            items={items}
            setItem={setItem}
            addItem={addItem}
            removeItem={removeItem}
            pending={pending}
            onPrev={prev}
            onNext={handleStep2}
          />
        )}

        {step === 3 && (
          <Step3
            zoneName={zoneName}
            setZoneName={setZoneName}
            tableCount={tableCount}
            setTableCount={setTableCount}
            seatsPerTable={seatsPerTable}
            setSeatsPerTable={setSeatsPerTable}
            pending={pending}
            onPrev={prev}
            onNext={handleStep3}
            onSkip={handleStep3Skip}
          />
        )}

        {step === 4 && (
          <Step4
            email={staffEmail}
            setEmail={setStaffEmail}
            name={staffName}
            setName={setStaffName}
            role={staffRole}
            setRole={setStaffRole}
            pending={pending}
            onPrev={prev}
            onNext={handleStep4}
            onSkip={handleStep4Skip}
          />
        )}

        {step === 5 && (
          <Step5 pending={pending} onPrev={prev} onFinish={handleFinish} />
        )}
      </main>
    </div>
  );
}

// =============== Step 1: datos del bar ===============
function Step1({
  bar,
  setBar,
  pending,
  onNext,
}: {
  bar: BarInfo;
  setBar: (b: BarInfo) => void;
  pending: boolean;
  onNext: () => void;
}) {
  return (
    <IGSCard padding={28}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
        Empezá por los datos de tu bar
      </div>
      <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 24 }}>
        Esto es lo que ven tus clientes cuando escanean el QR. Podés editarlo después.
      </div>

      <FormField label="Nombre del bar *" hint="Como aparece en la portada de la carta">
        <Input value={bar.name} onChange={(v) => setBar({ ...bar, name: v })} placeholder="Ej: El Fogón" />
      </FormField>

      <FormField label="Frase corta" hint="Aparece debajo del nombre — opcional">
        <Input
          value={bar.tagline}
          onChange={(v) => setBar({ ...bar, tagline: v })}
          placeholder="Ej: Parrilla de barrio desde 1995"
        />
      </FormField>

      <FormField label="Mensaje de bienvenida" hint="Lo que ven al abrir la carta">
        <Textarea
          value={bar.welcome_msg}
          onChange={(v) => setBar({ ...bar, welcome_msg: v })}
          placeholder="Ej: ¡Bienvenidos! Pedí desde tu mesa, cobramos al final."
          rows={3}
        />
      </FormField>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <FormField label="Dirección">
          <Input
            value={bar.address}
            onChange={(v) => setBar({ ...bar, address: v })}
            placeholder="Ej: Av. Belgrano 234"
          />
        </FormField>
        <FormField label="Ciudad">
          <Input
            value={bar.city}
            onChange={(v) => setBar({ ...bar, city: v })}
            placeholder="Ej: Catamarca"
          />
        </FormField>
      </div>

      <Footer>
        <PrimaryButton onClick={onNext} pending={pending}>
          Siguiente →
        </PrimaryButton>
      </Footer>
    </IGSCard>
  );
}

// =============== Step 2: carta ===============
function Step2({
  categoryName,
  setCategoryName,
  items,
  setItem,
  addItem,
  removeItem,
  pending,
  onPrev,
  onNext,
}: {
  categoryName: string;
  setCategoryName: (v: string) => void;
  items: ItemDraft[];
  setItem: (idx: number, patch: Partial<ItemDraft>) => void;
  addItem: () => void;
  removeItem: (idx: number) => void;
  pending: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const total = items.reduce(
    (s, i) => s + (i.name.trim() ? parseInt(i.price, 10) || 0 : 0),
    0
  );

  return (
    <IGSCard padding={28}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
        Cargá tu primera categoría
      </div>
      <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 24 }}>
        Las categorías agrupan los platos en la carta. Después podés agregar más desde el panel.
      </div>

      <FormField label="Nombre de la categoría *">
        <Input
          value={categoryName}
          onChange={setCategoryName}
          placeholder="Ej: Entradas, Pizzas, Bebidas"
        />
      </FormField>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Platos *</div>
        <div style={{ fontSize: 11.5, color: IGS.muted, marginBottom: 14 }}>
          Cargá al menos uno. Los platos vacíos los ignoramos.
        </div>

        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: 14,
              border: `1px solid ${IGS.line}`,
              borderRadius: 10,
              marginBottom: 10,
              background: IGS.bg,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 8 }}>
              <Input
                value={item.name}
                onChange={(v) => setItem(idx, { name: v })}
                placeholder="Nombre del plato"
              />
              <Input
                value={item.price}
                onChange={(v) => setItem(idx, { price: v.replace(/[^0-9]/g, "") })}
                placeholder="Precio en ARS"
                inputMode="numeric"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "center" }}>
              <Input
                value={item.description}
                onChange={(v) => setItem(idx, { description: v })}
                placeholder="Descripción corta (opcional)"
              />
              <Select
                value={item.station}
                onChange={(v) => setItem(idx, { station: v })}
                options={STATIONS}
              />
              {items.length > 1 && (
                <button
                  onClick={() => removeItem(idx)}
                  style={{
                    padding: "8px 10px",
                    background: "transparent",
                    color: IGS.muted,
                    border: `1px solid ${IGS.line2}`,
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                  aria-label="Eliminar plato"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={addItem}
          style={{
            padding: "8px 14px",
            background: "transparent",
            color: IGS.ink2,
            border: `1px dashed ${IGS.line2}`,
            borderRadius: 8,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            width: "100%",
          }}
        >
          + Agregar otro plato
        </button>

        {total > 0 && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: IGS.muted }}>
            Suma de los precios cargados: {formatARS(total)}
          </div>
        )}
      </div>

      <Footer>
        <SecondaryButton onClick={onPrev} pending={pending}>
          ← Atrás
        </SecondaryButton>
        <PrimaryButton onClick={onNext} pending={pending}>
          Siguiente →
        </PrimaryButton>
      </Footer>
    </IGSCard>
  );
}

// =============== Step 3: mesas ===============
function Step3({
  zoneName,
  setZoneName,
  tableCount,
  setTableCount,
  seatsPerTable,
  setSeatsPerTable,
  pending,
  onPrev,
  onNext,
  onSkip,
}: {
  zoneName: string;
  setZoneName: (v: string) => void;
  tableCount: string;
  setTableCount: (v: string) => void;
  seatsPerTable: string;
  setSeatsPerTable: (v: string) => void;
  pending: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <IGSCard padding={28}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
        Tus mesas
      </div>
      <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 24 }}>
        Cada mesa va a tener su propio QR. Podés agregar / editar después en{" "}
        <b>Mesas y QR</b>.
      </div>

      <FormField label="Zona">
        <Input
          value={zoneName}
          onChange={setZoneName}
          placeholder="Ej: Salón principal, Patio, Vereda"
        />
      </FormField>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Cantidad de mesas">
          <Input
            value={tableCount}
            onChange={(v) => setTableCount(v.replace(/[^0-9]/g, ""))}
            placeholder="8"
            inputMode="numeric"
          />
        </FormField>
        <FormField label="Asientos por mesa">
          <Input
            value={seatsPerTable}
            onChange={(v) => setSeatsPerTable(v.replace(/[^0-9]/g, ""))}
            placeholder="4"
            inputMode="numeric"
          />
        </FormField>
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 11.5,
          color: IGS.muted,
          padding: "10px 12px",
          background: IGS.bg,
          borderRadius: 8,
        }}
      >
        Vamos a numerarlas del 1 al {parseInt(tableCount, 10) || 0}. Si después agregás
        más, se numeran automáticamente desde la siguiente disponible.
      </div>

      <Footer>
        <SecondaryButton onClick={onPrev} pending={pending}>
          ← Atrás
        </SecondaryButton>
        <button
          onClick={onSkip}
          disabled={pending}
          style={{
            padding: "10px 16px",
            background: "transparent",
            color: IGS.muted,
            border: "none",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: pending ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          Saltar este paso
        </button>
        <PrimaryButton onClick={onNext} pending={pending}>
          Crear mesas →
        </PrimaryButton>
      </Footer>
    </IGSCard>
  );
}

// =============== Step 4: invitar staff ===============
function Step4({
  email,
  setEmail,
  name,
  setName,
  role,
  setRole,
  pending,
  onPrev,
  onNext,
  onSkip,
}: {
  email: string;
  setEmail: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  role: "manager" | "waiter" | "kitchen";
  setRole: (v: "manager" | "waiter" | "kitchen") => void;
  pending: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <IGSCard padding={28}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
        Sumá a tu equipo
      </div>
      <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 24 }}>
        Invitá a alguien del equipo para que pueda atender mesas o ver pedidos en cocina.
        Es opcional, podés invitarlos después desde <b>Equipo</b>.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Email">
          <Input
            value={email}
            onChange={setEmail}
            placeholder="ej: pedro@gmail.com"
          />
        </FormField>
        <FormField label="Nombre">
          <Input value={name} onChange={setName} placeholder="Pedro Gómez" />
        </FormField>
      </div>

      <FormField label="Rol">
        <Select
          value={role}
          onChange={(v) => setRole(v as "manager" | "waiter" | "kitchen")}
          options={[
            { value: "waiter", label: "Mozo (toma pedidos en mesas)" },
            { value: "kitchen", label: "Cocina (ve el KDS)" },
            { value: "manager", label: "Encargado (gestiona equipo y carta)" },
          ]}
        />
      </FormField>

      <div
        style={{
          marginTop: 6,
          fontSize: 11.5,
          color: IGS.muted,
          padding: "10px 12px",
          background: IGS.bg,
          borderRadius: 8,
        }}
      >
        Le va a llegar un email para que se ponga su contraseña y entre al panel.
      </div>

      <Footer>
        <SecondaryButton onClick={onPrev} pending={pending}>
          ← Atrás
        </SecondaryButton>
        <button
          onClick={onSkip}
          disabled={pending}
          style={{
            padding: "10px 16px",
            background: "transparent",
            color: IGS.muted,
            border: "none",
            fontSize: 12.5,
            fontWeight: 500,
            cursor: pending ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          Saltar este paso
        </button>
        <PrimaryButton onClick={onNext} pending={pending}>
          {email.trim() ? "Invitar →" : "Siguiente →"}
        </PrimaryButton>
      </Footer>
    </IGSCard>
  );
}

// =============== Step 5: tour ===============
function Step5({
  pending,
  onPrev,
  onFinish,
}: {
  pending: boolean;
  onPrev: () => void;
  onFinish: () => void;
}) {
  const tour = [
    {
      icon: "📊",
      title: "Dashboard",
      desc: "Tu pantalla principal: facturación del día, pedidos en curso, top de platos.",
    },
    {
      icon: "📋",
      title: "Carta",
      desc: "Gestioná categorías y platos. Activás / desactivás cosas en un click.",
    },
    {
      icon: "🪑",
      title: "Mesas y QR",
      desc: "Tu plano del salón. Cada mesa tiene su QR para imprimir y pegar en cada mesa.",
    },
    {
      icon: "📱",
      title: "Vista mozo",
      desc: "Pantalla optimizada para celular. Cuando un cliente llama al mozo, aparece acá.",
    },
    {
      icon: "🔥",
      title: "Cocina (KDS)",
      desc: "Pantalla grande para la cocina. Cada pedido aparece como tarjeta con tiempo.",
    },
    {
      icon: "💳",
      title: "Suscripción",
      desc: "Activá tu plan cuando estés listo. Hoy estás en período de prueba.",
    },
  ];

  return (
    <IGSCard padding={28}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
        🎉 ¡Listo, tu bar está armado!
      </div>
      <div style={{ fontSize: 13, color: IGS.muted, marginBottom: 24 }}>
        Acá hay un tour rápido del panel. En 1 minuto sabés dónde está todo.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        {tour.map((t) => (
          <div
            key={t.title}
            style={{
              padding: 14,
              border: `1px solid ${IGS.line}`,
              borderRadius: 10,
              background: IGS.bg,
              display: "flex",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 22 }}>{t.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{t.title}</div>
              <div style={{ fontSize: 11.5, color: IGS.muted, lineHeight: 1.5 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: 14,
          background: IGS.ink,
          color: "#fff",
          borderRadius: 10,
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: "rgba(255,255,255,0.7)" }}>
          PRÓXIMOS PASOS
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          1. Imprimí los QR de cada mesa desde <b>Mesas y QR</b>.<br />
          2. Probá la carta abriendo el QR con tu celular.<br />
          3. Activá tu plan en <b>Suscripción</b> antes de que termine la prueba.
        </div>
      </div>

      <Footer>
        <SecondaryButton onClick={onPrev} pending={pending}>
          ← Atrás
        </SecondaryButton>
        <PrimaryButton onClick={onFinish} pending={pending}>
          {pending ? "Entrando..." : "Empezar a usar IGS"}
        </PrimaryButton>
      </Footer>
    </IGSCard>
  );
}

// =============== Helpers UI ===============
function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: IGS.muted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${IGS.line2}`,
        background: "#fff",
        fontSize: 13,
        fontFamily: "inherit",
        outline: "none",
        color: IGS.ink,
      }}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows ?? 3}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${IGS.line2}`,
        background: "#fff",
        fontSize: 13,
        fontFamily: "inherit",
        outline: "none",
        color: IGS.ink,
        resize: "vertical",
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${IGS.line2}`,
        background: "#fff",
        fontSize: 13,
        fontFamily: "inherit",
        outline: "none",
        color: IGS.ink,
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PrimaryButton({
  children,
  onClick,
  pending,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        padding: "10px 18px",
        background: IGS.ink,
        color: "#fff",
        border: "none",
        borderRadius: 22,
        fontSize: 13,
        fontWeight: 700,
        cursor: pending ? "wait" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  pending,
}: {
  children: React.ReactNode;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        padding: "10px 16px",
        background: "transparent",
        color: IGS.ink2,
        border: `1px solid ${IGS.line2}`,
        borderRadius: 22,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: pending ? "wait" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 24,
        paddingTop: 18,
        borderTop: `1px solid ${IGS.line}`,
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}
