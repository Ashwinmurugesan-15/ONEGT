'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Demand } from '@/types/recruitment';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface DemandsContextType {
    demands: Demand[];
    addDemand: (newDemand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers' | 'rejected'>) => void;
    updateDemand: (updatedDemand: Demand) => void;
    closeDemand: (id: string) => void;
    reopenDemand: (id: string) => void;
    deleteDemand: (id: string) => void;
}

const DemandsContext = createContext<DemandsContextType | undefined>(undefined);

export const DemandsProvider = ({ children }: { children: ReactNode }) => {
    const [demands, setDemands] = useState<Demand[]>([]);
    const { isAuthenticated, getAuthHeader } = useAuth();

    const mapApiDemand = (d: any): Demand => ({
        id: d.id,
        title: d.job_title || d.title || 'Untitled',
        role: d.role || '',
        experience: d.experience || '',
        location: d.location || '',
        openings: d.number_of_openings || d.openings || 0,
        skills: Array.isArray(d.required_skills) ? d.required_skills : (Array.isArray(d.skills) ? d.skills : []),
        status: (d.status || 'open').toLowerCase(),
        createdBy: d.createdBy || 'System',
        createdAt: new Date(d.created_at || d.createdAt || new Date()),
        applicants: d.applicants || 0,
        interviewed: d.interviewed || 0,
        offers: d.offers || 0,
        rejected: d.rejected || 0,
        reopenedAt: d.reopenedAt ? new Date(d.reopenedAt) : undefined,
        // Enhanced job detail fields — passed through from backend normalizer
        department: d.department,
        roleCategory: d.roleCategory,
        level: d.level,
        employmentType: d.employmentType,
        workMode: d.workMode,
        salary: d.salary,
        description: d.description,
        responsibilities: Array.isArray(d.responsibilities) ? d.responsibilities : undefined,
        requirements: Array.isArray(d.requirements) ? d.requirements : undefined,
        niceToHave: Array.isArray(d.niceToHave) ? d.niceToHave : undefined,
        businessImpact: Array.isArray(d.businessImpact) ? d.businessImpact : undefined,
        isActive: d.isActive,
        postedDate: d.postedDate,
    });

    useEffect(() => {
        const fetchDemands = async () => {
            if (!isAuthenticated) {
                return;
            }

            try {
                const res = await fetch('/api/talent/demands', {
                    headers: getAuthHeader()
                });

                if (!res.ok) throw new Error(`API error: ${res.status}`);

                const data = await res.json();
                setDemands(data.map(mapApiDemand));
            } catch (error) {
                console.error('Failed to fetch demands:', error);
            }
        };
        fetchDemands();
    }, [isAuthenticated]);

    const addDemand = async (demand: Omit<Demand, 'id' | 'createdAt' | 'applicants' | 'interviewed' | 'offers' | 'rejected'>) => {
        const newDemandData = {
            ...demand,
            id: String(Date.now()),
            createdAt: new Date().toISOString(),
            applicants: 0,
            interviewed: 0,
            offers: 0,
            rejected: 0,
        };

        try {
            const res = await fetch('/api/talent/demands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(newDemandData),
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || `Failed to create demand, status: ${res.status}`);
            }
            const savedDemand = await res.json();
            setDemands((prev) => [mapApiDemand(savedDemand), ...prev]);
        } catch (error) {
            console.error('Failed to add demand:', error);
        }
    };

    const updateDemand = async (updatedDemand: Demand) => {
        try {
            const res = await fetch('/api/talent/demands/update', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader()
                },
                body: JSON.stringify(updatedDemand),
            });

            if (res.status === 429) {
                toast.error('Too many requests. Please wait a moment and try again.');
                return;
            }

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const errorText = errorData.detail || errorData.message || `Failed to update demand, status: ${res.status}`;
                throw new Error(errorText);
            }
            // Merge API response on top of the full updatedDemand so enhanced
            // fields (department, level, salary, etc.) are never lost even if
            // the backend only echoes back the basic fields.
            const savedDemand = await res.json();
            const merged: Demand = { ...updatedDemand, ...mapApiDemand({ ...updatedDemand, ...savedDemand }) };
            setDemands((prev) =>
                prev.map((d) => (d.id === merged.id ? merged : d))
            );
            toast.success('Demand updated successfully!');
        } catch (error: any) {
            console.error('Failed to update demand:', error);
            toast.error(error.message || 'Failed to update demand');
        }
    };


    const closeDemand = async (id: string) => {
        const demand = demands.find((d) => d.id === id);
        if (demand) {
            await updateDemand({
                ...demand,
                status: 'closed',
            });
        }
    };

    const reopenDemand = (id: string) => {
        const demand = demands.find((d) => d.id === id);
        if (demand) {
            updateDemand({
                ...demand,
                status: 'open',
                reopenedAt: new Date(),
            });
        }
    };

    const deleteDemand = async (id: string | number) => {
        try {
            const res = await fetch(`/api/talent/demands/${id}`, {
                method: 'DELETE',
                headers: getAuthHeader()
            });
            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(errorText || `Failed to delete demand, status: ${res.status}`);
            }
            setDemands((prev) => prev.filter((d) => String(d.id) !== String(id)));
            toast.success('Demand deleted successfully');
        } catch (error) {
            console.error('Failed to delete demand:', error);
            toast.error('Failed to delete demand');
        }
    };


    return (
        <DemandsContext.Provider value={{ demands, addDemand, updateDemand, closeDemand, reopenDemand, deleteDemand }}>
            {children}
        </DemandsContext.Provider>
    );
};

export const useDemands = () => {
    const context = useContext(DemandsContext);
    if (context === undefined) {
        throw new Error('useDemands must be used within a DemandsProvider');
    }
    return context;
};
