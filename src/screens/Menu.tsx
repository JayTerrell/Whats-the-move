import { Link } from 'react-router-dom';
import { Sheet } from '../components/ui';
import { useStore } from '../lib/store';

export default function Menu({ onClose }: { onClose: () => void }) {
  const { profile, user, lists, signOut } = useStore();
  return (
    <Sheet onClose={onClose}>
      <div className="stack" style={{ gap: 2 }}>
        <h2 className="h3">{profile?.name ?? 'You'}</h2>
        <span className="muted small">{user?.email}</span>
      </div>
      <div className="menu">
        <Link to="/lists" onClick={onClose}>
          Your lists <span className="muted">{lists.length}</span>
        </Link>
        <Link to="/types" onClick={onClose}>
          Event types <span className="muted">›</span>
        </Link>
        <button onClick={() => signOut()}>Sign out</button>
      </div>
    </Sheet>
  );
}
