# What's the Move

A personal social calendar for Dallas–Fort Worth: save events and places from anywhere, see what's on by day and on a map, and plan with friends.

React + Vite on Vercel, Supabase for sign-in and data, Google Maps for the map, OpenStreetMap for address lookups.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in the four values
npm run dev                   # http://localhost:5173
npm test                      # repeat rules and share parsing
```

## Layout

| Path | What |
| --- | --- |
| `supabase/schema.sql` | Tables, default event types, row level security, invite functions |
| `supabase/updates/` | Changes to run on an existing project, in order |
| `src/lib/store.tsx` | Loads your data and every change you make |
| `src/lib/recurrence.ts` | Plain-English repeat rules ("1st & 3rd Friday") |
| `src/lib/schedule.ts` | What's on a given day, and what needs details |
| `src/lib/places.ts` | Place search: saved places, then OpenStreetMap |
| `src/lib/share.ts` | Reads what Android's share sheet sends |
| `src/screens/` | Home, Calendar, Map, Saved, Entry, the form, Plan, Invite, Lists, Event types |
| `public/manifest.webmanifest` | Install to home screen and appear in the share sheet |

Words used everywhere: entry, place, event type, family, list, plan.
