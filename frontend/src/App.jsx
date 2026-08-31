import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import { TopNavbar, BottomNav } from './components/Layout/Navigation';

import DashboardPage from './pages/DashboardPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { DiseasePage, DiseaseHistoryPage } from './pages/DiseasePages';
import ChatPage from './pages/ChatPage';
import SchemesPage from './pages/SchemesPage';
import MandiPage from './pages/MandiPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

import './i18n';
import './styles/main.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <TopNavbar />
          
          <main style={{ flex: 1 }}>
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes */}
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/disease" element={<ProtectedRoute><DiseasePage /></ProtectedRoute>} />
              <Route path="/disease/history" element={<ProtectedRoute><DiseaseHistoryPage /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
              <Route path="/schemes" element={<ProtectedRoute><SchemesPage /></ProtectedRoute>} />
              <Route path="/mandi" element={<ProtectedRoute><MandiPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>

          <BottomNav />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
