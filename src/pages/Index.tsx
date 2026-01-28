import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard';

const LAST_ROUTE_KEY = 'circuito-last-route';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
    
    if (lastRoute && lastRoute !== '/') {
      navigate(lastRoute, { replace: true });
    }
  }, [navigate]);

  return <Dashboard />;
};

export default Index;
