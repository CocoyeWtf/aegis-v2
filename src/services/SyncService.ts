import { dbService } from './DatabaseService';
import { fileService } from './FileService';
import type { Note, Resource } from '../types';

export class SyncService {
    // Importe les fichiers du dossier local dans la base de données
    async importFiles(): Promise<{ notes: number; resources: number }> {
        try {
            const files = await fileService.getAllFiles();
            let noteCount = 0;
            let resourceCount = 0;

            for (const { path, handle } of files) {
                const extension = path.split('.').pop()?.toLowerCase() || '';
                const fileName = path.split('/').pop() || '';

                if (extension === 'md') {
                    // C'est une Note
                    const content = await fileService.readFile(handle);
                    const note: Note = {
                        relative_path: path,
                        content: content,
                        last_modified: Date.now(), // TODO: Utiliser la vraie date de modif si possible via getFile()
                        title: fileName.replace('.md', '')
                    };
                    await dbService.putNote(note);
                    noteCount++;
                } else {
                    // C'est une Ressource
                    const file = await handle.getFile();
                    const resource: Resource = {
                        relative_path: path,
                        name: fileName,
                        extension: extension,
                        size: file.size,
                        last_modified: file.lastModified
                    };
                    await dbService.putResource(resource);
                    resourceCount++;
                }
            }

            console.log(`Indexation terminée : ${noteCount} notes, ${resourceCount} ressources.`);
            return { notes: noteCount, resources: resourceCount };
        } catch (error) {
            console.error("Erreur lors de l'importation:", error);
            throw error;
        }
    }
}

export const syncService = new SyncService();
