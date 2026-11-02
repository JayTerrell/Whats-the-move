import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GoogleButton } from '../components/GoogleButton';
import { formatDay, formatTime } from '../lib/dates';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';

interface Preview {
  plan_id: string;
  date: string;
  entry_name: string;
  start_time: string | null;
  place_name: string | null;
  city: string | null;
  inviter: string | null;
  members: number;
  is_member: boolean;
}

export default function Invite() {
  const { token = '' } = useParams();
  const { user, authReady, acceptInvite, toast } = useStore();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    supabase.rpc('invite_preview', { invite_token: token }).then(({ data }) => setPreview((data as Preview) ?? null));
  }, [token, authReady, user]);

  if (preview === undefined) return null;
  if (preview === null) {
    return (
      <div className="signin">
        <h1 className="h2">This invite link isn't valid.</h1>
      </div>
    );
  }

  const first = preview.inviter?.split(' ')[0] ?? 'A friend';
  const where = [preview.place_name, preview.city].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');

  return (
    <div className="signin">
      <div className="poster" style={{ height: 260, borderRadius: 28, '--c': 'var(--coral)' } as React.CSSProperties}>
        <div className="p-top">
          <span className="badge">{first} invited you</span>
        </div>
        <div className="p-name" style={{ fontSize: 36 }}>
          {preview.entry_name}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 17 }}>
          {formatDay(preview.date)}
          {preview.start_time && ` · ${formatTime(preview.start_time.slice(0, 5))}`}
        </span>
        {where && <span className="muted">{where}</span>}
        <span className="muted">{preview.members} going</span>
      </div>
      {!user ? (
        <GoogleButton text="signin_with" />
      ) : preview.is_member ? (
        <button className="btn light block" onClick={() => navigate(`/plan/${preview.plan_id}`)}>
          Open the plan
        </button>
      ) : (
        <button
          className="btn primary block"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const id = await acceptInvite(token);
              navigate(`/plan/${id}`, { replace: true });
            } catch (e) {
              toast((e as Error).message);
              setBusy(false);
            }
          }}
        >
          Accept
        </button>
      )}
    </div>
  );
}
