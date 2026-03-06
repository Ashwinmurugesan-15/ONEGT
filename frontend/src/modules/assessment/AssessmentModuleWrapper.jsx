import React from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider as AssessmentAuthProvider } from './context/AuthContext';
import { AssessmentProvider } from './context/AssessmentContext';

const AssessmentModuleWrapper = () => (
    <AssessmentAuthProvider>
        <AssessmentProvider>
            <Outlet />
        </AssessmentProvider>
    </AssessmentAuthProvider>
);

export default AssessmentModuleWrapper;
