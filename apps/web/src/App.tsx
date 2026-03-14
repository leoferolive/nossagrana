import { Route, Routes } from 'react-router-dom';

import { PrivateRoute } from '@/components/PrivateRoute';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

const HomePage = () => (
  <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-10">
    <header className="rounded-2xl bg-teal-700 p-6 text-slate-100 shadow-lg">
      <p className="text-sm uppercase tracking-wide">NossaGrana</p>
      <h1 className="mt-2 text-3xl font-bold">Bem-vindo!</h1>
    </header>
  </main>
);

export const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <HomePage />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};
