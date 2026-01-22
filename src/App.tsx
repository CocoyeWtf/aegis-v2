import { useState, useEffect } from 'react';
import { fileService } from './services/FileService';
import { syncService } from './services/SyncService';
import { dbService } from './services/DatabaseService';
import type { Note, Resource } from './types';
import './App.css';
import { Sidebar } from './components/Sidebar';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [status, setStatus] = useState<string>('En attente');
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Charger les données au démarrage
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    // 1. Charger les données existantes
    await loadDataFromDB();

    // 2. Tenter de récupérer le handle persisté
    const handle = await dbService.getDirectoryHandle();
    if (handle) {
      setDirectoryName(handle.name);
      fileService.setDirectoryHandle(handle);
      setStatus("Dossier prêt.");
    }
  };

  const loadDataFromDB = async () => {
    const loadedNotes = await dbService.getAllNotes();
    const loadedResources = await dbService.getAllResources();
    setNotes(loadedNotes);
    setResources(loadedResources);
  };

  const handleOpenDirectory = async () => {
    try {
      setStatus('Ouverture...');
      const handle = await fileService.openDirectory();
      setDirectoryName(handle.name);

      // Sauvegarder le handle
      await dbService.saveDirectoryHandle(handle);

      await runSync();
    } catch (error) {
      console.error(error);
      setStatus("Erreur ouverture.");
    }
  };

  const runSync = async () => {
    setStatus('Indexation...');
    const counts = await syncService.importFiles();
    setStatus(`Sync terminée (${counts.notes} notes, ${counts.resources} res).`);
    loadDataFromDB();
  };



  const handleSelectResource = async (resource: Resource) => {
    try {
      const handle = await fileService.getFileHandle(resource.relative_path);
      if (handle) {
        const file = await handle.getFile();
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
      } else {
        alert('Impossible de récupérer le fichier. Vérifiez les permissions.');
      }
    } catch (error) {
      console.error("Erreur ouverture ressource:", error);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'row', maxWidth: '100%', padding: 0, height: '100vh', overflow: 'hidden', background: 'var(--cockpit-bg)', color: 'var(--cockpit-text)' }}>

      <Sidebar
        notes={notes}
        resources={resources}
        activeNoteId={activeNote?.relative_path}
        onSelectNote={setActiveNote}
        onSelectResource={handleSelectResource}
      />

      <main className="app-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <header className="app-header" style={{ padding: '0.8rem 1.5rem', borderBottom: '1px solid var(--cockpit-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1rem', margin: 0, fontWeight: 600, color: 'var(--cockpit-text)', letterSpacing: '0.05em' }}>AEGIS v2</h1>
            {directoryName && <span style={{ fontSize: '0.75rem', color: 'var(--cockpit-text-muted)', background: 'var(--cockpit-sidebar-bg)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid var(--cockpit-border)' }}>{directoryName}</span>}
          </div>

          <div className="controls" style={{ margin: 0, padding: 0, flexDirection: 'row', boxShadow: 'none', background: 'transparent' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--cockpit-text-muted)', marginRight: '1rem' }}>{status}</span>
            <button onClick={handleOpenDirectory} className="primary-btn" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'var(--cockpit-active)', color: 'white', border: 'none', borderRadius: '4px' }}>
              Ouvrir / Sync
            </button>
          </div>
        </header>

        <div className="content-area" style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {activeNote ? (
            <div className="note-viewer" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ marginTop: 0, color: 'var(--cockpit-active-text)' }}>{activeNote.title || activeNote.relative_path}</h2>
              <div style={{ color: 'var(--cockpit-text-muted)', fontSize: '0.8rem', marginBottom: '1rem', fontFamily: 'monospace' }}>
                {activeNote.relative_path}
              </div>
              <pre style={{
                whiteSpace: 'pre-wrap',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                background: 'var(--cockpit-sidebar-bg)',
                color: 'var(--cockpit-text)',
                padding: '1.5rem',
                borderRadius: '8px',
                border: '1px solid var(--cockpit-border)',
                lineHeight: 1.6
              }}>
                {activeNote.content}
              </pre>
            </div>
          ) : (
            <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              <div style={{ fontSize: '4rem', color: 'var(--cockpit-border)', marginBottom: '1rem' }}>⬡</div>
              <p style={{ fontSize: '1.2rem', color: 'var(--cockpit-text-muted)' }}>Sélectionnez un module pour commencer</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
