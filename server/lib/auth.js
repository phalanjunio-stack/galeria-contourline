// Auth Google: troca refresh_token por access_token sob demanda
// Replica a logica do projeto Next.js (auth.ts)

let cache = { token: null, expiresAt: 0 };

export async function getAccessToken() {
  const agora = Math.floor(Date.now() / 1000);
  if (cache.token && cache.expiresAt > agora + 60) {
    return cache.token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltam env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao renovar token Google: ${res.status} ${txt}`);
  }

  const data = await res.json();
  cache = {
    token: data.access_token,
    expiresAt: agora + (data.expires_in ?? 3600),
  };
  return cache.token;
}
