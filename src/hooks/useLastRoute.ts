import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const LAST_ROUTE_KEY = 'circuito-last-route';

// Rotas que não devem ser salvas (públicas/auth)
const EXCLUDED_ROUTES = [
  '/auth',
  '/assinar',
  '/pre-matricula',
  '/campanha',
  '/cantina',
  '/instalar',
  '/professor-login',
];

export function useLastRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  // Salvar rota atual no localStorage
  useEffect(() => {
    const currentPath = location.pathname;
    
    // Não salvar rotas excluídas
    const isExcluded = EXCLUDED_ROUTES.some(route => 
      currentPath.startsWith(route)
    );
    
    if (!isExcluded && currentPath !== '/') {
      localStorage.setItem(LAST_ROUTE_KEY, currentPath);
    }
  }, [location.pathname]);

  return null;
}

export function useRestoreLastRoute() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Só redirecionar se estiver na página inicial
    if (location.pathname === '/') {
      const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
      
      if (lastRoute && lastRoute !== '/') {
        navigate(lastRoute, { replace: true });
      }
    }
  }, []); // Executar apenas uma vez no mount
}

export function clearLastRoute() {
  localStorage.removeItem(LAST_ROUTE_KEY);
}
