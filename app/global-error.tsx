"use client";

import ErrorPage from "./error";

export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body>
        <ErrorPage {...props} />
      </body>
    </html>
  );
}
