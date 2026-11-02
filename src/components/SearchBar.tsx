import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';

export function SearchBar({ value, onChange, onFilter, autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  onFilter: () => void;
  autoFocus?: boolean;
}) {
  const { filter } = useStore();
  return (
    <div className="searchrow">
      <label className="search">
        <input
          type="search"
          placeholder="Search your places and plans"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Search"
        />
        <button type="button" className={`filter-btn ${filter.size ? 'on' : ''}`} onClick={onFilter}>
          {filter.size ? `Filter · ${filter.size}` : 'Filter'}
        </button>
      </label>
      <Link to="/new" className="add-btn" aria-label="Add">
        +
      </Link>
    </div>
  );
}
