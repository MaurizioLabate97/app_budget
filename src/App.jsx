import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/layout';
import Dashboard from './pages/dashboard';
import Transactions from './pages/transactions';
import Categories from './pages/categories';
import Budgets from './pages/budgets';
import BankAccounts from './pages/bankaccount';
import More from './pages/more';
import Recurring from './pages/recurring';
import PageNotFound from './lib/pagenotfound';

// Le statistiche si caricano solo quando servono: recharts e i calcoli restano fuori dal bundle iniziale.
const Stats = lazy(() => import('./pages/stats'));

const pageSpinner = (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/bank" element={<BankAccounts />} />
            <Route path="/more" element={<More />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/stats" element={<Suspense fallback={pageSpinner}><Stats /></Suspense>} />
            <Route path="*" element={<PageNotFound />} />
          </Route>
        </Routes>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
