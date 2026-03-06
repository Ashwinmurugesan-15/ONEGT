import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Users,
    Briefcase,
    GraduationCap,
    ClipboardCheck,
    LayoutDashboard,
    FolderKanban,
    CalendarDays,
    Clock,
    Wallet,
    Package,
    Building2,
    FileText,
    Receipt,
    DollarSign,
    User,
    UserPlus,
    Target,
    TrendingUp,
    BookOpen,
    Award,
    UserCheck,
    FileQuestion,
    BarChart3,
    Contact,
    Handshake,
    Phone,
    Palette,
    Star,
    Settings,
    Shield
} from 'lucide-react';

// Capability configurations
export const CAPABILITIES = {
    HRMS: {
        id: 'HRMS',
        name: 'HRMS',
        fullName: 'People Management',
        icon: Users,
        color: '#3b82f6', // blue
        description: 'Manage associates, payroll, and HR operations',
        roles: [] // Available to all users
    },
    CRMS: {
        id: 'CRMS',
        name: 'CRMS',
        fullName: 'Customer Relationship Management',
        icon: Briefcase,
        color: '#10b981', // green
        description: 'Manage customers, leads, and sales',
        roles: ['Admin', 'Marketing Manager', 'Operations Manager'] // Admin, Marketing Manager, and Operations Manager
    },
    TalentManagement: {
        id: 'TalentManagement',
        name: 'Talent Mgmt',
        fullName: 'Talent Management',
        icon: GraduationCap,
        color: '#8b5cf6', // purple
        description: 'Recruitment, training, and performance',
        roles: [] // Available to all users
    },
    AssessmentPortal: {
        id: 'AssessmentPortal',
        name: 'Assessment',
        fullName: 'Assessment Portal',
        icon: ClipboardCheck,
        color: '#f59e0b', // amber
        description: 'Conduct assessments and evaluations',
        roles: [] // Available to all users
    },
    PMS: {
        id: 'PMS',
        name: 'PMS',
        fullName: 'Performance Management',
        icon: Award,
        color: '#8b5cf6', // purple
        description: 'Appraisals, goal setting, and performance reviews',
        roles: [] // Available to all users
    }
};

// Menu configurations for each capability
export const CAPABILITY_MENUS = {
    HRMS: [
        {
            section: 'Overview', items: [
                { to: '/hrms', icon: LayoutDashboard, label: 'Dashboard', end: true }
            ]
        },
        {
            section: 'HR Management', items: [
                { to: '/hrms/associates', icon: Users, label: 'Associates', roles: ['Admin', 'Project Manager', 'HR', 'Operations Manager'] },
                { to: '/hrms/payroll', icon: Wallet, label: 'Payroll', roles: ['Admin'] },
                { to: '/hrms/assets', icon: Package, label: 'Asset Management', dynamicLabel: true },
                { to: '/hrms/org-chart', icon: Users, label: 'Org Chart' }
            ]
        },
        {
            section: 'Projects', items: [
                { to: '/hrms/projects', icon: FolderKanban, label: 'Projects', roles: ['Admin', 'Project Manager'] },
                { to: '/hrms/allocations', icon: CalendarDays, label: 'Allocations' },
                { to: '/hrms/timesheets', icon: Clock, label: 'Timesheets' },
                { to: '/hrms/leaves', icon: CalendarDays, label: 'Leaves' }
            ]
        },
        {
            section: 'Finance', roles: ['Admin'], items: [
                { to: '/hrms/expenses', icon: Receipt, label: 'Expenses' },
                { to: '/hrms/currency', icon: DollarSign, label: 'Currency Rates' }
            ]
        },
        {
            section: 'My Profile', items: [
                { to: '/hrms/profile', icon: User, label: 'Personal Info' },
                { to: '/hrms/paystructure', icon: DollarSign, label: 'Pay Structure' }
            ]
        }
    ],
    CRMS: [
        {
            section: 'Overview', items: [
                { to: '/crms', icon: LayoutDashboard, label: 'Dashboard', end: true }
            ]
        },
        {
            section: 'Sales', items: [
                { to: '/crms/leads', icon: UserPlus, label: 'Leads' },
                { to: '/crms/opportunities', icon: Target, label: 'Opportunities' },
                { to: '/crms/deals', icon: Handshake, label: 'Deals', excludeDesignations: ['Marketing Manager', 'Operations Manager'] }
            ]
        },
        {
            section: 'Customers', items: [
                { to: '/crms/customers', icon: Building2, label: 'Customers' },
                { to: '/crms/contacts', icon: Contact, label: 'Contacts' },
                { to: '/crms/invoices', icon: FileText, label: 'Invoices', excludeDesignations: ['Marketing Manager', 'Operations Manager'] }
            ]
        },
        {
            section: 'Finance Overview', items: [
                { to: '/crms/finance', icon: DollarSign, label: 'Finance View', roles: ['Admin'] }
            ]
        },
        {
            section: 'Activities', items: [
                { to: '/crms/tasks', icon: ClipboardCheck, label: 'Tasks' },
                { to: '/crms/calls', icon: Phone, label: 'Call Logs' }
            ]
        }
    ],
    TalentManagement: [
        {
            section: 'Overview', items: [
                { to: '/talent', icon: LayoutDashboard, label: 'Dashboard', end: true }
            ]
        },
        {
            section: 'Recruitment', items: [
                { to: '/talent/demands', icon: Briefcase, label: 'Demands' },
                { to: '/talent/candidates', icon: UserPlus, label: 'Candidates' },
                { to: '/talent/interviews', icon: CalendarDays, label: 'Interviews' }
            ]
        },
        {
            section: 'Development', items: [
                { to: '/talent/training', icon: BookOpen, label: 'Training Programs' },
                { to: '/talent/performance', icon: Award, label: 'Performance Reviews' },
                { to: '/talent/goals', icon: Target, label: 'Goals & OKRs' }
            ]
        },
        {
            section: 'System', items: [
                { action: 'openTalentSettings', icon: Settings, label: 'Settings', roles: ['super_admin', 'admin', 'hiring_manager'] }
            ]
        }
    ],
    AssessmentPortal: [
        {
            section: 'Overview', items: [
                { to: '/assessment', icon: LayoutDashboard, label: 'Dashboard', end: true }
            ]
        },
        {
            section: 'Portals', items: [
                { to: '/assessment/admin', icon: Shield, label: 'Admin Portal', roles: ['Admin'] },
                { to: '/assessment/examiner', icon: BookOpen, label: 'Examiner Portal', roles: ['Admin', 'Examiner'] },
                { to: '/assessment/candidate', icon: GraduationCap, label: 'Candidate Portal', roles: ['Admin', 'Candidate'] }
            ]
        },
        {
            section: 'Assessments', items: [
                { to: '/assessment/list', icon: ClipboardCheck, label: 'All Assessments' },
                { to: '/assessment/create', icon: FileText, label: 'Create Assessment' },
                { to: '/assessment/learning', icon: BookOpen, label: 'Learning Materials' },
                { to: '/assessment/questions', icon: FileQuestion, label: 'Question Bank' }
            ]
        },
        {
            section: 'Participants', items: [
                { to: '/assessment/candidates', icon: UserCheck, label: 'Candidates' },
                { to: '/assessment/invitations', icon: UserPlus, label: 'Invitations' }
            ]
        },
        {
            section: 'Analytics', items: [
                { to: '/assessment/reports', icon: BarChart3, label: 'Reports' },
                { to: '/assessment/analytics', icon: TrendingUp, label: 'Analytics' }
            ]
        }
    ],
    PMS: [
        {
            section: 'Overview', items: [
                { to: '/performance', icon: LayoutDashboard, label: 'Dashboard', end: true }
            ]
        },
        {
            section: 'Setup', roles: ['Admin', 'Project Manager'], items: [
                { to: '/performance/templates', icon: Target, label: 'Goal Templates' },
                { to: '/performance/cycles', icon: CalendarDays, label: 'Appraisal Cycles', roles: ['Admin'] }
            ]
        },
        {
            section: 'Appraisals', items: [
                { to: '/performance/appraisals', icon: Star, label: 'My Appraisals' }
            ]
        }
    ]
};

