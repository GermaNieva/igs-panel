import Link from "next/link";
import IGSLogo from "@/components/ui/IGSLogo";
import { IGS } from "@/lib/tokens";
import LegalFooter from "@/components/LegalFooter";

export const metadata = {
  title: "Política de Privacidad — IGS Panel",
};

const LAST_UPDATE = "29 de abril de 2026";

export default function PrivacidadPage() {
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
          Política de Privacidad
        </h1>

        <p>
          Esta Política describe cómo <b>IGS Soluciones Web</b> (en adelante, <b>&quot;IGS&quot;</b>,{" "}
          <b>&quot;nosotros&quot;</b>) trata los datos personales que nos confiás cuando usás IGS
          Panel (el <b>&quot;Servicio&quot;</b>). Cumple con la <b>Ley 25.326 de Protección de Datos
          Personales</b> de la República Argentina y su decreto reglamentario.
        </p>

        <Section title="1. Responsable del tratamiento">
          <p>
            El responsable del tratamiento de tus datos personales es:
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li><b>Razón social:</b> IGS Soluciones Web</li>
            <li><b>Domicilio:</b> Catamarca, Argentina</li>
            <li>
              <b>Email de contacto:</b>{" "}
              <a href="mailto:igs.solucionesweb@gmail.com" style={{ color: IGS.accent }}>
                igs.solucionesweb@gmail.com
              </a>
            </li>
          </ul>
        </Section>

        <Section title="2. Qué datos recolectamos">
          <p>Tratamos los siguientes datos personales:</p>
          <p style={{ marginTop: 10, fontWeight: 600 }}>De los dueños y staff de cada bar:</p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>Email, nombre completo y rol asignado.</li>
            <li>Contraseña hasheada (nunca tenemos acceso a tu contraseña en texto plano).</li>
            <li>Email de pago de MercadoPago (si lo configurás).</li>
            <li>Logs de actividad: último ingreso, navegador, dirección IP.</li>
          </ul>
          <p style={{ marginTop: 10, fontWeight: 600 }}>De los clientes finales del bar (cuando escanean el QR de la mesa):</p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>Dirección IP (para rate-limiting).</li>
            <li>Items pedidos, mesa y horario del pedido.</li>
            <li>Notas que el cliente agregue al pedido (alergias, preferencias).</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            <b>No recolectamos</b> nombre, email, teléfono ni datos de tarjetas de los clientes
            finales del bar — el cobro lo gestiona el mozo del bar fuera de IGS.
          </p>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          <p>Usamos tus datos para:</p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>Prestarte el Servicio (autenticarte, mostrar tu carta, procesar pedidos, cobrar la suscripción).</li>
            <li>Comunicarnos con vos sobre cuestiones operativas (avisos de pago, cambios en el Servicio).</li>
            <li>Cumplir con obligaciones legales (facturación, requerimientos judiciales).</li>
            <li>Mejorar el Servicio (analizar uso agregado, sin perfilamiento individual).</li>
          </ul>
          <p>
            <b>No usamos tus datos para publicidad</b> y <b>no los vendemos a terceros</b>.
          </p>
        </Section>

        <Section title="4. Con quién compartimos tus datos">
          <p>
            Para prestar el Servicio nos apoyamos en proveedores que actúan como <i>encargados del
            tratamiento</i> bajo nuestras instrucciones:
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>
              <b>Supabase Inc.</b> — base de datos y autenticación. Servidores en San Pablo,
              Brasil. Política de privacidad:{" "}
              <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: IGS.accent }}>
                supabase.com/privacy
              </a>
            </li>
            <li>
              <b>MercadoPago (DH SA)</b> — procesamiento de cobros mensuales. Política:{" "}
              <a href="https://www.mercadopago.com.ar/ayuda/terminos-y-politicas_299" target="_blank" rel="noopener noreferrer" style={{ color: IGS.accent }}>
                política de privacidad de MercadoPago
              </a>
            </li>
            <li>
              <b>Netlify Inc.</b> — hosting de la aplicación. Política:{" "}
              <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener noreferrer" style={{ color: IGS.accent }}>
                netlify.com/privacy
              </a>
            </li>
          </ul>
          <p>
            Solo compartimos los datos estrictamente necesarios para que cada proveedor pueda
            cumplir su función. Estos proveedores están obligados contractualmente a confidencialidad.
          </p>
          <p>
            <b>Transferencia internacional:</b> los datos se almacenan en servidores ubicados fuera
            de Argentina (principalmente en Brasil y Estados Unidos). Estos países garantizan
            niveles de protección adecuados según la AAIP.
          </p>
        </Section>

        <Section title="5. Cuánto tiempo conservamos tus datos">
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>
              <b>Mientras tengas cuenta activa:</b> mantenemos los datos del bar y su staff para
              prestar el Servicio.
            </li>
            <li>
              <b>Después de cancelar la cuenta:</b> los conservamos por 90 días en caso de
              reactivación. Pasado ese plazo, los eliminamos.
            </li>
            <li>
              <b>Pedidos de clientes finales:</b> se mantienen durante toda la vida de la cuenta del
              bar para uso histórico (reportes, ranking de platos). El bar puede eliminarlos en
              cualquier momento desde su panel.
            </li>
            <li>
              <b>Datos contables (facturas, pagos):</b> los conservamos por <b>10 años</b> según
              exige la legislación argentina.
            </li>
          </ul>
        </Section>

        <Section title="6. Tus derechos (ARCO)">
          <p>
            Como titular de los datos, tenés derecho a (Ley 25.326, art. 14 a 16):
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li><b>Acceso:</b> saber qué datos tenemos sobre vos.</li>
            <li><b>Rectificación:</b> pedir que corrijamos datos inexactos.</li>
            <li><b>Cancelación:</b> pedir la eliminación de tus datos.</li>
            <li><b>Oposición:</b> oponerte a usos específicos de tus datos.</li>
          </ul>
          <p>
            Para ejercer cualquiera de estos derechos, escribinos a{" "}
            <a href="mailto:igs.solucionesweb@gmail.com" style={{ color: IGS.accent }}>
              igs.solucionesweb@gmail.com
            </a>{" "}
            indicando tu nombre, email registrado y el derecho que querés ejercer. Te respondemos en
            un máximo de <b>10 días hábiles</b>.
          </p>
          <p>
            También podés borrar inmediatamente tu cuenta y todos sus datos desde la sección{" "}
            <b>Mi bar</b> del panel.
          </p>
          <p>
            Si considerás que no tratamos tus datos correctamente, podés presentar un reclamo ante
            la <b>Agencia de Acceso a la Información Pública</b>:{" "}
            <a href="https://www.argentina.gob.ar/aaip" target="_blank" rel="noopener noreferrer" style={{ color: IGS.accent }}>
              argentina.gob.ar/aaip
            </a>
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            Protegemos tus datos con medidas técnicas estándar de la industria:
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li>Cifrado HTTPS en todas las comunicaciones.</li>
            <li>Contraseñas almacenadas con hash bcrypt (no recuperables).</li>
            <li>Tokens de sesión firmados criptográficamente.</li>
            <li>Aislamiento multi-tenant: cada bar solo puede ver sus propios datos.</li>
            <li>Backups automáticos diarios.</li>
          </ul>
          <p>
            Ninguna medida es 100% infalible. Si detectamos una vulneración de seguridad que afecte
            tus datos, te avisaremos por email dentro de las 72 hs según exige la normativa.
          </p>
        </Section>

        <Section title="8. Cookies y tecnologías similares">
          <p>
            Usamos cookies estrictamente necesarias para el funcionamiento del Servicio:
          </p>
          <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
            <li><b>Sesión de autenticación</b> (Supabase Auth) — para mantenerte logueado.</li>
          </ul>
          <p>
            <b>No usamos cookies de publicidad ni de seguimiento de terceros.</b> Si en el futuro
            agregamos analytics, te lo informaremos y pediremos consentimiento previo.
          </p>
        </Section>

        <Section title="9. Menores de edad">
          <p>
            El Servicio está dirigido a personas mayores de 18 años. No recolectamos
            intencionalmente datos de menores. Si descubrimos que un menor creó una cuenta sin
            autorización, la eliminamos.
          </p>
        </Section>

        <Section title="10. Cambios en esta Política">
          <p>
            Podemos actualizar esta Política a futuro. Te avisaremos por email y mostrando un aviso
            en el panel cuando haya cambios materiales.
          </p>
        </Section>

        <Section title="11. Contacto">
          <p>
            Cualquier consulta sobre privacidad podés escribirnos a{" "}
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
