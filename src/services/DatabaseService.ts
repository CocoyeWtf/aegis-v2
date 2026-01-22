import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Note, Resource } from '../types';

interface AegisDB extends DBSchema {
    notes: {
        key: string; // relative_path
        value: Note;
        indexes: { 'by-title': string };
    };
    resources: {
        key: string; // relative_path
        value: Resource;
    };
    workspace: {
        key: string; // 'root'
        value: FileSystemDirectoryHandle;
    };
}

class DatabaseService {
    private dbPromise: Promise<IDBPDatabase<AegisDB>>;

    constructor() {
        this.dbPromise = openDB<AegisDB>('aegis-v2-db', 2, {
            upgrade(db, oldVersion, _newVersion, _transaction) {
                // v1: notes
                if (oldVersion < 1) {
                    const noteStore = db.createObjectStore('notes', { keyPath: 'relative_path' });
                    noteStore.createIndex('by-title', 'title');
                }

                // v2: resources + workspace
                if (oldVersion < 2) {
                    if (!db.objectStoreNames.contains('resources')) {
                        db.createObjectStore('resources', { keyPath: 'relative_path' });
                    }
                    if (!db.objectStoreNames.contains('workspace')) {
                        db.createObjectStore('workspace');
                    }
                }
            },
        });
    }

    // --- Notes ---
    async getNote(relativePath: string): Promise<Note | undefined> {
        const db = await this.dbPromise;
        return db.get('notes', relativePath);
    }

    async putNote(note: Note): Promise<string> {
        const db = await this.dbPromise;
        return db.put('notes', note);
    }

    async getAllNotes(): Promise<Note[]> {
        const db = await this.dbPromise;
        return db.getAll('notes');
    }

    async deleteNote(relativePath: string): Promise<void> {
        const db = await this.dbPromise;
        return db.delete('notes', relativePath);
    }

    // --- Resources ---
    async putResource(resource: Resource): Promise<string> {
        const db = await this.dbPromise;
        return db.put('resources', resource);
    }

    async getAllResources(): Promise<Resource[]> {
        const db = await this.dbPromise;
        return db.getAll('resources');
    }

    // --- Workspace ---
    async saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<string> {
        const db = await this.dbPromise;
        return db.put('workspace', handle, 'root');
    }

    async getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
        const db = await this.dbPromise;
        return db.get('workspace', 'root');
    }
}

export const dbService = new DatabaseService();
