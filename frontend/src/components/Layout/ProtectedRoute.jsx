import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../UI/StateComponents';

export default function ProtectedRoute({ children }) {
  const { farmer, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!farmer) return <Navigate to="/login" replace />;
  return children;
}