const CapabilityContext = createContext(null);

export function CapabilityProvider({ children }) {
    const [currentCapability, setCurrentCapability] = useState('HRMS');
    const location = useLocation();
    const navigate = useNavigate();

    // Sync capability with URL path
    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith('/hrms')) {
            if (currentCapability !== 'HRMS') setCurrentCapability('HRMS');
        } else if (path.startsWith('/crms')) {
            if (currentCapability !== 'CRMS') setCurrentCapability('CRMS');
        } else if (path.startsWith('/talent')) {
            if (currentCapability !== 'TalentManagement') setCurrentCapability('TalentManagement');
        } else if (path.startsWith('/assessment')) {
            if (currentCapability !== 'AssessmentPortal') setCurrentCapability('AssessmentPortal');
        } else if (path.startsWith('/performance')) {
            if (currentCapability !== 'PMS') setCurrentCapability('PMS');
        }
    }, [location.pathname]);

    // Persist to localStorage just for backup/initial load logic if needed,
    // though URL is the source of truth now.
    useEffect(() => {
        localStorage.setItem('selectedCapability', currentCapability);
    }, [currentCapability]);

    const setCapability = (capabilityId) => {
        if (CAPABILITIES[capabilityId]) {
            setCurrentCapability(capabilityId);

            // Navigate to the module's dashboard
            switch (capabilityId) {
                case 'HRMS': navigate('/hrms'); break;
                case 'CRMS': navigate('/crms'); break;
                case 'TalentManagement': navigate('/talent'); break;
                case 'AssessmentPortal': navigate('/assessment'); break;
                default: navigate('/hrms');
            }
        }
    };

    const value = {
        currentCapability,
        setCapability,
        capability: CAPABILITIES[currentCapability],
        menu: CAPABILITY_MENUS[currentCapability],
        capabilities: Object.values(CAPABILITIES)
    };

    return (
        <CapabilityContext.Provider value={value}>
            {children}
        </CapabilityContext.Provider>
    );
}

export function useCapability() {
    const context = useContext(CapabilityContext);
    if (!context) {
        throw new Error('useCapability must be used within a CapabilityProvider');
    }
    return context;
}

export default CapabilityContext;
