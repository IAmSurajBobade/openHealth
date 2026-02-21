import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatients, getTestReferences, saveReading, bulkSaveReadings } from '../services/db';
import type { Patient, TestReference, TestReading } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ArrowLeft } from 'lucide-react';

export const AddReading = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [patient, setPatient] = useState<Patient | null>(null);
    const [testRefs, setTestRefs] = useState<TestReference[]>([]);
    const [mode, setMode] = useState<'single' | 'bulk'>('single');

    // Single mode state
    const [testName, setTestName] = useState('');
    const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [reason, setReason] = useState('');
    const [value, setValue] = useState('');
    const [unit, setUnit] = useState('');
    const [idealMin, setIdealMin] = useState('');
    const [idealMax, setIdealMax] = useState('');
    const [notes, setNotes] = useState('');

    // Bulk mode state
    const [bulkText, setBulkText] = useState('');

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        const patients = await getPatients();
        setPatient(patients.find(p => p.id === id) || null);

        const refs = await getTestReferences();
        setTestRefs(refs);
    };

    const handleTestNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setTestName(val);

        // Auto-complete unit and min/max if found
        const match = testRefs.find(r => r.testName.toLowerCase() === val.toLowerCase());
        if (match) {
            setUnit(match.unit || '');
            setIdealMin(match.defaultIdealMin?.toString() || '');
            setIdealMax(match.defaultIdealMax?.toString() || '');
        }
    };

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !testName || !value || !unit || !date) return;

        import('uuid').then(async ({ v4: uuidv4 }) => {
            const reading: TestReading = {
                id: uuidv4(),
                patientId: id,
                testName: testName.trim(),
                date: new Date(date).toISOString(),
                value: parseFloat(value),
                unit: unit.trim(),
                idealMin: idealMin ? parseFloat(idealMin) : undefined,
                idealMax: idealMax ? parseFloat(idealMax) : undefined,
                reason: reason.trim() || undefined,
                notes: notes.trim() || undefined,
            };

            await saveReading(reading);
            navigate(`/patient/${id}`);
        });
    };

    const handleBulkSubmit = async () => {
        if (!id || !bulkText.trim()) return;

        try {
            const { v4: uuidv4 } = await import('uuid');
            // Simple parse: TestName, Value, Unit, Date, Min(opt), Max(opt)
            const lines = bulkText.split('\n').filter(l => l.trim() !== '');
            const readings: TestReading[] = lines.map(line => {
                const parts = line.split(',').map(p => p.trim());
                if (parts.length < 4) throw new Error("Invalid format on line: " + line);

                return {
                    id: uuidv4(),
                    patientId: id,
                    testName: parts[0],
                    value: parseFloat(parts[1]),
                    unit: parts[2],
                    date: new Date(parts[3]).toISOString(),
                    idealMin: parts[4] ? parseFloat(parts[4]) : undefined,
                    idealMax: parts[5] ? parseFloat(parts[5]) : undefined,
                };
            });

            await bulkSaveReadings(readings);
            navigate(`/patient/${id}`);
        } catch (err: any) {
            alert("Error parsing bulk text: " + err.message);
        }
    };

    if (!patient) return null;

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <Button variant="secondary" onClick={() => navigate(`/patient/${id}`)} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold">Add Reading for {patient.name}</h1>
            </div>

            <div className="flex gap-4">
                <Button variant={mode === 'single' ? 'primary' : 'secondary'} onClick={() => setMode('single')}>Single Entry</Button>
                <Button variant={mode === 'bulk' ? 'primary' : 'secondary'} onClick={() => setMode('bulk')}>Bulk Paste</Button>
            </div>

            {mode === 'single' ? (
                <Card>
                    <form onSubmit={handleSingleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1 relative">
                                <Input
                                    label="Test Name"
                                    required
                                    value={testName}
                                    onChange={handleTestNameChange}
                                    list="test-suggestions"
                                    autoComplete="off"
                                />
                                <datalist id="test-suggestions">
                                    {testRefs.map(ref => <option key={ref.id} value={ref.testName} />)}
                                </datalist>
                            </div>

                            <Input label="Date" type="date" required value={date} onChange={e => setDate(e.target.value)} />

                            <Input label="Value" type="number" step="any" required value={value} onChange={e => setValue(e.target.value)} />
                            <Input label="Unit" required value={unit} onChange={e => setUnit(e.target.value)} />

                            <Input label="Ideal Min (auto-filled)" type="number" step="any" value={idealMin} onChange={e => setIdealMin(e.target.value)} />
                            <Input label="Ideal Max (auto-filled)" type="number" step="any" value={idealMax} onChange={e => setIdealMax(e.target.value)} />

                            <div className="sm:col-span-2">
                                <Input label="Reason for Test" value={reason} onChange={e => setReason(e.target.value)} />
                            </div>
                            <div className="sm:col-span-2">
                                <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit">Save Reading</Button>
                        </div>
                    </form>
                </Card>
            ) : (
                <Card>
                    <div className="space-y-4">
                        <p className="text-sm text-zinc-400">
                            Paste CSV data. Format: <code>TestName, Value, Unit, Date(YYYY-MM-DD), IdealMin(opt), IdealMax(opt)</code><br />
                            Example: <code>Blood Sugar, 110, mg/dL, 2026-02-21, 70, 100</code>
                        </p>
                        <textarea
                            className="w-full h-48 bg-zinc-800 border-zinc-700 rounded-md p-3 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="Paste here..."
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <Button onClick={handleBulkSubmit}>Import Bulk Data</Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
};
