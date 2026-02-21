import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Download, Upload } from 'lucide-react';
import { exportEntireProfile, exportTestReferences, importProfile } from '../services/db';
import { getPatients, exportMemberData } from '../services/db';

export const Settings = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<{ id: string, name: string }[]>([]);

    React.useEffect(() => {
        getPatients().then(setPatients);
    }, []);

    const downloadFile = (data: string, filename: string) => {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportProfile = async () => {
        const data = await exportEntireProfile();
        downloadFile(data, `openhealth-profile-${new Date().toISOString().split('T')[0]}.json`);
    };

    const handleExportRefs = async () => {
        const data = await exportTestReferences();
        downloadFile(data, `openhealth-tests-${new Date().toISOString().split('T')[0]}.json`);
    };

    const handleExportMember = async (id: string, name: string) => {
        const data = await exportMemberData(id);
        downloadFile(data, `openhealth-${name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = event.target?.result as string;
                await importProfile(json);
                alert("Import successful!");
                window.location.href = '/'; // Reload to refresh state
            } catch (err) {
                alert("Failed to import data. Please check the file format.");
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
                <Button variant="secondary" onClick={() => navigate('/')} className="p-2">
                    <ArrowLeft size={20} />
                </Button>
                <h1 className="text-2xl font-bold">Settings & Sync</h1>
            </div>

            <div className="grid gap-6">
                <Card>
                    <h2 className="text-lg font-semibold mb-2">Export Data (JSON)</h2>
                    <p className="text-sm text-zinc-400 mb-4">Select what you want to export to a secure JSON file.</p>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-medium">Entire Profile</span>
                                <p className="text-xs text-zinc-500">Includes all members, tests, and your UI preferences.</p>
                            </div>
                            <Button onClick={handleExportProfile} variant="secondary" className="flex items-center gap-2">
                                <Download size={16} /> Export
                            </Button>
                        </div>

                        <div className="flex justify-between items-center">
                            <div>
                                <span className="font-medium">Test References Only</span>
                                <p className="text-xs text-zinc-500">Just the test names, units, and ideal ranges.</p>
                            </div>
                            <Button onClick={handleExportRefs} variant="secondary" className="flex items-center gap-2">
                                <Download size={16} /> Export
                            </Button>
                        </div>

                        <div className="pt-4 border-t border-zinc-700">
                            <span className="font-medium block mb-2">Export Specific Member</span>
                            <div className="flex flex-wrap gap-2">
                                {patients.map(p => (
                                    <Button key={p.id} onClick={() => handleExportMember(p.id, p.name)} variant="secondary" className="text-xs px-2 py-1 flex items-center gap-1">
                                        <Download size={14} /> {p.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card>
                    <h2 className="text-lg font-semibold mb-2">Import Data</h2>
                    <p className="text-sm text-zinc-400 mb-4">Restore your medical data from a JSON file.</p>

                    <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-zinc-600 rounded-lg text-zinc-400 hover:text-white hover:border-blue-500 cursor-pointer transition-colors">
                        <Upload size={20} />
                        <span>Select JSON File</span>
                        <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                    </label>
                </Card>
            </div>
        </div>
    );
};
