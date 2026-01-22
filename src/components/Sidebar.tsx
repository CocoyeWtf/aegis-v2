import React, { useState, useMemo } from 'react';
import {
    Folder,
    FolderOpen,
    FileText,
    File,
    Search,
    ChevronRight,
    ChevronDown,
    Map,
    Table,
    FileImage,
    FileCode,
    FileJson,
} from 'lucide-react';
import type { Note, Resource } from '../types';
import { buildFileTree, type FileTreeNode } from '../utils/fileTreeUtils';
import './Sidebar.css';

interface SidebarProps {
    notes: Note[];
    resources: Resource[];
    activeNoteId?: string;
    onSelectNote: (note: Note) => void;
    onSelectResource: (resource: Resource) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    notes,
    resources,
    activeNoteId,
    onSelectNote,
    onSelectResource,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    // Construction de l'arbre complet
    const fullTree = useMemo(() => buildFileTree(notes, resources), [notes, resources]);

    // Filtrage (recherche)
    // TODO: Optimisation possible pour ne pas reconstruire l'arbre à chaque frappe si gros volume
    // Pour l'instant on filtre l'arbre construit ou on filtre la liste plate et on reconstruit ?
    // Filtrer la liste plate est plus simple :
    const displayTree = useMemo(() => {
        if (!searchTerm) return fullTree;

        const lowerTerm = searchTerm.toLowerCase();
        const filteredNotes = notes.filter(n =>
            (n.title?.toLowerCase().includes(lowerTerm) || n.relative_path.toLowerCase().includes(lowerTerm))
        );
        const filteredResources = resources.filter(r =>
            r.name.toLowerCase().includes(lowerTerm)
        );

        // On reconstruit l'arbre avec seulement les éléments filtrés
        // Note: Cela perd les dossiers vides ou qui ne contiennent pas de match direct
        // C'est souvent le comportement voulu (montrer seulement ce qui matche)
        return buildFileTree(filteredNotes, filteredResources);
    }, [notes, resources, searchTerm, fullTree]);


    const toggleFolder = (folderId: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        setExpandedFolders(newExpanded);
    };

    // Auto-expand si recherche active
    useMemo(() => {
        if (searchTerm) {
            // Pour une recherche simple, on pourrait tout ouvrir. 
            // Ici on laisse l'utilisateur gérer ou on force open tous les dossiers présents dans l'arbre filtré ?
            // Restons simple : expansion manuelle sauf si besoin. 
            // Amélioration UX : tout ouvrir par défaut quand on cherche.
            const allFolderIds = new Set<string>();
            const collectFolders = (nodes: FileTreeNode[]) => {
                nodes.forEach(node => {
                    if (node.type === 'folder') {
                        allFolderIds.add(node.id);
                        if (node.children) collectFolders(node.children);
                    }
                });
            };
            collectFolders(displayTree);
            setExpandedFolders(allFolderIds);
        }
    }, [displayTree, searchTerm]);

    // Choix de l'icône selon l'extension
    const getResourceIcon = (extension: string) => {
        switch (extension.toLowerCase()) {
            case 'xls':
            case 'xlsx':
            case 'csv':
                return <Table size={15} className="tree-icon icon-xls" />;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'webp':
            case 'svg':
                return <FileImage size={15} className="tree-icon icon-img" />;
            case 'json':
                return <FileJson size={15} className="tree-icon icon-code" />;
            case 'js':
            case 'ts':
            case 'tsx':
            case 'jsx':
            case 'html':
            case 'css':
                return <FileCode size={15} className="tree-icon icon-code" />;
            case 'pdf':
                return <FileText size={15} className="tree-icon icon-pdf" />;
            case 'map':
                return <Map size={15} className="tree-icon icon-map" />;
            default:
                return <File size={15} className="tree-icon icon-default" />;
        }
    };

    const renderTree = (nodes: FileTreeNode[]) => {
        return (
            <ul className="file-tree">
                {nodes.map(node => (
                    <li key={node.id} className="tree-item">
                        {node.type === 'folder' ? (
                            <div className="folder-node">
                                <div
                                    className="tree-label folder-label"
                                    onClick={() => toggleFolder(node.id)}
                                >
                                    {expandedFolders.has(node.id) ? (
                                        <ChevronDown size={14} className="tree-arrow" />
                                    ) : (
                                        <ChevronRight size={14} className="tree-arrow" />
                                    )}
                                    {expandedFolders.has(node.id) ? (
                                        <FolderOpen size={16} className="tree-icon folder-icon" />
                                    ) : (
                                        <Folder size={16} className="tree-icon folder-icon" />
                                    )}
                                    <span className="node-name">{node.name}</span>
                                </div>

                                {expandedFolders.has(node.id) && node.children && (
                                    <div className="folder-children">
                                        {renderTree(node.children)}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                className={`tree-label file-label ${activeNoteId === node.id ? 'active' : ''}`}
                                onClick={() => {
                                    if (node.type === 'note') onSelectNote(node.data as Note);
                                    else onSelectResource(node.data as Resource);
                                }}
                            >
                                <span className="tree-indent" />
                                {/* Indentation visuelle simple si pas dans un folder enfant du DOM 
                    but here we are recursive, so the parent's padding-left is enough */}

                                {node.type === 'note' ? (
                                    <FileText size={15} className="tree-icon note-icon" />
                                ) : (
                                    getResourceIcon((node.data as Resource).extension)
                                )}
                                <span className="node-name">{node.name}</span>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-title">NAVIGATEUR</div>
                <div className="search-box">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
            <div className="sidebar-content">
                {displayTree.length === 0 ? (
                    <div className="empty-search">Aucun résultat</div>
                ) : (
                    renderTree(displayTree)
                )}
            </div>
        </aside>
    );
};
