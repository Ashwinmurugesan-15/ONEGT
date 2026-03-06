import { useAuth } from './context/AuthContext';
import ExaminerDashboard from './pages/ExaminerDashboard';
import CandidateDashboard from './pages/CandidateDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { Loader2 } from 'lucide-react';

export default function AssessmentDashboardSwitcher() {
    const { user, isAuthenticated } = useAuth();

    if (!isAuthenticated || !user) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-amber-600 mb-4" size={48} />
                <p className="text-gray-500 font-medium">Verifying access...</p>
            </div>
        );
    }

    if (user.role === 'admin' || user.role === 'super_admin') {
        return <AdminDashboard />;
    }

    if (user.role === 'hiring_manager' || user.role === 'interviewer' || user.role === 'examiner') {
        return <ExaminerDashboard />;
    }

    return <CandidateDashboard />;
}
