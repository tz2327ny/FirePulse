import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
        <Outlet />
      </main>
    </div>
  );
}
