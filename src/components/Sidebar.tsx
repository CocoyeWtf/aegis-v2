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
    FolderPlus,
    FilePlus,
} from 'lucide-react';
import type { Note, Resource } from '../types';
import { buildFileTree, type FileTreeNode } from '../utils/fileTreeUtils';
import './Sidebar.css';

interface SidebarProps {
    notes: Note[];
    resources: Resource[];
    folders: string[];
    activeNoteId?: string;
    onSelectNote: (note: Note) => void;
    onSelectResource: (resource: Resource) => void;
    onCreateFolder: (name: string) => void;
    onCreateNote: (name: string) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    notes,
    resources,
    folders,
    activeNoteId,
    onSelectNote,
    onSelectResource,
    onCreateFolder,
    onCreateNote,
    onRename,
    onDelete,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; type: string } | null>(null);

    // Construction de l'arbre complet
    const fullTree = useMemo(() => buildFileTree(notes, resources, folders), [notes, resources, folders]);

    // Filtrage (recherche)
    const displayTree = useMemo(() => {
        if (!searchTerm) return fullTree;

        const lowerTerm = searchTerm.toLowerCase();
        const filteredNotes = notes.filter(n =>
            (n.title?.toLowerCase().includes(lowerTerm) || n.relative_path.toLowerCase().includes(lowerTerm))
        );
        const filteredResources = resources.filter(r =>
            r.name.toLowerCase().includes(lowerTerm)
        );

        return buildFileTree(filteredNotes, filteredResources);
    }, [notes, resources, searchTerm, fullTree]);

    // Fermer le menu au clic ailleurs
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const toggleFolder = (folderId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId);
        } else {
            newExpanded.add(folderId);
        }
        setExpandedFolders(newExpanded);
    };

    const handleFolderClick = (folderId: string) => {
        setSelectedFolderId(folderId === selectedFolderId ? null : folderId);
    };

    const handleContextMenu = (e: React.MouseEvent, id: string, type: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, id, type });
    };

    // Auto-expand si recherche active
    useMemo(() => {
        if (searchTerm) {
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

    const handleCreateFolderClick = () => {
        const name = prompt("Nom du nouveau dossier ?");
        if (name) {
            const fullPath = selectedFolderId ? `${selectedFolderId}/${name}` : name;
            onCreateFolder(fullPath);
        }
    };

    const handleCreateNoteClick = () => {
        const name = prompt("Nom de la nouvelle note (.md) ?");
        if (name) {
            const fileName = name.endsWith('.md') ? name : `${name}.md`;
            const fullPath = selectedFolderId ? `${selectedFolderId}/${fileName}` : fileName;
            onCreateNote(fullPath);
        }
    };

    const handleRenameClick = () => {
        if (!contextMenu) return;
        const currentName = contextMenu.id.split('/').pop();
        const newName = prompt("Nouveau nom :", currentName);
        if (newName && newName !== currentName) {
            onRename(contextMenu.id, newName);
        }
        setContextMenu(null);
    };

    const handleDeleteClick = () => {
        if (!contextMenu) return;
        if (confirm(`Êtes-vous sûr de vouloir supprimer "${contextMenu.id}" ?`)) {
            onDelete(contextMenu.id);
        }
        setContextMenu(null);
    };


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
                                    className={`tree-label folder-label ${selectedFolderId === node.id ? 'active' : ''}`}
                                    onClick={() => handleFolderClick(node.id)}
                                    onContextMenu={(e) => handleContextMenu(e, node.id, 'folder')}
                                >
                                    <span
                                        className="folder-toggle-click-area"
                                        onClick={(e) => toggleFolder(node.id, e)}
                                        style={{ display: 'flex', alignItems: 'center', marginRight: '4px' }}
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
                                    </span>
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
                                onContextMenu={(e) => handleContextMenu(e, node.id, node.type)}
                            >
                                <span className="tree-indent" />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div className="sidebar-title" style={{ marginBottom: 0 }}>NAVIGATEUR</div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleCreateFolderClick} className="icon-btn" title="Nouveau dossier" style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--cockpit-text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s, color 0.2s',
                        }}>
                            <FolderPlus size={16} />
                        </button>
                        <button onClick={handleCreateNoteClick} className="icon-btn" title="Nouvelle note" style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--cockpit-text-muted)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s, color 0.2s',
                        }}>
                            <FilePlus size={16} />
                        </button>
                    </div>
                </div>
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

            {contextMenu && (
                <div style={{
                    position: 'fixed',
                    top: contextMenu.y,
                    left: contextMenu.x,
                    background: 'var(--cockpit-sidebar-bg)',
                    border: '1px solid var(--cockpit-border)',
                    borderRadius: '4px',
                    padding: '4px 0',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    minWidth: '150px'
                }}>
                    <div className="context-menu-item" onClick={handleRenameClick} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--cockpit-text)' }}>
                        Renommer
                    </div>
                    <div className="context-menu-item" onClick={handleDeleteClick} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.85rem', color: '#ff6b6b' }}>
                        Supprimer
                    </div>
                </div>
            )}
        </aside>
    );
};
