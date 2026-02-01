import Dashboard from './Dashboard';

const Index = () => {
  // Simply render the Dashboard - no auto-redirect
  // The useLastRoute hook in MainLayout handles saving the current route
  return <Dashboard />;
};

export default Index;
