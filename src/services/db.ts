import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Patient, TestReading, TestReference, UserProfile, UserPreferences } from '../types';
import { defaultTests } from '../data/defaultTests';

interface HealthTrackerDB extends DBSchema {
    patients: {
        key: string;
        value: Patient;
    };
    readings: {
        key: string;
        value: TestReading;
        indexes: { 'by-patientId': string; 'by-testName': string; 'by-date': string };
    };
    testReferences: {
        key: string;
        value: TestReference;
        indexes: { 'by-testName': string };
    };
    preferences: {
        key: string;
        value: UserPreferences;
    };
}

const DB_NAME = 'HealthTrackerDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HealthTrackerDB>> | null = null;

export const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<HealthTrackerDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('patients')) {
                    db.createObjectStore('patients', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('readings')) {
                    const readingStore = db.createObjectStore('readings', { keyPath: 'id' });
                    readingStore.createIndex('by-patientId', 'patientId');
                    readingStore.createIndex('by-testName', 'testName');
                    readingStore.createIndex('by-date', 'date');
                }
                if (!db.objectStoreNames.contains('testReferences')) {
                    const testRefStore = db.createObjectStore('testReferences', { keyPath: 'id' });
                    testRefStore.createIndex('by-testName', 'testName');
                }
                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences');
                }
            },
        }).then(async (db) => {
            // Seed default references if empty
            const tx = db.transaction('testReferences', 'readonly');
            const count = await tx.store.count();
            if (count === 0) {
                const writeTx = db.transaction('testReferences', 'readwrite');
                for (const test of defaultTests) {
                    await writeTx.store.put(test);
                }
                await writeTx.done;
            }
            return db;
        });
    }
    return dbPromise as Promise<IDBPDatabase<HealthTrackerDB>>;
};

// --- Patients ---
export const getPatients = async (): Promise<Patient[]> => {
    const db = await initDB();
    return db.getAll('patients');
};

export const savePatient = async (patient: Patient): Promise<void> => {
    const db = await initDB();
    await db.put('patients', patient);
};

export const deletePatient = async (id: string): Promise<void> => {
    const db = await initDB();
    await db.delete('patients', id);
    // Also delete associated readings
    const tx = db.transaction('readings', 'readwrite');
    const index = tx.store.index('by-patientId');
    let cursor = await index.openCursor(id);
    while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
    }
    await tx.done;
};

// --- Readings ---
export const getPatientReadings = async (patientId: string): Promise<TestReading[]> => {
    const db = await initDB();
    return db.getAllFromIndex('readings', 'by-patientId', patientId);
};

export const saveReading = async (reading: TestReading): Promise<void> => {
    const db = await initDB();
    await db.put('readings', reading);

    // Auto-upsert TestReference based on reading
    const existingRefs = await db.getAllFromIndex('testReferences', 'by-testName', reading.testName);
    if (existingRefs.length === 0) {
        await db.put('testReferences', {
            id: reading.testName.toLowerCase().replace(/\s+/g, '-'),
            testName: reading.testName,
            unit: reading.unit,
            defaultIdealMin: reading.idealMin,
            defaultIdealMax: reading.idealMax
        });
    }
};

export const bulkSaveReadings = async (readings: TestReading[]): Promise<void> => {
    const db = await initDB();
    const tx = db.transaction(['readings', 'testReferences'], 'readwrite');
    for (const reading of readings) {
        await tx.objectStore('readings').put(reading);

        // Check if test reference exists and create if not
        const refsStore = tx.objectStore('testReferences');
        const existingRefIndex = refsStore.index('by-testName');
        const existingRefs = await existingRefIndex.getAll(reading.testName);

        if (existingRefs.length === 0) {
            await refsStore.put({
                id: reading.testName.toLowerCase().replace(/\s+/g, '-'),
                testName: reading.testName,
                unit: reading.unit,
                defaultIdealMin: reading.idealMin,
                defaultIdealMax: reading.idealMax
            });
        }
    }
    await tx.done;
};

// --- References ---
export const getTestReferences = async (): Promise<TestReference[]> => {
    const db = await initDB();
    return db.getAll('testReferences');
};

export const saveTestReference = async (ref: TestReference): Promise<void> => {
    const db = await initDB();
    await db.put('testReferences', ref);
};

// --- Preferences ---
export const getPreferences = async (): Promise<UserPreferences> => {
    const db = await initDB();
    const prefs = await db.get('preferences', 'user_prefs');
    return prefs || {};
};

export const savePreferences = async (prefs: UserPreferences): Promise<void> => {
    const db = await initDB();
    // Merge with existing
    const existing = await getPreferences();
    await db.put('preferences', { ...existing, ...prefs }, 'user_prefs');
};

// --- Exports & Imports ---
export const exportMemberData = async (patientId: string): Promise<string> => {
    const db = await initDB();
    const patient = await db.get('patients', patientId);
    const readings = await getPatientReadings(patientId);
    return JSON.stringify({ patient, readings }, null, 2);
};

export const exportTestReferences = async (): Promise<string> => {
    const refs = await getTestReferences();
    return JSON.stringify({ testReferences: refs }, null, 2);
};

export const exportEntireProfile = async (): Promise<string> => {
    const [patients, readings, testReferences, preferences] = await Promise.all([
        getPatients(),
        initDB().then(db => db.getAll('readings')),
        getTestReferences(),
        getPreferences()
    ]);

    const profile: UserProfile = { patients, readings, testReferences, preferences };
    return JSON.stringify(profile, null, 2);
};

export const importProfile = async (jsonString: string): Promise<void> => {
    try {
        const data: Partial<UserProfile> = JSON.parse(jsonString);
        const db = await initDB();

        // Depending on what is in the JSON, we import it
        if (data.patients && data.readings) {
            const tx = db.transaction(['patients', 'readings', 'testReferences', 'preferences'], 'readwrite');

            // Clear old data if doing a full profile import? Or just merge. Let's merge/upsert.
            for (const p of data.patients) await tx.objectStore('patients').put(p);
            for (const r of data.readings) await tx.objectStore('readings').put(r);
            if (data.testReferences) {
                for (const ref of data.testReferences) await tx.objectStore('testReferences').put(ref);
            }
            if (data.preferences) {
                await tx.objectStore('preferences').put(data.preferences, 'user_prefs');
            }
            await tx.done;
        } else if ((data as any).patient && (data as any).readings) { // Member data import
            const tx = db.transaction(['patients', 'readings'], 'readwrite');
            await tx.objectStore('patients').put((data as any).patient);
            for (const r of (data as any).readings) await tx.objectStore('readings').put(r);
            await tx.done;
        } else if (data.testReferences) { // Reference import
            const tx = db.transaction('testReferences', 'readwrite');
            for (const ref of data.testReferences) await tx.objectStore('testReferences').put(ref);
            await tx.done;
        } else {
            throw new Error("Invalid import format");
        }
    } catch (error) {
        console.error("Import failed:", error);
        throw error;
    }
};
