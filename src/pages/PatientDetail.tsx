import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPatients, getPatientReadings, getPreferences, savePreferences } from '../services/db';
import type { Patient, TestReading } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkline } from '../components/Sparkline';
import { Search, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { deleteTestReadingsByName } from '../services/db';

interface TestGroup {
    testName: string;
    category?: string;
    readings: TestReading[];
    latestReading: TestReading;
}

export const PatientDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [patient, setPatient] = useState<Patient | null>(null);
    const [testGroups, setTestGroups] = useState<TestGroup[]>([]);

    const [filterQuery, setFilterQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'latest' | 'category'>('latest');

    useEffect(() => {
        if (id) loadData(id);
    }, [id]);

    const loadData = async (patientId: string) => {
        const patients = await getPatients();
        const p = patients.find(x => x.id === patientId);
        if (!p) return navigate('/');
        setPatient(p);

        const readings = await getPatientReadings(patientId);

        // Group by testName
        const groupsMap = new Map<string, TestReading[]>();
        for (const r of readings) {
            if (!groupsMap.has(r.testName)) groupsMap.set(r.testName, []);
            groupsMap.get(r.testName)!.push(r);
        }

        const groups: TestGroup[] = [];
        for (const [testName, rList] of groupsMap.entries()) {
            // Sort readings chronologically old to new
            rList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            groups.push({
                testName,
                category: 'General', // Fallback, would come from reference later
                readings: rList,
                latestReading: rList[rList.length - 1],
            });
        }

        setTestGroups(groups);

        const prefs = await getPreferences();
        if (prefs.sortTestsBy) setSortBy(prefs.sortTestsBy);
        if (prefs.filterTestsQuery) setFilterQuery(prefs.filterTestsQuery);
    };

    const handleSortChange = async (val: 'name' | 'latest' | 'category') => {
        setSortBy(val);
        await savePreferences({ sortTestsBy: val });
    };

    const handleFilterChange = async (val: string) => {
        setFilterQuery(val);
        await savePreferences({ filterTestsQuery: val });
    };

    const handleDeleteTestGroup = async (e: React.MouseEvent, testName: string) => {
        e.stopPropagation();
        if (!patient) return;
        if (window.confirm(`Are you sure you want to delete ALL records for "${testName}"? This action cannot be undone.`)) {
            await deleteTestReadingsByName(patient.id, testName);
            loadData(patient.id);
        }
    };

    if (!patient) return <div className="p-8 text-center text-zinc-400">Loading...</div>;

    const filteredAndSorted = testGroups
        .filter(g =>
            g.testName.toLowerCase().includes(filterQuery.toLowerCase()) ||
            (g.category && g.category.toLowerCase().includes(filterQuery.toLowerCase()))
        )
        .sort((a, b) => {
            if (sortBy === 'name') return a.testName.localeCompare(b.testName);
            if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
            // latest
            return new Date(b.latestReading.date).getTime() - new Date(a.latestReading.date).getTime();
        });

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <Button variant="secondary" onClick={() => navigate('/')} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">{patient.name}</h1>
                    {patient.age && <p className="text-sm text-zinc-400">Age: {patient.age}</p>}
                </div>
                <Button onClick={() => navigate(`/patient/${id}/add-reading`)} className="flex items-center gap-2">
                    <Plus size={18} /> {t('patient.add_reading')}
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-zinc-500" size={18} />
                    <Input
                        className="w-full pl-10"
                        placeholder="Search tests..."
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
                        <option value="latest">Latest Report</option>
                        <option value="name">Name</option>
                        <option value="category">Category</option>
                    </select>
                </div>
            </div>

            {/* Test List */}
            {filteredAndSorted.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 bg-zinc-800/50 rounded-lg">
                    No tests found. Add a new reading to get started.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredAndSorted.map((group) => {
                        const daysSince = formatDistanceToNow(new Date(group.latestReading.date), { addSuffix: true });
                        const allValues = group.readings.map(r => r.value);

                        return (
                            <Card
                                key={group.testName}
                                onClick={() => navigate(`/patient/${id}/test/${encodeURIComponent(group.testName)}`)}
                                className="flex items-center justify-between"
                            >
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold">{group.testName}</h3>
                                    <p className="text-sm text-zinc-400">{group.category}</p>

                                    <div className="mt-3 flex items-baseline gap-2">
                                        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {group.latestReading.value}
                                        </span>
                                        <span className="text-sm text-zinc-500">{group.latestReading.unit}</span>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">{daysSince}</p>
                                </div>

                                {/* Actions & Visual Trend Graphic */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => handleDeleteTestGroup(e, group.testName)}
                                        className="p-2 text-zinc-600 hover:text-red-400 transition-colors rounded-full hover:bg-zinc-800"
                                        title={`Delete all ${group.testName} records`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="w-24 h-16 ml-2 shrink-0 flex items-center justify-center">
                                        <Sparkline
                                            data={allValues}
                                            idealMin={group.latestReading.idealMin}
                                            idealMax={group.latestReading.idealMax}
                                            width={80}
                                            height={40}
                                        />
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
