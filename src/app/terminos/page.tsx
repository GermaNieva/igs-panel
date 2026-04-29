import Link from "next/link";
import IGSLogo from "@/components/ui/IGSLogo";
import { IGS } from "@/lib/tokens";
import LegalFooter from "@/components/LegalFooter";

export const metadata = {
  title: "Términos y Condiciones — IGS Panel",
};

const LAST_UPDATE = "29 de abril de 2026";

export default function TerminosPage() {
  return (
    <div style={{ minHeight: "100vh", background: IGS.bg, color: IGS.ink, display: "flex", flexDirection: "column" }}>
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
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <IGSLogo size={26} />
        </Link>
        <div style={{ fontSize: 12, color: IGS.muted }}>Última actualización: {LAST_UPDATE}</div>
      </header>

      <main style={{ flex: 1, padding: "40px 32px", maxWidth: 760, margin: "0 auto", width: "100%", lineHeight: 1.65, fontSize: 14 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, letterSpacing: -0.6 }}>
          Términos y Condiciones
        </h1>

        <p>
          Estos Términos y Condiciones (los <b>&quot;Términos&quot;</b>) regulan el uso del servicio
          IGS Panel (en adelante, el <b>&quot;Servicio&quot;</b>) provisto por <b>IGS Soluciones Web</b>{" "}
          (en adelante, <b>&quot;IGS&quot;</b>, <b>&quot;nosotros&quot;</b>) a la persona o empresa que se
          suscribe al Servicio (en adelante, el <b>&quot;Bar&quot;</b>, <b>&quot;Cliente&quot;</b> o{" "}
          <b>&quot;vos&quot;</b>). Al crear una cuenta y suscribirte al Servicio, aceptás estos
          Términos en su totalidad.
        </p>

        <Section title="1. Qué es IGS Panel">
          <p>
            IGS Panel es un sistema de gestión para bares y restaurantes que incluye carta digital con
            código QR por mesa, panel de administración, vista de mozo, KDS para cocina, gestión de
            equipo y suscripción mensual procesada vía MercadoPago.
          </p>
          <p>
            El Servicio se provee &quot;como está&quot; (<i>as is</i>). No garantizamos un porcentaje de uptime
            específico, aunque hacemos todo lo razonable para mantener el Servicio disponible.
          </p>
        </Section>

        <Section title="2. Cuenta y uso del Servicio">
          <p>
            Para usar el Servicio tenés que crear una cuenta con un email válido. Sos responsable de
            mantener la confidencialidad de tu contraseña y de toda la actividad que se realice desde
            tu cuenta.
          </p>
          <p>
            Sos responsable de toda la información que cargues en el Servicio (carta, precios,
            mensajes, datos de contacto). IGS no revisa el contenido cargado y no se hace
            responsable de errores u omisiones en esa información.
          </p>
        </Section>

        <Section title="3. Plan, precio y pago">
          <p>
            El Servicio se provee bajo un plan mensual de <b>$30.000 ARS</b> (treinta mil pesos
            argentinos), que se cobra automáticamente mediante MercadoPago. El precio puede
            actualizarse a futuro por inflación o cambios en el Servicio; te avisaremos por email
            con al menos 30 días de anticipación.
          </p>
          <p>
            Cuando creás tu cuenta accedés a un <b>período de prueba gratuito de 15 días</b>. Al
            finalizar la prueba, si no activaste la suscripción, el acceso a las funciones del panel
            se restringe hasta que se realice el primer pago.
          </p>
          <p>
            El cobro se renueva automáticamente cada mes a través de la suscripción de MercadoPago,
            que vos podés cancelar en cualquier momento desde el panel o desde tu cuenta de
            MercadoPago.
          </p>
        </Section>

        <Section title="4. Mora y suspensión">
          <p>
            Si un cobro mensual falla (por ejemplo, tarjeta rechazada o saldo insuficiente),
            MercadoPago reintentará el cobro durante los siguientes días. Si después de{" "}
            <b>7 días</b> el pago no se concreta, podemos suspender el acceso al panel y a la carta
            pública. Si la situación se mantiene por <b>30 días</b>, podemos dar de baja la cuenta y
            su contenido podría perderse.
          </p>
          <p>
            Te avisaremos por email cuando un pago falle y antes de cualquier suspensión.
          </p>
        </Section>

        <Section title="5. Cancelación y baja">
          <p>
            Podés cancelar tu suscripción en cualquier momento desde el panel, sin penalidad. La
            cancelación tiene efecto al final del período mensual ya pagado. <b>No emitimos
            reembolsos parciales</b> por meses ya cobrados.
          </p>
          <p>
            Cuando cancelás, mantenemos tus datos durante 90 días por si querés reactivar la cuenta;
            pasado ese plazo, podemos eliminarlos definitivamente.
          </p>
          <p>
            Podés solicitar la eliminación inmediata y permanente de tu cuenta y sus datos desde la
            sección <b>Mi bar</b> del panel o escribiéndonos a{" "}
            <a href="mailto:igs.solucionesweb@gmail.com" style={{ color: IGS.accent }}>
              igs.solucionesweb@gmail.com
            </a>
            .
          </p>
        </Section>

        <Section title="6. Propiedad de los datos">
          <p>
            Todo el contenido que cargues en el Servicio (carta, precios, fotos, datos de tu equipo,
            historial de pedidos, datos de contacto del bar) <b>te pertenece a vos</b>. IGS lo
            procesa únicamente para prestarte el Servicio.
          </p>
          <p>
            Vos sos responsable de obtener los consentimientos necesarios de tus empleados y
            clientes finales antes de cargar sus datos al Servicio, según la Ley 25.326 de
            Protección de Datos Personales.
          </p>
        </Section>

        <Section title="7. Propiedad intelectual de IGS">
          <p>
            El software, la marca IGS, el diseño del panel, los logos y todo el contenido propio de
            IGS son propiedad de IGS Soluciones Web. Tu suscripción te otorga una licencia limitada,
            no exclusiva y revocable para usar el Servicio, pero no te transfiere ningún derecho
            sobre el software ni la marca.
          </p>
        </Section>

        <Section title="8. Usos prohibidos">
          <p>
            No podés usar el Servicio para:
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>Vender productos o servicios prohibidos por la legislación argentina.</li>
            <li>Cargar contenido ofensivo, discriminatorio o que infrinja derechos de terceros.</li>
            <li>Intentar acceder a datos de otros bares de la red IGS.</li>
            <li>Hacer ingeniería inversa, copiar o redistribuir el software de IGS.</li>
            <li>Generar carga abusiva sobre nuestra infraestructura (scraping, bots, ataques DoS).</li>
          </ul>
          <p>
            El incumplimiento puede resultar en suspensión inmediata de la cuenta sin reembolso.
          </p>
        </Section>

        <Section title="9. Limitación de responsabilidad">
          <p>
            IGS no se hace responsable por:
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>
              Pérdidas operativas del bar derivadas de fallas en el Servicio (caídas de internet,
              cortes en Supabase o MercadoPago, etc.).
            </li>
            <li>Errores u omisiones en la carga de datos por parte del Bar o su equipo.</li>
            <li>Cobros mal procesados por MercadoPago u otros proveedores externos.</li>
            <li>Disputas entre el Bar y sus clientes finales.</li>
          </ul>
          <p>
            En cualquier caso, la responsabilidad máxima de IGS hacia el Bar se limita al monto
            efectivamente pagado por el Bar en los últimos 3 meses.
          </p>
        </Section>

        <Section title="10. Modificaciones a estos Términos">
          <p>
            Podemos actualizar estos Términos a futuro. Te avisaremos por email y mostrando un aviso
            en el panel con al menos 30 días de anticipación cuando los cambios sean materiales. Si
            seguís usando el Servicio después de la fecha de entrada en vigencia, se considera que
            aceptaste los nuevos Términos.
          </p>
        </Section>

        <Section title="11. Jurisdicción y ley aplicable">
          <p>
            Estos Términos se rigen por las leyes de la República Argentina. Cualquier controversia
            será sometida a los tribunales ordinarios de la Ciudad de San Fernando del Valle de
            Catamarca, con renuncia expresa a cualquier otro fuero o jurisdicción.
          </p>
        </Section>

        <Section title="12. Contacto">
          <p>
            Si tenés preguntas sobre estos Términos, escribinos a{" "}
            <a href="mailto:igs.solucionesweb@gmail.com" style={{ color: IGS.accent }}>
              igs.solucionesweb@gmail.com
            </a>
            .
          </p>
        </Section>
      </main>

      <LegalFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, marginTop: 0, letterSpacing: -0.3 }}>
        {title}
      </h2>
      <div style={{ color: IGS.ink2 }}>{children}</div>
    </section>
  );
}
