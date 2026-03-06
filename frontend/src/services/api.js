import axios from 'axios';

// Get base path from Vite config (removes trailing slash)
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const api = axios.create({
    baseURL: `${basePath}/api`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor - add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('chrms_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.detail || 'An error occurred';
        console.error('API Error:', message);
        return Promise.reject(error);
    }
);

export default api;

// Associates API
export const associatesApi = {
    getAll: () => api.get('/associates/'),
    getById: (id) => api.get(`/associates/${id}`),
    getNextId: () => api.get('/associates/next-id'),
    create: (data) => api.post('/associates/', data),
    update: (id, data) => api.put(`/associates/${id}`, data),
    delete: (id) => api.delete(`/associates/${id}`),
    getByDepartment: (dept) => api.get(`/associates/department/${dept}`),
    uploadProof: (id, proofType, file) => {
        const formData = new FormData();
        formData.append('proof_type', proofType);
        formData.append('file', file);
        return api.post(`/associates/${id}/upload-proof`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Projects API
export const projectsApi = {
    getAll: () => api.get('/projects/'),
    getById: (id) => api.get(`/projects/${id}`),
    create: (data) => api.post('/projects/', data),
    update: (id, data) => api.put(`/projects/${id}`, data),
    delete: (id) => api.delete(`/projects/${id}`),
    getByStatus: (status) => api.get(`/projects/status/${status}`),
    getByClient: (client) => api.get(`/projects/client/${client}`),
    generateId: (year, month) => api.get('/projects/generate-id', { params: { year, month } }),
    getStats: () => api.get('/projects/stats')
};

// Allocations API
export const allocationsApi = {
    getAll: (params) => api.get('/allocations/', { params }),
    create: (data) => api.post('/allocations/', data),
    update: (rowIndex, data) => api.put(`/allocations/${rowIndex}`, data),
    delete: (rowIndex) => api.delete(`/allocations/${rowIndex}`),
    getByMonth: (year, month) => api.get('/allocations/by-month', { params: { year, month } }),
    getByAssociate: (id) => api.get(`/allocations/associate/${id}`),
    getByProject: (id) => api.get(`/allocations/project/${id}`),
    getDashboardView: (active_only = true) => api.get('/allocations/dashboard-view', { params: { active_only } })
};


// Payroll API
export const payrollApi = {
    getAll: (params) => api.get('/payroll/', { params }),
    create: (data) => api.post('/payroll/', data),
    bulkCreate: (data) => api.post('/payroll/bulk', data),
    delete: (rowIndex) => api.delete(`/payroll/${rowIndex}`),
    getSummary: (year, month) => api.get('/payroll/summary', { params: { year, month } }),
    getAssociateHistory: (id) => api.get(`/payroll/associate/${id}/history`),
    upload: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/payroll/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Payrun API
export const payrunApi = {
    init: (year, month) => api.get('/payrun/init', { params: { year, month } }),
    finalize: (data) => api.post('/payrun/finalize', data)
};

// Expenses API (legacy)
export const expensesApi = {
    getAll: (params) => api.get('/expenses/', { params }),
    create: (data) => api.post('/expenses/', data),
    update: (rowIndex, data) => api.put(`/expenses/${rowIndex}`, data),
    delete: (rowIndex) => api.delete(`/expenses/${rowIndex}`),
    getSummary: (params) => api.get('/expenses/summary', { params }),
    getByProject: (id) => api.get(`/expenses/project/${id}`),
    getCategories: () => api.get('/expenses/categories')
};

// Expense Reports API (new)
export const expenseReportsApi = {
    getAll: (params) => api.get('/expenses/reports', { params }),
    getById: (id) => api.get(`/expenses/reports/${id}`),
    create: (data) => api.post('/expenses/reports', data),
    update: (id, data) => api.put(`/expenses/reports/${id}`, data),
    delete: (id) => api.delete(`/expenses/reports/${id}`),
    submit: (id) => api.post(`/expenses/reports/${id}/submit`),
    withdraw: (id) => api.post(`/expenses/reports/${id}/withdraw`),
    approve: (id) => api.post(`/expenses/reports/${id}/approve`),
    reject: (id, reason) => api.post(`/expenses/reports/${id}/reject`, null, { params: { reason } }),
    pay: (id) => api.post(`/expenses/reports/${id}/pay`),
    uploadReceipt: (reportId, file) => {
        const formData = new FormData();
        formData.append('report_id', reportId);
        formData.append('file', file);
        return api.post('/expenses/reports/upload-receipt', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
};

// Currency API
export const currencyApi = {
    getAll: (year, month) => api.get('/currency/', { params: { year, month } }),
    getByPeriod: (year, month) => api.get(`/currency/${year}/${month}`),
    create: (data) => api.post('/currency/', data),
    update: (year, month, data) => api.put(`/currency/${year}/${month}`, data),
    delete: (year, month) => api.delete(`/currency/${year}/${month}`),
    getCurrencies: () => api.get('/currency/currencies'),
    checkMissing: () => api.get('/currency/check-missing'),
    addCurrency: (code) => api.post(`/currency/add-currency/${code}`),
    getTrend: (months = 12) => api.get(`/currency/trend/${months}`)
};

// Customers API
export const customersApi = {
    getAll: () => api.get('/customers/'),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers/', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    getByStatus: (status) => api.get(`/customers/status/${status}`)
};

// Timesheets API
export const timesheetsApi = {
    getAll: (params) => api.get('/timesheets/', { params }),
    getTeamTimesheets: () => api.get('/timesheets/team'),
    create: (data) => api.post('/timesheets/', data),
    bulkCreate: (data) => api.post('/timesheets/bulk', data),
    update: (rowIndex, data) => api.put(`/timesheets/${rowIndex}`, data),
    delete: (rowIndex) => api.delete(`/timesheets/${rowIndex}`),
    bulkUpdateStatus: (rowIndices, status, reason) => api.post('/timesheets/bulk-status', { row_indices: rowIndices, status, reason }),
    getWeeklySummary: (associateId, weekStart) =>
        api.get('/timesheets/weekly-summary', { params: { associate_id: associateId, week_start: weekStart } }),
    getProjectHours: (id) => api.get(`/timesheets/project/${id}/hours`)
};

// Notifications API
export const notificationsApi = {
    getAll: (userId) => api.get('/notifications/', { params: { user_id: userId } }),
    create: (data) => api.post('/notifications/', data),
    markAsRead: (rowIndex) => api.put(`/notifications/${rowIndex}/read`),
    markAllRead: (userId) => api.post('/notifications/mark-all-read', null, { params: { user_id: userId } })
};

// Dashboard API
export const dashboardApi = {
    getOverview: (params) => api.get('/dashboard/overview', { params }),
    getAllocationByMonth: (year, month) =>
        api.get('/dashboard/allocation-by-month', { params: { year, month } }),
    getProjectProfitability: (params) =>
        api.get('/dashboard/project-profitability', { params }),
    getRevenueTrend: (year, projectId, managerId) =>
        api.get('/dashboard/revenue-trend', { params: { year, project_id: projectId, manager_id: managerId } }),
    getDepartmentSummary: () => api.get('/dashboard/department-summary'),
    getUtilization: (year, month, managerId) =>
        api.get('/dashboard/utilization', { params: { year, month, manager_id: managerId } }),
    getAssociateOverview: (associateId) =>
        api.get('/dashboard/associate-overview', { params: { associate_id: associateId } }),
    getPendingApprovals: (managerId) =>
        api.get('/dashboard/pending-approvals', { params: { manager_id: managerId } })
};

// Skills API
export const skillsApi = {
    getAll: () => api.get('/skills/'),
    getFamilies: () => api.get('/skills/families'),
    getByFamily: (family) => api.get(`/skills/family/${encodeURIComponent(family)}`),
    search: (query, family) => api.get('/skills/search', { params: { q: query, family } }),
    getAllList: () => api.get('/skills/all')
};

// Assets API
export const assetsApi = {
    getAll: (owner) => api.get('/assets/', { params: owner ? { owner } : undefined }),
    getMyAssets: (associateId) => api.get(`/assets/my-assets/${associateId}`),
    getById: (id) => api.get(`/assets/${id}`),
    getTypes: () => api.get('/assets/types'),
    create: (data) => api.post('/assets/', data),
    update: (id, data) => api.put(`/assets/${id}`, data),
    delete: (id) => api.delete(`/assets/${id}`)
};

// Organization API
export const organizationApi = {
    getDepartments: () => api.get('/organization/departments'),
    getRoles: () => api.get('/organization/roles'),
    getWorkLocations: () => api.get('/organization/work-locations')
};

// Global Settings API
export const settingsApi = {
    getCompany: () => api.get('/settings/company'),
    updateCompany: (data) => api.post('/settings/company', data),
    uploadLogo: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/settings/upload-logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    getRoles: () => api.get('/settings/roles'),
    createRole: (data) => api.post('/settings/roles', data),
    setDefaultRole: (roleId) => api.put(`/settings/roles/${roleId}/set-default`),
    seedAdminRole: () => api.post('/settings/roles/seed-admin'),
    assignRole: (associateId, roleId) => api.put(`/associates/${associateId}`, { iam_role_id: roleId }),
    getPermissions: () => api.get('/settings/permissions'),
    updatePermissions: (data) => api.post('/settings/permissions', data),
    getLeaveGroups: () => api.get('/settings/leave-groups'),
    createLeaveGroup: (data) => api.post('/settings/leave-groups', data),
    updateLeaveGroup: (id, data) => api.put(`/settings/leave-groups/${id}`, data),
    getLeaveTypes: () => api.get('/settings/leave-types'),
    createLeaveType: (data) => api.post('/settings/leave-types', data),
    getLeavePolicies: () => api.get('/settings/leave-policies'),
    updateLeavePolicy: (data) => api.post('/settings/leave-policies', data),
    // Entitlements
    getLeaveEntitlements: () => api.get('/settings/leave-entitlements'),
    saveLeaveEntitlements: (data) => api.post('/settings/leave-entitlements', data),
    deleteLeaveEntitlements: (groupCode) => api.delete(`/settings/leave-entitlements/${groupCode}`),
    // Holidays
    getHolidays: (year) => api.get('/settings/holidays', { params: year ? { year } : {} }),
    createHoliday: (data) => api.post('/settings/holidays', data),
    updateHoliday: (id, data) => api.put(`/settings/holidays/${id}`, data),
    deleteHoliday: (id) => api.delete(`/settings/holidays/${id}`),
    uploadHolidays: (file) => { const fd = new FormData(); fd.append('file', file); return api.post('/settings/holidays/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); }
};

// Leave Management API
export const leaveApi = {
    getLeaves: (params) => api.get('/leaves', { params }),
    applyLeave: (data) => api.post('/leaves', data),
    getBalance: (associateId) => api.get(`/leaves/balance/${associateId}`),
    getTeamLeaves: (params) => api.get('/leaves/team', { params }),
    approveLeave: (leaveId, data) => api.post(`/leaves/${leaveId}/approve`, data || {}),
    rejectLeave: (leaveId, data) => api.post(`/leaves/${leaveId}/reject`, data || {})
};

// Performance Management API
export const performanceApi = {
    // Templates
    getTemplates: (params) => api.get('/performance/templates', { params }),
    createTemplate: (data) => api.post('/performance/templates', data),
    updateTemplate: (id, data) => api.put(`/performance/templates/${id}`, data),
    cloneTemplate: (id, data) => api.post(`/performance/templates/${id}/clone`, data),
    deleteTemplate: (id) => api.delete(`/performance/templates/${id}`),

    // Cycles
    getCycles: (params) => api.get('/performance/cycles', { params }),
    createCycle: (data) => api.post('/performance/cycles', data),
    updateCycle: (id, data) => api.put(`/performance/cycles/${id}`, data),
    initiateCycle: (id, data) => api.post(`/performance/cycles/${id}/initiate`, data || {}),

    // Appraisals
    getAppraisals: (params) => api.get('/performance/appraisals', { params }),
    getAppraisal: (id) => api.get(`/performance/appraisals/${id}`),
    selfSubmit: (id, data) => api.put(`/performance/appraisals/${id}/self-submit`, data),
    managerSubmit: (id, data) => api.put(`/performance/appraisals/${id}/manager-submit`, data),
    acknowledge: (id, data) => api.put(`/performance/appraisals/${id}/acknowledge`, data),
    addCustomGoal: (id, data) => api.post(`/performance/appraisals/${id}/goals`, data),

    // Dashboard & Reporting
    getAdminDashboard: (params) => api.get('/performance/dashboard/admin', { params }),
    getManagerDashboard: () => api.get('/performance/dashboard/manager'),
    exportAppraisals: (params) => api.get('/performance/dashboard/export', { params }),
    getRatingScale: () => api.get('/performance/rating-scale')
};
