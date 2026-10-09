// Real "Continue with Google": Google Identity Services opens Google's own account chooser, and
// the name and email come from the Google account the person signs in with.
//
// Needs a Google OAuth Client ID in VITE_GOOGLE_CLIENT_ID (.env.local), with this site's address
// (e.g. http://localhost:5173) under "Authorized JavaScript origins" in Google Cloud Console.
// Without one, isGoogleConfigured() is false and the app keeps its demo account list.
//
// Note: this reads the profile in the browser. When there's a server, it should also check the
// Google token itself before trusting the email.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT = "https://accounts.google.com/gsi/client";

export interface GoogleProfile {
  name: string;
  email: string;
  picture?: string;
  emailVerified: boolean;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleAccounts {
  oauth2: {
    initTokenClient(config: { client_id: string; scope: string; prompt?: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }): { requestAccessToken(): void };
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

export const isGoogleConfigured = () => !!CLIENT_ID;

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Couldn't reach Google. Check your internet connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Opens Google's account chooser and returns the chosen account's name and email. */
export async function signInWithGoogle(): Promise<GoogleProfile> {
  if (!CLIENT_ID) throw new Error("Google sign-in isn't set up yet");
  await loadScript();
  const token = await new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "openid email profile",
      prompt: "select_account",
      callback: (r) => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error_description || "Google sign-in didn't finish"))),
      error_callback: (e) => reject(new Error(e.type === "popup_closed" ? "Google sign-in was closed before finishing" : e.type === "popup_failed_to_open" ? "Your browser blocked the Google window. Allow pop-ups for this site and try again." : "Google sign-in didn't finish")),
    });
    client.requestAccessToken();
  });
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Couldn't read your Google profile. Try again.");
  const p = (await res.json()) as { name?: string; email?: string; picture?: string; email_verified?: boolean };
  if (!p.email) throw new Error("Google didn't share an email address");
  return { name: p.name ?? p.email.split("@")[0]!, email: p.email, picture: p.picture, emailVerified: !!p.email_verified };
}
