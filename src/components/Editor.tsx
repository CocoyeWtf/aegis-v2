import React, { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import MarkdownIt from 'markdown-it';
import TurndownService from 'turndown';
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
// @ts-ignore
import mark from 'markdown-it-mark';

import {
    Bold,
    Italic,
    List,
    Highlighter
} from 'lucide-react';
import type { Note } from '../types';
import './Editor.css';

interface EditorProps {
    note: Note;
    onSave: (note: Note, content: string) => Promise<void>;
}

// Configuration Markdown
const mdParser = new MarkdownIt({
    html: true,
    linkify: true,
    breaks: true, // Convert \n to <br>
});
mdParser.use(mark);

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*', // Use asterisks for italics
    bulletListMarker: '-', // Use hyphens for lists
});
turndownService.use(gfm);

// Rule for ==highlight==
turndownService.addRule('mark', {
    filter: 'mark',
    replacement: function (content) {
        return '==' + content + '==';
    }
});

// Custom handling to ensure compact lines
// We override default padding for specific blocks or just rely on post-processing?
// Turndown's default blankReplacement adds \n\n. We want to be smart.
// For now, let's keep robust paragraph separation (\n\n) because Markdown NEEDS it for P.
// But we can ensure we don't have \n\n\n+.


export const Editor: React.FC<EditorProps> = ({ note, onSave }) => {
    const [isSaving, setIsSaving] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Highlight,
        ],
        content: '',
        onUpdate: ({ editor }) => {
            // Debounce save logic handled via useEffect dependency or timeout
            handleDebouncedSave(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert focus:outline-none max-w-none',
            },
        },
    });

    // Load Content
    useEffect(() => {
        if (editor && note) {
            // Only update if content is effectively different to avoid loop/cursor jump
            // But here we switch note, so we must update.
            // Check if we are switching notes:
            const html = mdParser.render(note.content || '');
            editor.commands.setContent(html);
        }
    }, [note.relative_path, editor]); // Depend on relative_path relative to switch

    // Debounce Save impl
    // Ref to hold the latest timeout
    const saveTimeoutRef = React.useRef<any>(null);

    const handleDebouncedSave = useCallback((htmlContent: string) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                let markdown = turndownService.turndown(htmlContent);

                // Nettoyage des sauts de ligne excessifs
                // Remplace 3+ sauts de ligne par 2
                markdown = markdown.replace(/\n{3,}/g, '\n\n');

                // Optionnel : Retirer les sauts de ligne finaux
                markdown = markdown.trim();

                // Eviter de sauvegarder si pas de changement réel (optionnel mais bien)
                await onSave(note, markdown);
            } catch (e) {
                console.error("Auto-save failed", e);
            } finally {
                setIsSaving(false);
            }
        }, 1500); // 1.5s debounce
    }, [note, onSave]);

    if (!editor) {
        return null;
    }

    return (
        <div className="editor-container">
            <div className="editor-toolbar">
                <div className="toolbar-group">
                    <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`toolbar-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
                        title="Gras (Ctrl+B)"
                    >
                        <Bold size={16} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`toolbar-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
                        title="Italique (Ctrl+I)"
                    >
                        <Italic size={16} />
                    </button>
                    <button
                        onClick={() => editor.chain().focus().toggleHighlight().run()}
                        className={`toolbar-btn ${editor.isActive('highlight') ? 'is-active' : ''}`}
                        title="Surligner"
                    >
                        <Highlighter size={16} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                <div className="toolbar-group">
                    <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`toolbar-btn ${editor.isActive('bulletList') ? 'is-active' : ''}`}
                        title="Liste à puces"
                    >
                        <List size={16} />
                    </button>
                </div>

                <div className="toolbar-spacer" />

                <div className="save-indicator">
                    {isSaving ? (
                        <span className="saving-text">Sauvegarde...</span>
                    ) : (
                        <span className="saved-text" style={{ opacity: 0.5 }}>Synchronisé</span>
                    )}
                </div>
            </div>

            <div className="editor-content-wrapper">
                <div className="note-title-bar">
                    <span className="note-path">{note.relative_path}</span>
                </div>
                <EditorContent editor={editor} className="tiptap-editor" />
            </div>
        </div>
    );
};
