import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatients, deletePatient, updatePatient } from '../services/db';
import type { Patient } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ArrowLeft, Trash2, Edit2 } from 'lucide-react';

export const ManageMembers = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [editingMember, setEditingMember] = useState<Patient | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const p = await getPatients();
        setPatients(p.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === patients.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(patients.map(p => p.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIds.size} members AND all their records? This cannot be undone.`)) {
            for (const id of selectedIds) {
                await deletePatient(id);
            }
            setSelectedIds(new Set());
            loadData();
        }
    };

    const handleDeleteSingle = async (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to delete ${name} and ALL their test records?`)) {
            await deletePatient(id);
            const newSet = new Set(selectedIds);
            newSet.delete(id);
            setSelectedIds(newSet);
            loadData();
        }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember || !editingMember.name.trim()) return;

        await updatePatient(editingMember.id, {
            name: editingMember.name.trim(),
            age: editingMember.age ? parseInt(editingMember.age.toString(), 10) : undefined
        });
        setEditingMember(null);
        loadData();
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <Button variant="secondary" onClick={() => navigate('/')} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Manage Members</h1>
                    <p className="text-sm text-zinc-400">Bulk delete or edit existing members</p>
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
                                    checked={patients.length > 0 && selectedIds.size === patients.length}
                                    onChange={toggleSelectAll}
                                    className="cursor-pointer"
                                />
                            </th>
                            <th className="p-4 font-medium text-zinc-400">Name</th>
                            <th className="p-4 font-medium text-zinc-400">Age</th>
                            <th className="p-4 font-medium text-zinc-400 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/50">
                        {patients.map(p => (
                            <tr key={p.id} className="hover:bg-zinc-700/30 transition-colors">
                                <td className="p-4 text-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(p.id)}
                                        onChange={() => toggleSelect(p.id)}
                                        className="cursor-pointer"
                                    />
                                </td>
                                <td className="p-4 font-medium">{p.name}</td>
                                <td className="p-4 text-zinc-500">{p.age || '-'}</td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-3 text-zinc-400">
                                        <button
                                            onClick={() => setEditingMember(p)}
                                            className="hover:text-blue-400 p-1 flex items-center gap-1"
                                            title="Edit Member"
                                        >
                                            <Edit2 size={16} /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSingle(p.id, p.name)}
                                            className="hover:text-red-400 p-1 flex items-center gap-1"
                                            title="Delete Member"
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {patients.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-zinc-500">
                                    No members found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Member Modal */}
            <Modal isOpen={!!editingMember} onClose={() => setEditingMember(null)} title="Edit Member">
                <form onSubmit={handleEditSubmit} className="space-y-4">
                    <Input
                        label="Name"
                        required
                        value={editingMember?.name || ''}
                        onChange={e => setEditingMember(prev => prev ? { ...prev, name: e.target.value } : null)}
                        autoFocus
                    />
                    <Input
                        label="Age (optional)"
                        type="number"
                        value={editingMember?.age || ''}
                        onChange={e => setEditingMember(prev => prev ? { ...prev, age: e.target.value as any } : null)}
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setEditingMember(null)}>
                            Cancel
                        </Button>
                        <Button type="submit">Save Changes</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
