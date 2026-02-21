import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPatients, getPatientReadings, deleteReading, updateReading } from '../services/db';
import type { Patient, TestReading } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ArrowLeft, Trash2, Edit2 } from 'lucide-react';

export const ManageReadings = () => {
    const { id, testName } = useParams<{ id: string; testName: string }>();
    const navigate = useNavigate();

    const [patient, setPatient] = useState<Patient | null>(null);
    const [readings, setReadings] = useState<TestReading[]>([]);
    const [decodedTestName, setDecodedTestName] = useState('');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingReading, setEditingReading] = useState<TestReading | null>(null);

    useEffect(() => {
        if (id && testName) {
            const decoded = decodeURIComponent(testName);
            setDecodedTestName(decoded);
            loadData(id, decoded);
        }
    }, [id, testName]);

    const loadData = async (patientId: string, test: string) => {
        const patients = await getPatients();
        setPatient(patients.find(p => p.id === patientId) || null);

        const allReadings = await getPatientReadings(patientId);
        const specificTests = allReadings.filter(r => r.testName === test);
        // Sort newest to oldest so we can see recent stuff at top
        specificTests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReadings(specificTests);
    };

    const toggleSelect = (rid: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(rid)) newSet.delete(rid);
        else newSet.add(rid);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === readings.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(readings.map(r => r.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIds.size} restricted readings?`)) {
            for (const rid of selectedIds) {
                await deleteReading(rid);
            }
            setSelectedIds(new Set());
            if (id && decodedTestName) {
                const newLength = readings.length - selectedIds.size;
                if (newLength <= 0) {
                    navigate(`/patient/${id}`);
                } else {
                    loadData(id, decodedTestName);
                }
            }
        }
    };

    const handleDeleteSingle = async (rid: string) => {
        if (window.confirm('Delete this reading?')) {
            await deleteReading(rid);
            const newSet = new Set(selectedIds);
            newSet.delete(rid);
            setSelectedIds(newSet);
            if (id && decodedTestName) {
                if (readings.length === 1) navigate(`/patient/${id}`);
                else loadData(id, decodedTestName);
            }
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingReading) return;

        await updateReading(editingReading.id, {
            value: Number(editingReading.value),
            date: new Date(editingReading.date).toISOString(),
            notes: editingReading.notes,
            reason: editingReading.reason
        });
        setEditingReading(null);
        if (id && decodedTestName) loadData(id, decodedTestName);
    };

    if (!patient) return <div className="p-8 text-center text-zinc-400">Loading...</div>;

    const navBackUrl = `/patient/${id}/test/${encodeURIComponent(decodedTestName)}`;

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <Button variant="secondary" onClick={() => navigate(navBackUrl)} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Manage {decodedTestName}</h1>
                    <p className="text-sm text-zinc-400">Patient: {patient.name}</p>
                </div>
                {selectedIds.size > 0 && (
                    <Button variant="danger" onClick={handleBulkDelete} className="flex items-center gap-2">
                        <Trash2 size={18} /> Delete Selected ({selectedIds.size})
                    </Button>
                )}
            </div>

            <div className="bg-zinc-800 rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-color)' }}>
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-zinc-900/50">
                        <tr>
                            <th className="p-4 w-12 text-center">
                                <input
                                    type="checkbox"
                                    checked={readings.length > 0 && selectedIds.size === readings.length}
                                    onChange={toggleSelectAll}
                                    className="cursor-pointer"
                                />
                            </th>
                            <th className="p-4 font-medium text-zinc-400">Date</th>
                            <th className="p-4 font-medium text-zinc-400">Value</th>
                            <th className="p-4 font-medium text-zinc-400 w-full">Notes</th>
                            <th className="p-4 font-medium text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                        {readings.map(r => (
                            <tr key={r.id} className="hover:bg-zinc-700/30 transition-colors">
                                <td className="p-4 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(r.id)}
                                        onChange={() => toggleSelect(r.id)}
                                        className="cursor-pointer"
                                    />
                                </td>
                                <td className="p-4">{new Date(r.date).toLocaleDateString()}</td>
                                <td className="p-4 font-medium">{r.value} <span className="text-zinc-500 text-xs">{r.unit}</span></td>
                                <td className="p-4 text-zinc-500 truncate max-w-[150px]" title={r.notes || r.reason}>{r.notes || r.reason || '-'}</td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-3 text-zinc-400">
                                        <button
                                            onClick={() => setEditingReading(r)}
                                            className="hover:text-blue-400 p-1 flex items-center gap-1"
                                            title="Edit"
                                        >
                                            <Edit2 size={16} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSingle(r.id)}
                                            className="hover:text-red-400 p-1 flex items-center gap-1"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Reading Modal */}
            <Modal isOpen={!!editingReading} onClose={() => setEditingReading(null)} title="Edit Reading">
                {editingReading && (
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <Input
                            label="Date"
                            type="datetime-local"
                            required
                            value={new Date(editingReading.date).toISOString().slice(0, 16)}
                            onChange={(e) => setEditingReading({ ...editingReading, date: e.target.value })}
                        />
                        <Input
                            label="Value"
                            type="number"
                            step="any"
                            required
                            value={editingReading.value}
                            onChange={(e) => setEditingReading({ ...editingReading, value: parseFloat(e.target.value) })}
                        />
                        <Input
                            label="Reason"
                            value={editingReading.reason || ''}
                            onChange={(e) => setEditingReading({ ...editingReading, reason: e.target.value })}
                        />
                        <Input
                            label="Notes"
                            value={editingReading.notes || ''}
                            onChange={(e) => setEditingReading({ ...editingReading, notes: e.target.value })}
                        />
                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="secondary" onClick={() => setEditingReading(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};
