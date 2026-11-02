import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav, Toast } from './components/ui';
import { useStore } from './lib/store';
import CalendarScreen from './screens/Calendar';
import EntryForm from './screens/EntryForm';
import EntryScreen from './screens/Entry';
import Home from './screens/Home';
import Invite from './screens/Invite';
import { ListScreen, ListsScreen } from './screens/Lists';
import PlanScreen from './screens/Plan';
import Saved from './screens/Saved';
import SignIn from './screens/SignIn';
import TypesScreen from './screens/Types';

// Google Maps only loads when the Map tab opens.
const MapScreen = lazy(() => import('./screens/Map'));

const TABS = ['/', '/calendar', '/map', '/saved'];

export default function App() {
  const { user, authReady, loaded, takeReturnPath } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const back = takeReturnPath();
    if (back && back !== location.pathname) navigate(back, { replace: true });
  }, [user, takeReturnPath, navigate, location.pathname]);

  // Invite links work before signing in.
  if (location.pathname.startsWith('/i/')) {
    return (
      <div className="app bare">
        <Routes>
          <Route path="/i/:token" element={<Invite />} />
        </Routes>
        <Toast />
      </div>
    );
  }

  if (!authReady) return null;
  if (!user) return <SignIn />;
  if (!loaded) return <div className="app" />;

  const showNav = TABS.includes(location.pathname);
  return (
    <div className={`app ${showNav ? '' : 'bare'}`}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route
          path="/map"
          element={
            <Suspense fallback={null}>
              <MapScreen />
            </Suspense>
          }
        />
        <Route path="/saved" element={<Saved />} />
        <Route path="/new" element={<EntryForm />} />
        <Route path="/share" element={<EntryForm />} />
        <Route path="/entry/:id" element={<EntryScreen />} />
        <Route path="/entry/:id/edit" element={<EntryForm />} />
        <Route path="/plan/:id" element={<PlanScreen />} />
        <Route path="/lists" element={<ListsScreen />} />
        <Route path="/lists/:id" element={<ListScreen />} />
        <Route path="/types" element={<TypesScreen />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {showNav && <BottomNav />}
      <Toast />
    </div>
  );
}
