import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Back, EntryRow, Sheet } from '../components/ui';
import { useStore } from '../lib/store';

export function ListsScreen() {
  const { lists, createList, toast } = useStore();
  const [name, setName] = useState('');
  return (
    <div className="screen enter">
      <div className="row">
        <Back />
        <h1 className="h2">Lists</h1>
      </div>
      <div className="stack">
        {lists.map((l) => (
          <Link key={l.id} to={`/lists/${l.id}`} className="rowcard">
            <span className="grow name">{l.name}</span>
            <span className="muted">{l.entry_ids.length}</span>
          </Link>
        ))}
      </div>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          try {
            await createList(name);
            setName('');
          } catch (err) {
            toast((err as Error).message);
          }
        }}
      >
        <input className="input grow" placeholder="New list" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn light" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}

export function ListScreen() {
  const { id } = useParams();
  const { lists, entries, renameList, deleteList, toast } = useStore();
  const navigate = useNavigate();
  const list = lists.find((l) => l.id === id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list?.name ?? '');
  if (!list) {
    return (
      <div className="screen">
        <Back to="/lists" />
      </div>
    );
  }
  const items = entries.filter((e) => list.entry_ids.includes(e.id));
  return (
    <div className="screen enter">
      <div className="row spread">
        <Back />
        <button className="chip" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
      <h1 className="h2">{list.name}</h1>
      <div className="stack">
        {items.map((e) => (
          <EntryRow key={e.id} entry={e} attend={false} />
        ))}
      </div>
      {editing && (
        <Sheet onClose={() => setEditing(false)}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn light"
            disabled={!name.trim()}
            onClick={async () => {
              await renameList(list.id, name).catch((e) => toast(e.message));
              setEditing(false);
            }}
          >
            Rename
          </button>
          <button
            className="btn danger"
            onClick={async () => {
              await deleteList(list.id).catch((e) => toast(e.message));
              navigate('/lists', { replace: true });
            }}
          >
            Delete list
          </button>
        </Sheet>
      )}
    </div>
  );
}
