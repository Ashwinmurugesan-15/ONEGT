'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { assessmentApi } from '../lib/assessmentApi';

const AssessmentContext = createContext(undefined);

export const AssessmentProvider = ({ children }) => {
    const { user, isAuthenticated, getAuthHeader } = useAuth();
    const [assessments, setAssessments] = useState([]);
    const [myAssessments, setMyAssessments] = useState([]);
    const [myResults, setMyResults] = useState([]);
    const [learningResources, setLearningResources] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAllData = async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const role = user.role;
            const headers = getAuthHeader();

            if (role === 'admin' || role === 'super_admin') {
                const data = await assessmentApi.getAssessments(getAuthHeader);
                setAssessments(data.assessments || []);
            } else if (role === 'hiring_manager' || role === 'interviewer') {
                const data = await assessmentApi.getExaminerAssessments(getAuthHeader);
                setAssessments(data.assessments || []);
            }

            // Always fetch candidate-specific data if available
            const [candAss, candRes, learnRes] = await Promise.all([
                assessmentApi.getCandidateAssessments(getAuthHeader).catch(() => ({ assessments: [] })),
                assessmentApi.getCandidateResults(getAuthHeader).catch(() => ({ results: [] })),
                assessmentApi.getLearningResources(getAuthHeader).catch(() => ({ resources: [] }))
            ]);

            setMyAssessments(candAss.assessments || []);
            setMyResults(candRes.results || []);
            setLearningResources(learnRes.resources || []);

        } catch (error) {
            console.error('Failed to fetch assessment data:', error);
            // toast.error('Failed to load assessment data'); // Silencing for now to avoid spam
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [isAuthenticated, user?.role]);

    const createAssessment = async (formData) => {
        try {
            const result = await assessmentApi.createAssessment(formData, getAuthHeader);
            toast.success('Assessment created successfully');
            fetchAllData();
            return result;
        } catch (error) {
            toast.error(error.message || 'Failed to create assessment');
            throw error;
        }
    };

    const deleteAssessment = async (id) => {
        try {
            await assessmentApi.deleteAssessment(id, getAuthHeader);
            toast.success('Assessment deleted');
            setAssessments(prev => prev.filter(a => (a.id || a.assessment_id) !== id));
        } catch (error) {
            toast.error('Failed to delete assessment');
        }
    };

    const gradeAssessment = async (id, submissions) => {
        try {
            const result = await assessmentApi.gradeAssessment(id, submissions, getAuthHeader);
            toast.success(`Test submitted! Score: ${result.score}/${result.max_score}`);
            fetchAllData();
            return result;
        } catch (error) {
            toast.error('Failed to submit assessment');
            throw error;
        }
    };

    const value = {
        assessments,
        myAssessments,
        myResults,
        learningResources,
        loading,
        refresh: fetchAllData,
        createAssessment,
        deleteAssessment,
        gradeAssessment,
    };

    return (
        <AssessmentContext.Provider value={value}>
            {children}
        </AssessmentContext.Provider>
    );
};

export const useAssessment = () => {
    const context = useContext(AssessmentContext);
    if (context === undefined) {
        throw new Error('useAssessment must be used within an AssessmentProvider');
    }
    return context;
};
