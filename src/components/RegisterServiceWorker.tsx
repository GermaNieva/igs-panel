"use client";
import { useEffect } from "react";

// Registra el Service Worker (definido en /public/sw.js).
// Solo en producción — en dev el SW puede confundir al HMR de Next.
export default function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        // Forzar update check al cargar — útil si el user dejó la pestaña
        // abierta y deployamos algo nuevo.
        reg.update();
      } catch (e) {
        console.warn("[sw] registro falló:", e);
      }
    };
    register();
  }, []);

  return null;
}
