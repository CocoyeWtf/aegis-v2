export class FileService {
    private directoryHandle: FileSystemDirectoryHandle | null = null;

    // Demande à l'utilisateur de sélectionner un dossier
    async openDirectory(): Promise<FileSystemDirectoryHandle> {
        try {
            // @ts-ignore - 'showDirectoryPicker' n'est pas encore dans tous les types TS standard
            const handle = await window.showDirectoryPicker();
            this.directoryHandle = handle;
            return handle;
        } catch (error) {
            console.error("Erreur lors de l'ouverture du dossier:", error);
            throw error;
        }
    }

    // Lit le contenu texte d'un fichier via son handle
    async readFile(fileHandle: FileSystemFileHandle): Promise<string> {
        const file = await fileHandle.getFile();
        return await file.text();
    }

    // Setter pour restaurer le handle (depuis la DB par ex)
    setDirectoryHandle(handle: FileSystemDirectoryHandle) {
        this.directoryHandle = handle;
    }

    // Récupère le handle d'un fichier spécifique
    async getFileHandle(relativePath: string): Promise<FileSystemFileHandle | null> {
        if (!this.directoryHandle) return null;

        try {
            const parts = relativePath.split('/');
            const fileName = parts.pop()!;
            let currentDir = this.directoryHandle;

            // Naviguer dans les dossiers
            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part);
            }

            // Récupérer le fichier
            return await currentDir.getFileHandle(fileName);
        } catch (error) {
            console.error(`Impossible de récupérer le handle pour ${relativePath}`, error);
            return null;
        }
    }

    // Récupère récursivement TOUS les fichiers + dossiers
    async getFlatEntries(
        dirHandle: FileSystemDirectoryHandle = this.directoryHandle!,
        path = ''
    ): Promise<{ path: string; handle: FileSystemHandle; kind: 'file' | 'directory' }[]> {
        if (!dirHandle) throw new Error("Aucun dossier ouvert.");

        const entries: { path: string; handle: FileSystemHandle; kind: 'file' | 'directory' }[] = [];

        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue;

            const relativePath = path ? `${path}/${entry.name}` : entry.name;
            entries.push({ path: relativePath, handle: entry, kind: entry.kind });

            if (entry.kind === 'directory') {
                const subEntries = await this.getFlatEntries(entry, relativePath);
                entries.push(...subEntries);
            }
        }

        return entries;
    }

    // Récupère récursivement TOUS les fichiers (Backward compatibility / Helper)
    async getAllFiles(
        dirHandle: FileSystemDirectoryHandle = this.directoryHandle!,
        path = ''
    ): Promise<{ path: string; handle: FileSystemFileHandle }[]> {
        const all = await this.getFlatEntries(dirHandle, path);
        return all
            .filter(e => e.kind === 'file')
            .map(e => ({ path: e.path, handle: e.handle as FileSystemFileHandle }));
    }
    // Vérifie et demande la permission si nécessaire
    async verifyPermission(handle: FileSystemHandle, readWrite: boolean = false): Promise<boolean> {
        const options: any = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }

        // @ts-ignore
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }

        // @ts-ignore
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }

        return false;
    }

    // Crée (ou récupère) un dossier récursivement
    async createDirectory(path: string): Promise<FileSystemDirectoryHandle> {
        if (!this.directoryHandle) throw new Error("Aucun dossier racine ouvert.");

        // Vérifier les permissions d'écriture à la racine
        const hasPerm = await this.verifyPermission(this.directoryHandle, true);
        if (!hasPerm) {
            throw new Error("Permission d'écriture refusée sur le dossier racine.");
        }

        const parts = path.split('/').filter(p => p.length > 0);
        let currentDir = this.directoryHandle;

        try {
            for (const part of parts) {
                // getDirectoryHandle avec create: true crée le dossier s'il n'existe pas
                currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            }
            return currentDir;
        } catch (error) {
            console.error(`Erreur création dossier '${path}':`, error);
            throw error;
        }
    }

    // Crée un fichier et écrit le contenu
    async createFile(path: string, content: string): Promise<void> {
        if (!this.directoryHandle) throw new Error("Aucun dossier racine ouvert.");

        try {
            const parts = path.split('/');
            const fileName = parts.pop()!;
            const dirPath = parts.join('/');

            // Vérifier les permissions avant de commencer
            const hasPerm = await this.verifyPermission(this.directoryHandle, true);
            if (!hasPerm) {
                throw new Error("Permission d'écriture refusée (Root).");
            }

            // 1. S'assurer que le dossier parent existe
            // Si dirPath est vide, createDirectory retourne la racine
            const dirHandle = await this.createDirectory(dirPath);

            // 2. Créer le fichier
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

            // 3. Écrire le contenu
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (error) {
            console.error(`Erreur création fichier '${path}':`, error);
            throw error; // Propager pour l'UI
        }
    }

    // Récupère le handle du dossier parent d'un chemin
    async getParentHandle(path: string): Promise<FileSystemDirectoryHandle> {
        if (!this.directoryHandle) throw new Error("Aucun dossier racine ouvert.");

        const parts = path.split('/');
        parts.pop(); // Retirer le nom du fichier/dossier cible

        let currentDir = this.directoryHandle;
        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part, { create: false });
        }
        return currentDir;
    }

    // Supprime un fichier ou un dossier
    async deleteEntry(path: string): Promise<void> {
        try {
            await this.verifyPermission(this.directoryHandle!, true);

            const parent = await this.getParentHandle(path);
            const name = path.split('/').pop()!;

            await parent.removeEntry(name, { recursive: true });
        } catch (error) {
            console.error(`Erreur suppression '${path}':`, error);
            throw error;
        }
    }

    // Renomme un fichier ou dossier (Move ou Copy+Delete)
    async renameEntry(oldPath: string, newPath: string): Promise<void> {
        try {
            await this.verifyPermission(this.directoryHandle!, true);
            const parent = await this.getParentHandle(oldPath);
            const name = oldPath.split('/').pop()!;

            // 1. Tenter move() si disponible
            const oldHandle = await this.getFileHandle(oldPath).catch(() => null)
                || await parent.getDirectoryHandle(name).catch(() => null);

            if (!oldHandle) throw new Error("Impossible de trouver l'élément source.");

            let moved = false;
            // @ts-ignore
            if (oldHandle.move) {
                try {
                    // @ts-ignore
                    await oldHandle.move(newPath.split('/').pop()!);
                    moved = true;
                } catch (e) {
                    console.warn("La méthode native move() a échoué, passage en fallback Copy+Delete", e);
                }
            }

            if (moved) return;

            // 2. Fallback: Copy + Delete (Prise en charge systématique des fichiers et dossiers)
            if (oldHandle.kind === 'file') {
                const content = await this.readFile(oldHandle as FileSystemFileHandle);
                await this.createFile(newPath, content);
                await parent.removeEntry(name);
            } else {
                // Si c'est un dossier, on fait une copie récursive
                await this.copyRecursive(oldHandle as FileSystemDirectoryHandle, newPath);
                await parent.removeEntry(name, { recursive: true });
            }

        } catch (error) {
            console.error(`Erreur renommage '${oldPath}' -> '${newPath}':`, error);
            throw error;
        }
    }

    // Copie récursive d'un fichier ou dossier vers un nouveau chemin
    async copyRecursive(sourceHandle: FileSystemHandle, destPath: string): Promise<void> {
        if (sourceHandle.kind === 'file') {
            const content = await this.readFile(sourceHandle as FileSystemFileHandle);
            await this.createFile(destPath, content);
        } else if (sourceHandle.kind === 'directory') {
            const dirHandle = sourceHandle as FileSystemDirectoryHandle;
            await this.createDirectory(destPath); // Assure que le dossier cible existe

            // @ts-ignore
            for await (const entry of dirHandle.values()) {
                const newEntryPath = `${destPath}/${entry.name}`;
                await this.copyRecursive(entry, newEntryPath);
            }
        }
    }
}

export const fileService = new FileService();
