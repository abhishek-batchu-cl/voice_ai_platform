import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ApiKeySetup from './pages/ApiKeySetup';
import Dashboard from './pages/Dashboard';
import AssistantsList from './pages/AssistantsList';
import AssistantBuilder from './pages/AssistantBuilder';
import TestChat from './pages/TestChat';
import PhoneNumbers from './pages/PhoneNumbers';
import Calls from './pages/Calls';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/setup" element={<ApiKeySetup />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="assistants" element={<AssistantsList />} />
              <Route path="assistants/new" element={<AssistantBuilder />} />
              <Route path="assistants/:id" element={<AssistantBuilder />} />
              <Route path="test/:assistantId" element={<TestChat />} />
              <Route path="phone-numbers" element={<PhoneNumbers />} />
              <Route path="calls" element={<Calls />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
