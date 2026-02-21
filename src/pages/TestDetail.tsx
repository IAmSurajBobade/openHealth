import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatients, getPatientReadings } from '../services/db';
import type { Patient, TestReading } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, MoreVertical, Settings } from 'lucide-react';
import { Sparkline } from '../components/Sparkline';
import { formatDistanceToNow } from 'date-fns';

export const TestDetail = () => {
    const { id, testName } = useParams<{ id: string; testName: string }>();
    const navigate = useNavigate();

    const [patient, setPatient] = useState<Patient | null>(null);
    const [readings, setReadings] = useState<TestReading[]>([]);
    const [decodedTestName, setDecodedTestName] = useState('');

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (id && testName) {
            const decoded = decodeURIComponent(testName);
            setDecodedTestName(decoded);
            loadData(id, decoded);
        }
    }, [id, testName]);

    const loadData = async (patientId: string, testName: string) => {
        const patients = await getPatients();
        setPatient(patients.find(p => p.id === patientId) || null);

        const allReadings = await getPatientReadings(patientId);
        const specificTests = allReadings.filter(r => r.testName === testName);

        // Sort chronological: oldest to newest for graph
        specificTests.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setReadings(specificTests);
    };

    if (!patient || readings.length === 0) return <div className="p-8 text-center text-zinc-400">Loading or not found...</div>;

    const latestReading = readings[readings.length - 1];
    const allValues = readings.map(r => r.value);

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <Button variant="secondary" onClick={() => navigate(`/patient/${id}`)} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{decodedTestName}</h1>
                    <p className="text-sm text-zinc-400">Patient: {patient.name}</p>
                </div>
                <div className="flex items-center gap-2 ml-auto relative">
                    <Button onClick={() => navigate(`/patient/${id}/add-reading?testName=${encodeURIComponent(decodedTestName)}`)}>
                        Add Record
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
                                onClick={() => navigate(`/patient/${id}/manage-readings/${encodeURIComponent(decodedTestName)}`)}
                                className="w-full text-left px-4 py-3 hover:bg-zinc-700 transition-colors flex items-center gap-3 text-sm"
                            >
                                <Settings size={16} />
                                Manage Readings
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Overview */}
            <Card className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex-1">
                        <h2 className="text-zinc-400 text-sm font-medium uppercase tracking-wider">Latest Value</h2>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-5xl font-bold">{latestReading.value}</span>
                            <span className="text-xl text-zinc-500">{latestReading.unit}</span>
                        </div>

                        <div className="mt-4 space-y-2 text-sm">
                            {latestReading.idealMin !== undefined && latestReading.idealMax !== undefined && (
                                <div className="flex gap-2">
                                    <span className="text-zinc-500">Ideal Range:</span>
                                    <span>{latestReading.idealMin} - {latestReading.idealMax} {latestReading.unit}</span>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <span className="text-zinc-500">Recorded:</span>
                                <span>{new Date(latestReading.date).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-zinc-500">Update freq:</span>
                                <span>{formatDistanceToNow(new Date(latestReading.date), { addSuffix: true })}</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2 h-40 bg-zinc-900 rounded-lg p-4 border border-zinc-800 flex items-center justify-center">
                        {/* Big Sparkline */}
                        <Sparkline
                            data={allValues}
                            idealMin={latestReading.idealMin}
                            idealMax={latestReading.idealMax}
                            width={300}
                            height={120}
                        />
                    </div>
                </div>
            </Card>

            {/* History Table */}
            <h3 className="text-lg font-semibold mt-8 mb-4">Reading History</h3>
            <div className="bg-zinc-800 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-zinc-900/50">
                        <tr>
                            <th className="p-4 font-medium text-zinc-400">Date</th>
                            <th className="p-4 font-medium text-zinc-400">Value</th>
                            <th className="p-4 font-medium text-zinc-400">Since Previous</th>
                            <th className="p-4 font-medium text-zinc-400">Range</th>
                            <th className="p-4 font-medium text-zinc-400 w-full">Notes</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                        {/** Reverse array to show newest first in the table */}
                        {[...readings].reverse().map((r, i, arr) => {
                            // array is reversed, so the chronological previous is the next item in this reversed array
                            const prev = arr[i + 1];
                            let diffText = '-';
                            if (prev) {
                                const ms = new Date(r.date).getTime() - new Date(prev.date).getTime();
                                const days = Math.round(ms / (1000 * 60 * 60 * 24));
                                diffText = days === 1 ? '1 day' : `${days} days`;
                            }

                            return (
                                <tr key={r.id} className="hover:bg-zinc-700/30 transition-colors">
                                    <td className="p-4">{new Date(r.date).toLocaleDateString()}</td>
                                    <td className="p-4 font-medium">{r.value}</td>
                                    <td className="p-4 text-zinc-500">{diffText}</td>
                                    <td className="p-4 text-zinc-500">
                                        {r.idealMin !== undefined ? r.idealMin : '-'} - {r.idealMax !== undefined ? r.idealMax : '-'}
                                    </td>
                                    <td className="p-4 text-zinc-500 truncate max-w-[200px]" title={r.notes || r.reason}>
                                        {r.notes || r.reason || '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
