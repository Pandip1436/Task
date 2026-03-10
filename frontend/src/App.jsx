import { Routes, Route } from "react-router-dom";
import ProjectsPage from "./pages/ProjectsPage";
import BoardsPage from "./pages/BoardsPage";
import TasksPage from "./pages/TasksPage";
import Loginpage from "./pages/Loginpage";
import Signuppage from "./pages/Signuppage";
import DashboardPage from './pages/DashboardPage';
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export default function App() {
        // console.log(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  return (
    <div className="min-h-screen bg-gray-100">
      
      {/* Navbar */}
      <div className="bg-blue-600 text-white p-4 text-xl font-bold">
        Project Board App
      </div>

      {/* Routes */}
      <Routes>
        <Route path="/login" element={<Loginpage/>} />
        <Route path="/signup" element={<Signuppage/>} />
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<BoardsPage />} />
         <Route path="/boards/:boardId" element={<TasksPage />} />
         <Route path="/forgot-password" element={<ForgotPassword />} />
         <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Routes>
    </div>
  );
}
