import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import CreateRoomPage from './pages/CreateRoomPage';
import JoinRoomPage from './pages/JoinRoomPage';
import LobbyPage from './pages/LobbyPage';
import CharacterRevealPage from './pages/CharacterRevealPage';
import GamePage from './pages/GamePage';
import SceneInspectPage from './pages/SceneInspectPage';
import VotePage from './pages/VotePage';
import RevealPage from './pages/RevealPage';
import ReplayReportPage from './pages/ReplayReportPage';
import EvidenceBoardPage from './pages/EvidenceBoardPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import './styles/theme.css';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join" element={<JoinRoomPage />} />
          <Route path="/lobby/:roomCode" element={<LobbyPage />} />
          <Route path="/game/:roomCode/character" element={<CharacterRevealPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/game/:roomCode/inspect" element={<SceneInspectPage />} />
          <Route path="/game/:roomCode/board" element={<EvidenceBoardPage />} />
          <Route path="/game/:roomCode/vote" element={<VotePage />} />
          <Route path="/game/:roomCode/reveal" element={<RevealPage />} />
          <Route path="/game/:roomCode/report" element={<ReplayReportPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
