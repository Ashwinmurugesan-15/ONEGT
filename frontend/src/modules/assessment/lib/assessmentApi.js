/**
 * Assessment API Client - Handles communication with the /api/assessment endpoints.
 */

const BASE_URL = '/api/assessment';

export const assessmentApi = {
    /**
     * Helper to perform fetch with auth headers
     */
    async _fetch(endpoint, options = {}, getAuthHeader) {
        const url = `${BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(getAuthHeader ? getAuthHeader() : {}),
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.detail || errorData.message || `API Error: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return response.json();
    },

    // Assessments
    async getAssessments(getAuthHeader) {
        return this._fetch('/list', {}, getAuthHeader);
    },

    async getAssessment(id, getAuthHeader) {
        return this._fetch(`/${id}`, {}, getAuthHeader);
    },

    async createAssessment(formData, getAuthHeader) {
        // Form data needs special handling (no Content-Type JSON)
        const url = `${BASE_URL}/create`;
        const headers = {
            ...(getAuthHeader ? getAuthHeader() : {}),
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || 'Failed to create assessment');
        }

        return response.json();
    },

    async deleteAssessment(id, getAuthHeader) {
        return this._fetch(`/${id}`, { method: 'DELETE' }, getAuthHeader);
    },

    async startAssessment(id, getAuthHeader) {
        return this._fetch(`/${id}/start`, { method: 'POST' }, getAuthHeader);
    },

    async gradeAssessment(id, submissions, proctoringData, getAuthHeader) {
        return this._fetch(`/${id}/grade`, {
            method: 'POST',
            body: JSON.stringify({
                submissions,
                ...proctoringData
            }),
        }, getAuthHeader);
    },

    // Candidate specific
    async getCandidateAssessments(getAuthHeader) {
        return this._fetch('/candidate/my-assessments', {}, getAuthHeader);
    },

    async getCandidateResults(getAuthHeader) {
        return this._fetch('/candidate/my-results', {}, getAuthHeader);
    },

    // Admin specific
    async getAdminUsers(getAuthHeader) {
        return this._fetch('/admin/users', {}, getAuthHeader);
    },

    async getAdminAnalytics(getAuthHeader) {
        return this._fetch('/admin/analytics', {}, getAuthHeader);
    },

    // Examiner specific
    async getExaminerAssessments(getAuthHeader) {
        return this._fetch('/examiner/assessments', {}, getAuthHeader);
    },

    async getExaminerAssessmentDetail(id, getAuthHeader) {
        return this._fetch(`/examiner/assessment/${id}`, {}, getAuthHeader);
    },

    async updateAssignments(id, assignedTo, getAuthHeader) {
        return this._fetch(`/examiner/assessment/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ assigned_to: assignedTo }),
        }, getAuthHeader);
    },

    async grantRetake(assessmentId, candidateId, getAuthHeader) {
        return this._fetch(`/examiner/assessment/${assessmentId}/retake`, {
            method: 'POST',
            body: JSON.stringify({ candidate_id: candidateId }),
        }, getAuthHeader);
    },

    // Learning
    async getLearningResources(getAuthHeader) {
        return this._fetch('/learning', {}, getAuthHeader);
    },

    async recordLearningView(id, getAuthHeader) {
        return this._fetch(`/learning/${id}/view`, { method: 'POST' }, getAuthHeader);
    },
};
