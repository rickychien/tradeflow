
import { get, set } from 'idb-keyval';

const HANDLE_KEY = 'tradeflow_sync_handle';

export interface SyncStatus {
    isActive: boolean;
    lastSyncTime: string | null;
    fileName: string | null;
    error?: string;
}

export const getStoredHandle = async (): Promise<FileSystemFileHandle | undefined> => {
    return await get<FileSystemFileHandle>(HANDLE_KEY);
};

export const verifyPermission = async (fileHandle: FileSystemFileHandle, readWrite: boolean = true): Promise<boolean> => {
    const options: FileSystemHandlePermissionDescriptor = {
        mode: readWrite ? 'readwrite' : 'read',
    };

    // Check if permission was already granted. If so, return true.
    if ((await fileHandle.queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission. If the user grants permission, return true.
    if ((await fileHandle.requestPermission(options)) === 'granted') {
        return true;
    }

    // The user didn't grant permission, so return false.
    return false;
};

export const selectSyncFile = async (): Promise<FileSystemFileHandle> => {
    const opts: SaveFilePickerOptions = {
        suggestedName: 'tradeflow_backup.json',
        types: [{
            description: 'JSON File',
            accept: { 'application/json': ['.json'] },
        }],
    };

    // @ts-ignore - types might be missing for window.showSaveFilePicker
    const handle = await window.showSaveFilePicker(opts);
    await set(HANDLE_KEY, handle);
    return handle;
};

export const saveToSyncedFile = async (data: string): Promise<void> => {
    const handle = await getStoredHandle();
    if (!handle) {
        throw new Error("No sync file configured.");
    }

    // Verify permission before writing (might trigger prompt if not granted in this session)
    // Note: Writing automatically allows 'granted' persistence in some contexts but prompt is needed on reload.
    // Ideally, we verify permission on app load or user interaction.
    const hasPerm = await verifyPermission(handle, true);
    if (!hasPerm) {
        throw new Error("Permission denied. Click 'Reconnect' in Settings.");
    }

    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
};

export const clearSyncHandle = async () => {
    await set(HANDLE_KEY, null); // Actually clear it
};
