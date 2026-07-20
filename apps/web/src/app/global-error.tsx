"use client";

import { useEffect } from "react";

import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort error boundary: replaces the root layout when a render throws, so
 * it must render its own <html>/<body>. Reports to Sentry (no-op without a DSN)
 * and shows a neutral message — it renders outside the i18n provider, so the
 * copy is a plain pt-BR string.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h2>Algo deu errado.</h2>
        <p>Tente recarregar a página. Se o problema continuar, fale com o suporte.</p>
      </body>
    </html>
  );
}
