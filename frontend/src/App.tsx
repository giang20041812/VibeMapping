import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { CustomerListPage } from './modules/customer/pages/CustomerListPage';

export const App: React.FC = () => {
  return (
    <AppLayout>
      <CustomerListPage />
    </AppLayout>
  );
};

export default App;
