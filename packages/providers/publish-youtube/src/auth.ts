/**
 * One-shot OAuth helper. Prints a consent URL, catches the loopback redirect,
 * and prints a refresh token. It does not write .env.
 *
 * The Google OAuth client needs this redirect URI:
 *   http://127.0.0.1:8765/callback
 */
import { createServer } from "node:http";

const PORT = 8765;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
// videos.update (publish, schedule) needs the full youtube scope; youtube.upload only covers insert.
const SCOPES = ["https://www.googleapis.com/auth/youtube"].join(" ");

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET, then run this again.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("scope", SCOPES);

console.log(`Add this redirect URI to the OAuth client if it is not there yet:\n  ${REDIRECT}\n`);
console.log("Open this URL and approve access:\n");
console.log(authUrl.toString());
console.log("\nWaiting for the redirect…");

const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", REDIRECT);
    if (url.pathname !== "/callback") {
      res.statusCode = 404;
      res.end();
      return;
    }
    const err = url.searchParams.get("error");
    const next = url.searchParams.get("code");
    if (err || !next) {
      res.end("Authorization failed. You can close this tab.");
      server.close();
      reject(new Error(err ?? "missing code"));
      return;
    }
    res.end("Refresh token will be printed in the terminal. You can close this tab.");
    server.close();
    resolve(next);
  });
  server.listen(PORT, "127.0.0.1");
  setTimeout(() => {
    server.close();
    reject(new Error("timed out waiting for the OAuth redirect"));
  }, 5 * 60 * 1000).unref();
});

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});
const token = (await tokenRes.json()) as { refresh_token?: string; error?: string; error_description?: string };
if (!tokenRes.ok || !token.refresh_token) {
  console.error(token.error_description ?? token.error ?? `token exchange failed (${tokenRes.status})`);
  console.error("If Google omitted refresh_token, revoke the app's access and run this again.");
  process.exit(1);
}

console.log("\nAdd this to .env (it is not written for you):\n");
console.log(`YOUTUBE_REFRESH_TOKEN=${token.refresh_token}`);
