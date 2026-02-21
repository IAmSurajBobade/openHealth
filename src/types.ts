export interface Patient {
    id: string;
    name: string;
    age?: number;
}

export interface TestReference {
    id: string;
    testName: string;
    category?: string;
    unit: string;
    defaultIdealMin?: number;
    defaultIdealMax?: number;
}

export interface TestReading {
    id: string;
    patientId: string;
    testName: string;
    date: string; // ISO String
    reason?: string;
    value: number;
    idealMin?: number;
    idealMax?: number;
    unit: string;
    notes?: string;
}

export interface UserPreferences {
    sortMembersBy?: 'name' | 'latest' | 'age';
    filterMembersQuery?: string;
    sortTestsBy?: 'name' | 'latest' | 'category';
    filterTestsQuery?: string;
}

export interface UserProfile {
    preferences: UserPreferences;
    patients: Patient[];
    readings: TestReading[];
    testReferences: TestReference[];
}
