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

    // Récupère récursivement TOUS les fichiers
    async getAllFiles(
        dirHandle: FileSystemDirectoryHandle = this.directoryHandle!,
        path = ''
    ): Promise<{ path: string; handle: FileSystemFileHandle }[]> {
        if (!dirHandle) throw new Error("Aucun dossier ouvert.");

        const files: { path: string; handle: FileSystemFileHandle }[] = [];

        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            // Ignorer les dossiers cachés (ex: .git)
            if (entry.name.startsWith('.')) continue;

            const relativePath = path ? `${path}/${entry.name}` : entry.name;

            if (entry.kind === 'file') {
                files.push({ path: relativePath, handle: entry });
            } else if (entry.kind === 'directory') {
                const subFiles = await this.getAllFiles(entry, relativePath);
                files.push(...subFiles);
            }
        }

        return files;
    }
}

export const fileService = new FileService();
