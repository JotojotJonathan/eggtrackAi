import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // Redirect based on role
  switch (user.role) {
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'WORKER':
      return <Navigate to="/worker" replace />;
    case 'BUYER':
      return <Navigate to="/buyer" replace />;
    case 'DELIVERY':
      return <Navigate to="/delivery" replace />;
    default:
      return <Navigate to="/worker" replace />;
  }
};

export default Dashboard;