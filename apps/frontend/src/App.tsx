import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { Candidates } from './pages/Candidates';
import { Login } from './pages/Login';
import InterviewViewPage from './pages/InterviewView';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted max-w-lg">
      {title} — coming soon.
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/interview" element={<InterviewViewPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="candidates" element={<Candidates />} />
            <Route path="inbox" element={<Placeholder title="Inbox" />} />
            <Route path="calendar" element={<Placeholder title="Calendar" />} />
            <Route path="attendance" element={<Placeholder title="Attendance" />} />
            <Route path="performance" element={<Placeholder title="Performance" />} />
            <Route path="settings" element={<Placeholder title="Settings" />} />
            <Route path="*" element={<Placeholder title="Page not found" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
