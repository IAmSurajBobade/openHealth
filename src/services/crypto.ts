/**
 * Cryptography Service (Future API Integration Stub)
 *
 * This service provides a foundation for securely encrypting data payloads
 * before they are transmitted over the network via any future API.
 * Currently uses the Web Crypto API.
 */

export const generateEncryptionKey = async (): Promise<CryptoKey> => {
    return await window.crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256,
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
};

export const encryptPayload = async (data: string, key: CryptoKey): Promise<{ encryptedData: string; iv: number[] }> => {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Initialization vector

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
    );

    // Convert buffer to base64 string
    const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
    const encryptedData = btoa(String.fromCharCode(...encryptedArray));

    return {
        encryptedData,
        iv: Array.from(iv)
    };
};

export const decryptPayload = async (encryptedData: string, iv: number[], key: CryptoKey): Promise<string> => {
    const decoder = new TextDecoder();
    const encryptedArray = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const ivArray = new Uint8Array(iv);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivArray },
        key,
        encryptedArray
    );

    return decoder.decode(decryptedBuffer);
};
