import { useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
let script: Promise<void> | null = null;

const loadGoogle = () =>
  (script ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Google sign-in didn't load"));
    document.head.appendChild(s);
  }));

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Google's own button, signed in on this site and handed to Supabase, so Google
 * shows the app's address rather than the database's. Falls back to a redirect
 * when no client ID is configured.
 */
export function GoogleButton({ text = 'continue_with' }: { text?: 'continue_with' | 'signin_with' }) {
  const ref = useRef<HTMLDivElement>(null);
  const { signIn, toast } = useStore();

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    (async () => {
      await loadGoogle();
      const nonce = crypto.randomUUID();
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: await sha256(nonce),
        callback: async ({ credential }) => {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
          if (error) toast(error.message);
        },
      });
      if (cancelled || !ref.current) return;
      google.accounts.id.renderButton(ref.current, {
        theme: 'filled_black',
        shape: 'pill',
        size: 'large',
        text,
        width: Math.min(ref.current.offsetWidth, 400),
      });
    })().catch((e) => toast(e.message));
    return () => {
      cancelled = true;
    };
  }, [text, toast]);

  if (!CLIENT_ID) {
    return (
      <button className="btn light block" onClick={() => signIn()}>
        Continue with Google
      </button>
    );
  }
  return <div ref={ref} style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }} />;
}
