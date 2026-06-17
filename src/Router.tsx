import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Login } from "@/pages/login/Login";
import { ProtectedRoute } from "@/ProtectedRoute";
import {DashboardPage} from "@/pages/dashboard/DashboardPage";
import {PMLEditorPage} from "@/pages/pml/PMLEditorPage";
import {Dashboard2Page} from "@/pages/dashboard2/Dashboard2Page";

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/pml',
    element: <PMLEditorPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'dashboard2',
        element: <Dashboard2Page />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);

export function Router() {
  return <RouterProvider router={router} />;
}
