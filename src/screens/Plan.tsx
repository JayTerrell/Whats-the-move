import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Back, EntryRow, Sheet } from '../components/ui';
import { formatDay } from '../lib/dates';
import { useStore } from '../lib/store';

export default function PlanScreen() {
  const { id } = useParams();
  const { plans, profile, inviteLink, toggleAttend, toast } = useStore();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const plan = plans.find((p) => p.id === id);
  if (!plan || !plan.stops.length) {
    return (
      <div className="screen">
        <Back to="/" />
        <p className="empty">This plan isn't on your calendar.</p>
      </div>
    );
  }
  const first = plan.stops[0].entry;
  const alone = plan.members.length <= 1;

  const invite = async () => {
    try {
      const url = await inviteLink(first, plan.date);
      if (navigator.share) await navigator.share({ title: first.name, text: `${first.name} · ${formatDay(plan.date)}`, url }).catch(() => {});
      else {
        await navigator.clipboard.writeText(url);
        toast('Invite link copied');
      }
    } catch (e) {
      toast((e as Error).message);
    }
  };

  return (
    <div className="screen enter">
      <div className="row">
        <Back />
      </div>
      <h1 className="h2">{formatDay(plan.date)}</h1>
      <div className="stack">
        {plan.stops.map((s) => (
          <EntryRow key={s.id} entry={s.entry} date={plan.date} attend={false} />
        ))}
      </div>
      <section className="stack">
        <span className="label">Going</span>
        {plan.members.map((m) => (
          <div key={m.user_id} className="row">
            <Avatar name={m.name} url={m.avatar_url} size="sm" />
            <span>{m.user_id === profile?.id ? 'You' : m.name}</span>
          </div>
        ))}
      </section>
      <div className="two">
        <button className="btn light" onClick={invite}>
          Invite
        </button>
        <button className="btn" onClick={() => setLeaving(true)}>
          {alone ? 'Not going' : 'Leave'}
        </button>
      </div>
      {leaving && (
        <Sheet onClose={() => setLeaving(false)}>
          <h2 className="h3">{alone ? `Take ${first.name} off ${formatDay(plan.date)}?` : 'Leave this plan?'}</h2>
          <div className="two">
            <button className="btn" onClick={() => setLeaving(false)}>
              Keep
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  await toggleAttend(first, plan.date);
                  navigate('/calendar', { replace: true });
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              {alone ? 'Remove' : 'Leave'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
