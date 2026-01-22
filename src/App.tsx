import { useState, useEffect } from 'react';
import { fileService } from './services/FileService';
import { syncService } from './services/SyncService';
import { dbService } from './services/DatabaseService';
import type { Note, Resource } from './types';
import './App.css';

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [status, setStatus] = useState<string>('En attente');
  const [directoryName, setDirectoryName] = useState<string | null>(null);

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
      setStatus("Dossier précédemment ouvert. Cliquez sur 'Ouvrir' si les permissions sont révoquées.");
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
      setStatus('Ouverture du dossier...');
      const handle = await fileService.openDirectory();
      setDirectoryName(handle.name);

      // Sauvegarder le handle
      await dbService.saveDirectoryHandle(handle);

      await runSync();
    } catch (error) {
      console.error(error);
      setStatus("Erreur lors de l'ouverture ou de l'indexation.");
    }
  };

  const runSync = async () => {
    setStatus('Indexation en cours...');
    const counts = await syncService.importFiles();
    setStatus(`Terminé : ${counts.notes} notes, ${counts.resources} ressources.`);
    loadDataFromDB();
  };

  const handleClearDB = async () => {
    setStatus("Nettoyage non implémenté.");
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Aegis v2</h1>
        <p className="subtitle">Orchestrateur de Gouvernance - Software First</p>
      </header>

      <main className="app-main">
        <div className="controls">
          <button onClick={handleOpenDirectory} className="primary-btn">
            Ouvrir / Synchroniser
          </button>

          <button onClick={handleClearDB} className="secondary-btn" style={{ marginLeft: '10px' }}>
            Info
          </button>

          <div className="status-panel">
            <strong>Statut :</strong> {status}
            {directoryName && <div><strong>Dossier :</strong> {directoryName}</div>}
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="left-panel">
            <h2>Notes ({notes.length})</h2>
            <div className="list-scroll">
              {notes.length === 0 ? (
                <p className="empty-state">Aucune note.</p>
              ) : (
                <ul className="notes-list">
                  {notes.map((note) => (
                    <li key={note.relative_path} className="note-item">
                      <span className="note-path" title={note.relative_path}>
                        {note.title || note.relative_path}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="right-panel">
            <h2>Ressources ({resources.length})</h2>
            <div className="list-scroll">
              {resources.length === 0 ? (
                <p className="empty-state">Aucune ressource.</p>
              ) : (
                <ul className="notes-list">
                  {resources.map((res) => (
                    <li key={res.relative_path} className="note-item">
                      <span className="note-path" title={res.relative_path}>{res.name}</span>
                      <span className="note-date">.{res.extension}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
