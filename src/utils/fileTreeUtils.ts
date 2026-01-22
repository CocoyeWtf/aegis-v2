import type { Note, Resource } from '../types';

export interface FileTreeNode {
    id: string; // relative_path ou nom du dossier
    name: string;
    type: 'folder' | 'note' | 'resource';
    children?: FileTreeNode[];
    data?: Note | Resource; // Données associées si c'est un fichier
}

/**
 * Construit un arbre de fichiers à partir d'une liste plate de Notes et Ressources.
 */
export function buildFileTree(notes: Note[], resources: Resource[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const map: Record<string, FileTreeNode> = {};

    // Fonction helper pour obtenir ou créer un nœud dossier
    const getOrCreateFolder = (path: string, parentPath: string): FileTreeNode => {
        if (map[path]) return map[path];

        const folderName = path.split('/').pop() || path;
        const newNode: FileTreeNode = {
            id: path,
            name: folderName,
            type: 'folder',
            children: [],
        };

        map[path] = newNode;

        if (parentPath === '') {
            root.push(newNode);
        } else {
            const parent = getOrCreateFolder(parentPath, parentPath.split('/').slice(0, -1).join('/'));
            parent.children?.push(newNode);
        }

        return newNode;
    };

    // Traitement des items (Notes et Ressources mélangées)
    const allItems = [
        ...notes.map(n => ({ ...n, itemType: 'note' as const })),
        ...resources.map(r => ({ ...r, itemType: 'resource' as const }))
    ];

    allItems.forEach(item => {
        const parts = item.relative_path.split('/');
        const fileName = parts.pop()!;
        const dirPath = parts.join('/');

        const node: FileTreeNode = {
            id: item.relative_path,
            name: item.itemType === 'resource' ? (item as Resource).name : (item as Note).title || fileName.replace('.md', ''),
            type: item.itemType,
            data: item,
        };

        if (dirPath === '') {
            root.push(node);
        } else {
            const parent = getOrCreateFolder(dirPath, dirPath.split('/').slice(0, -1).join('/'));
            parent.children?.push(node);
        }
    });

    // Tri récursif : Dossiers d'abord, puis alphabétique
    const sortTree = (nodes: FileTreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => {
            if (node.children) sortTree(node.children);
        });
    };

    sortTree(root);
    return root;
}
