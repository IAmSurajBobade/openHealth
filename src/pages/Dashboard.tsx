import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getPatients, getPatientReadings, getPreferences, savePreferences, savePatient } from '../services/db';
import type { Patient } from '../types';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Search, UserPlus, MoreVertical, Settings } from 'lucide-react';

interface PatientWithLatest {
    patient: Patient;
    latestDate: Date | null;
}

export const Dashboard = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [patientsList, setPatientsList] = useState<PatientWithLatest[]>([]);
    const [filterQuery, setFilterQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'latest' | 'age'>('name');

    // Add member modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberAge, setNewMemberAge] = useState('');

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const p = await getPatients();
        const prefsData = await getPreferences();

        // For sorting by latest, we need to know their latest reading
        const withLatest = await Promise.all(p.map(async pat => {
            const readings = await getPatientReadings(pat.id);
            let latest: Date | null = null;
            if (readings.length > 0) {
                // Find most recent
                const dates = readings.map(r => new Date(r.date).getTime());
                latest = new Date(Math.max(...dates));
            }
            return { patient: pat, latestDate: latest };
        }));

        setPatientsList(withLatest);

        if (prefsData.sortMembersBy) setSortBy(prefsData.sortMembersBy);
        if (prefsData.filterMembersQuery) setFilterQuery(prefsData.filterMembersQuery);
    };

    const handleSortChange = async (sort: 'name' | 'latest' | 'age') => {
        setSortBy(sort);
        await savePreferences({ sortMembersBy: sort });
    };

    const handleFilterChange = async (query: string) => {
        setFilterQuery(query);
        await savePreferences({ filterMembersQuery: query });
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim()) return;

        import('uuid').then(async ({ v4: uuidv4 }) => {
            const newPatient: Patient = {
                id: uuidv4(),
                name: newMemberName.trim(),
                age: newMemberAge ? parseInt(newMemberAge, 10) : undefined
            };
            await savePatient(newPatient);
            setIsAddModalOpen(false);
            setNewMemberName('');
            setNewMemberAge('');
            loadData();
        });
    };

    // Filter and Sort
    const filteredAndSorted = patientsList
        .filter(pl => pl.patient.name.toLowerCase().includes(filterQuery.toLowerCase()))
        .sort((a, b) => {
            if (sortBy === 'name') {
                return a.patient.name.localeCompare(b.patient.name);
            } else if (sortBy === 'age') {
                return (a.patient.age || 0) - (b.patient.age || 0);
            } else {
                // latest
                if (!a.latestDate) return 1;
                if (!b.latestDate) return -1;
                return b.latestDate.getTime() - a.latestDate.getTime();
            }
        });

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
                <div className="flex items-center gap-2 relative">
                    <Button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2">
                        <UserPlus size={18} /> {t('dashboard.add_member')}
                    </Button>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        onBlur={() => setTimeout(() => setIsMenuOpen(false), 200)}
                        className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
                    >
                        <MoreVertical size={20} />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute top-12 right-0 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-50 overflow-hidden w-48 animate-fade-in">
                            <button
                                onClick={() => navigate('/manage-members')}
                                className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3 text-sm"
                            >
                                <Settings size={16} />
                                Manage Members
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-zinc-500" size={18} />
                    <Input
                        className="w-full pl-10"
                        placeholder={t('dashboard.search_placeholder')}
                        value={filterQuery}
                        onChange={(e) => handleFilterChange(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400 whitespace-nowrap">{t('dashboard.sort_by')}:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => handleSortChange(e.target.value as any)}
                        className="bg-zinc-800 border-zinc-700 rounded-md p-2 text-sm"
                    >
                        <option value="name">Name</option>
                        <option value="latest">Latest Report</option>
                        <option value="age">Age</option>
                    </select>
                </div>
            </div>

            {filteredAndSorted.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-zinc-800/50 rounded-lg">
                    {t('dashboard.no_members')}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAndSorted.map(({ patient, latestDate }) => (
                        <Card key={patient.id} onClick={() => navigate(`/patient/${patient.id}`)} className="cursor-pointer">
                            <h3 className="text-lg font-semibold truncate" title={patient.name}>{patient.name}</h3>
                            <div className="text-sm mt-2 space-y-1" style={{ color: 'var(--text-secondary)' }}>
                                {patient.age && <p>{t('patient.age')}: {patient.age}</p>}
                                {latestDate ? (
                                    <p>{t('patient.latest_report')}: {latestDate.toLocaleDateString()}</p>
                                ) : (
                                    <p>No reports yet</p>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add Member Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={t('dashboard.add_member')}>
                <form onSubmit={handleAddMember} className="space-y-4">
                    <Input
                        label="Name"
                        required
                        value={newMemberName}
                        onChange={e => setNewMemberName(e.target.value)}
                        autoFocus
                    />
                    <Input
                        label="Age (optional)"
                        type="number"
                        value={newMemberAge}
                        onChange={e => setNewMemberAge(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
