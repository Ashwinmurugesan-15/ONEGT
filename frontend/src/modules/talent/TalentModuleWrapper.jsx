import React from 'react';
import { Outlet } from 'react-router-dom';
import { AuthProvider as TalentAuthProvider } from './context/AuthContext';
import { RecruitmentProvider } from './context/RecruitmentContext';
import { DemandsProvider } from './context/DemandsContext';
import { UsersProvider } from './context/UsersContext';
import './styles/globals.css';

const TalentModuleWrapper = () => (
    <TalentAuthProvider>
        <RecruitmentProvider>
            <DemandsProvider>
                <UsersProvider>
                    <Outlet />
                </UsersProvider>
            </DemandsProvider>
        </RecruitmentProvider>
    </TalentAuthProvider>
);

export default TalentModuleWrapper;
