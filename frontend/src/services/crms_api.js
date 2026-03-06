import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('chrms_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ============== Leads API ==============
export const leadsApi = {
    getAll: (params = {}) => api.get('/crms/leads', { params }),
    getById: (id) => api.get(`/crms/leads/${id}`),
    create: (data) => api.post('/crms/leads', data),
    update: (id, data) => api.put(`/crms/leads/${id}`, data),
    delete: (id) => api.delete(`/crms/leads/${id}`),
    getStats: () => api.get('/crms/leads/stats/summary')
};

// ============== Opportunities API ==============
export const opportunitiesApi = {
    getAll: (params = {}) => api.get('/crms/opportunities', { params }),
    getById: (id) => api.get(`/crms/opportunities/${id}`),
    create: (data) => api.post('/crms/opportunities', data),
    update: (id, data) => api.put(`/crms/opportunities/${id}`, data),
    delete: (id) => api.delete(`/crms/opportunities/${id}`),
    getPipelineStats: () => api.get('/crms/opportunities/stats/pipeline')
};

// ============== Customers API ==============
export const crmCustomersApi = {
    getAll: (params = {}) => api.get('/crms/customers', { params }),
    getById: (id) => api.get(`/crms/customers/${id}`),
    create: (data) => api.post('/crms/customers', data),
    update: (id, data) => api.put(`/crms/customers/${id}`, data),
    delete: (id) => api.delete(`/crms/customers/${id}`)
};

// ============== Contacts API ==============
export const contactsApi = {
    getAll: (params = {}) => api.get('/crms/contacts', { params }),
    getById: (id) => api.get(`/crms/contacts/${id}`),
    create: (data) => api.post('/crms/contacts', data),
    update: (id, data) => api.put(`/crms/contacts/${id}`, data),
    delete: (id) => api.delete(`/crms/contacts/${id}`)
};

// ============== Deals API ==============
export const dealsApi = {
    getAll: (params = {}) => api.get('/crms/deals', { params }),
    getById: (id) => api.get(`/crms/deals/${id}`),
    create: (data) => api.post('/crms/deals', data),
    update: (id, data) => api.put(`/crms/deals/${id}`, data),
    delete: (id) => api.delete(`/crms/deals/${id}`)
};

// ============== Tasks API ==============
export const crmTasksApi = {
    getAll: (params = {}) => api.get('/crms/tasks', { params }),
    getById: (id) => api.get(`/crms/tasks/${id}`),
    create: (data) => api.post('/crms/tasks', data),
    update: (id, data) => api.put(`/crms/tasks/${id}`, data),
    delete: (id) => api.delete(`/crms/tasks/${id}`)
};

// ============== Calls API ==============
export const callsApi = {
    getAll: (params = {}) => api.get('/crms/calls', { params }),
    getById: (id) => api.get(`/crms/calls/${id}`),
    create: (data, createdBy) => api.post('/crms/calls', data, { params: { created_by: createdBy } }),
    update: (id, data) => api.put(`/crms/calls/${id}`, data),
    delete: (id) => api.delete(`/crms/calls/${id}`)
};

// ============== Dashboard API ==============
export const crmDashboardApi = {
    getOverview: (params = {}) => api.get('/crms/dashboard/overview', { params }),
    getPipeline: (params = {}) => api.get('/crms/dashboard/pipeline', { params }),
    getLeadSources: (params = {}) => api.get('/crms/dashboard/lead-sources', { params }),
    getRecentActivities: () => api.get('/crms/dashboard/recent-activities'),
    getFinanceOverview: () => api.get('/crms/dashboard/finance'),
    getProfitability: (params = {}) => api.get('/crms/dashboard/finance/profitability', { params }),
    getCashflow: (params = {}) => api.get('/crms/dashboard/finance/cashflow', { params })
};

// ============== Invoices API ==============
export const crmInvoicesApi = {
    getAll: (params = {}) => api.get('/crms/invoices', { params }),
    getById: (id) => api.get(`/crms/invoices/${id}`),
    getNextNumber: () => api.get('/crms/invoices/next-number'),
    create: (data) => api.post('/crms/invoices', data),
    update: (id, data) => api.put(`/crms/invoices/${id}`, data),
    delete: (id) => api.delete(`/crms/invoices/${id}`),
    logPayment: (id, data) => api.post(`/crms/invoices/${id}/log-payment`, data),
    bulkGenerate: (data) => api.post('/crms/invoices/bulk-generate', data)
};

// ============== Invoice Templates API ==============
export const crmInvoiceTemplatesApi = {
    getAll: (params = {}) => api.get('/crms/invoice-templates', { params }),
    getById: (id) => api.get(`/crms/invoice-templates/${id}`),
    create: (data) => api.post('/crms/invoice-templates', data),
    update: (id, data) => api.put(`/crms/invoice-templates/${id}`, data),
    delete: (id) => api.delete(`/crms/invoice-templates/${id}`)
};

export default {
    leads: leadsApi,
    opportunities: opportunitiesApi,
    customers: crmCustomersApi,
    contacts: contactsApi,
    deals: dealsApi,
    tasks: crmTasksApi,
    calls: callsApi,
    invoices: crmInvoicesApi,
    dashboard: crmDashboardApi
};

export const crmLeadsApi = leadsApi;
export const crmOpportunitiesApi = opportunitiesApi;
export const crmDealsApi = dealsApi;
export const crmCallsApi = callsApi;
export const crmInvoicesApiAlias = crmInvoicesApi; // For consistency if needed but crmInvoicesApi is exported above
