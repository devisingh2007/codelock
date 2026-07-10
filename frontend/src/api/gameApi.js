import { config } from '../config';
import { io } from 'socket.io-client';
import {
  mockRoomState,
  mockCharacterSheet,
  mockFeedMessages,
  mockEvidenceLog,
  mockObjectives,
  mockTimeline,
  mockSuspects,
  mockRevealData,
  mockReplayReport,
  mockClueBoard,
  mockProfile,
  mockCase
} from '../mocks/mockData';

const API_BASE_URL = config.API_BASE_URL || 'http://localhost:3000';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export async function autoAuthenticate(playerName) {
  const username = playerName.trim();
  const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@mysteryverse.com`;
  const password = 'password123';

  // 1. Try to register
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);
      return data.token;
    }
  } catch (err) {
    console.error('Registration failed, trying login...', err);
  }

  // 2. Try to login
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok && data.token) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', username);
    return data.token;
  } else {
    throw new Error(data.message || 'Authentication failed');
  }
}

export async function createRoom() {
  const res = await fetch(`${API_BASE_URL}/api/game/create`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create room');
  if (data.room && data.room.roomCode) {
    localStorage.setItem('roomCode', data.room.roomCode);
  }
  return data.room;
}

export async function joinRoom(roomCode) {
  const res = await fetch(`${API_BASE_URL}/api/game/join`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ roomCode: roomCode.toUpperCase() })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to join room');
  localStorage.setItem('roomCode', roomCode.toUpperCase());
  return data.room;
}

export async function getRoom(roomCode) {
  const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}`, {
    method: 'GET',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch room');
  return data.room;
}

export async function generateMysteryForRoomCode(roomCode) {
  const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/generate-mystery`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ difficulty: 'medium' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate mystery');
  return data.story;
}

export async function getLobbyState(roomCode) {
  try {
    const room = await getRoom(roomCode);
    const currentUsername = localStorage.getItem('username');
    return {
      caseInfo: {
        name: `Investigation ${room.roomCode}`,
        number: room.roomCode,
        scenario: 'Noir Mansion',
        difficulty: 'Medium'
      },
      status: room.status,
      players: room.players.map(p => ({
        id: p._id || p,
        name: p.username || 'Investigator',
        initials: (p.username || 'In').substring(0, 2).toUpperCase(),
        isMe: p.username === currentUsername,
        isHost: p._id === room.host || room.host === p,
        status: 'READY',
        micStatus: 'on'
      }))
    };
  } catch (err) {
    console.warn('getLobbyState API error, using mock data...', err);
    return mockRoomState;
  }
}

// Socket Connection Management
let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(roomCode, onEvent) {
  if (socket) {
    socket.disconnect();
  }
  const token = localStorage.getItem('token');
  socket = io(API_BASE_URL, {
    auth: { token }
  });
  
  socket.on('connect', () => {
    console.log('[Socket] Connected to server.');
    socket.emit('join-room', roomCode, (res) => {
      if (res.error) console.error('[Socket] Join room error:', res.error);
      else if (onEvent) onEvent('joined-room', res);
    });
    socket.emit('join-game-room', { roomId: roomCode }, (res) => {
      if (res.error) console.error('[Socket] Join game room error:', res.error);
      else if (onEvent) onEvent('joined-game-room', res);
    });
  });
  
  socket.on('user-joined', (data) => {
    if (onEvent) onEvent('user-joined', data);
  });
  
  socket.on('user-left', (data) => {
    if (onEvent) onEvent('user-left', data);
  });
  
  socket.on('room-message', (data) => {
    if (onEvent) onEvent('room-message', data);
  });
  
  socket.on('mystery-generated', (data) => {
    if (onEvent) onEvent('mystery-generated', data);
  });
  
  socket.on('sync-state', (data) => {
    if (onEvent) onEvent('sync-state', data);
  });
  
  socket.on('state-changed', (data) => {
    if (onEvent) onEvent('state-changed', data);
  });
  
  socket.on('phase-advanced', (data) => {
    if (onEvent) onEvent('phase-advanced', data);
  });
  
  socket.on('state-error', (data) => {
    if (onEvent) onEvent('state-error', data);
  });
  
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// REST-style fallbacks and integrations
export async function getCase() {
  return mockCase;
}

export async function getMyCharacter(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state && data.state.story && data.state.story.victim) {
        // Return character details based on story
        const currentUsername = localStorage.getItem('username');
        const suspects = data.state.story.suspects || [];
        const mySuspect = suspects.find(s => s.name === currentUsername) || suspects[0] || {};
        return {
          playerId: 'p1',
          name: mySuspect.name || currentUsername,
          title: mySuspect.relationshipToVictim || 'Suspect',
          occupation: mySuspect.relationshipToVictim || 'Dignitary',
          objective: mySuspect.isMurderer ? 'You are the killer! Deflect suspicion and blame others.' : 'Find the real murderer among the suspects.',
          classifiedMission: mySuspect.background || 'Find clues.',
          syncRate: 100,
          serialNumber: 'SN-998-EV-ALPHA'
        };
      }
    }
  } catch (err) {
    console.error('getMyCharacter API error, falling back...', err);
  }
  return mockCharacterSheet;
}

export async function getFeedMessages(roomCode) {
  return mockFeedMessages;
}

export async function sendMessage(roomCode, content) {
  if (socket) {
    socket.emit('room-message', { roomCode, message: content });
    return { id: `msg-${Date.now()}`, sender: 'You', type: 'player', content };
  }
  return { id: `msg-${Date.now()}`, sender: 'You', type: 'player', content };
}

export async function sendAction(roomCode, type, payload) {
  console.log(`[API] sendAction - Room: ${roomCode}, Type: ${type}`, payload);
  return { success: true };
}

export async function getEvidence(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state && data.state.story && data.state.story.crime) {
        const weapon = data.state.story.crime.weapon;
        return [
          { id: 'e1', name: weapon, status: 'revealed', icon: 'sample' },
          { id: 'e2', name: 'Crime Summary', status: 'revealed', icon: 'document' },
          ...mockEvidenceLog.slice(2)
        ];
      }
    }
  } catch (err) {
    console.error('getEvidence failed, falling back...', err);
  }
  return mockEvidenceLog;
}

export async function getObjectives(roomCode) {
  return mockObjectives;
}

export async function getTimeline(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state && data.state.story && data.state.story.timeline) {
        return data.state.story.timeline.map(t => ({
          date: t.time,
          event: t.event
        }));
      }
    }
  } catch (err) {
    console.error('getTimeline failed, falling back...', err);
  }
  return mockTimeline;
}

export async function getSuspects(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state && data.state.story && data.state.story.suspects) {
        const currentUsername = localStorage.getItem('username');
        return data.state.story.suspects.map((s, idx) => ({
          id: `s${idx}`,
          name: s.name,
          role: s.relationshipToVictim,
          votes: s.isMurderer ? 2 : 0,
          isMe: s.name === currentUsername,
          suspicionLevel: s.isMurderer ? 80 : 30
        }));
      }
    }
  } catch (err) {
    console.error('getSuspects failed, falling back...', err);
  }
  return mockSuspects;
}

export async function castVote(roomCode, suspectId) {
  console.log(`[API] castVote - Room: ${roomCode}, Suspect: ${suspectId}`);
  return { success: true };
}

export async function getRevealData(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.state && data.state.story && data.state.story.crime) {
        const killerName = data.state.story.crime.killer;
        const victimName = data.state.story.victim.name;
        const weapon = data.state.story.crime.weapon;
        return {
          killer: {
            name: killerName,
            motive: data.state.story.crime.summary || 'Hidden motive.'
          },
          victim: {
            name: victimName,
            role: 'Victim',
            weapon: weapon
          },
          stats: {
            accuracy: 100,
            rank: 'Master Detective',
            timeToSolve: '15m 00s'
          },
          timelineOfTruth: data.state.story.timeline.map(t => ({
            time: t.time,
            event: t.event
          }))
        };
      }
    }
  } catch (err) {
    console.error('getRevealData failed, falling back...', err);
  }
  return mockRevealData;
}

export async function getReplayReport(roomCode) {
  return mockReplayReport;
}

export async function getClueBoard(roomCode) {
  return mockClueBoard;
}

export async function toggleClueStatus(clueId) {
  return { success: true };
}

export async function getProfile() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      return {
        name: data.username,
        rank: 'Senior Detective',
        registered: new Date(data.createdAt).getFullYear().toString(),
        level: 1,
        stats: mockProfile.stats,
        preferredAsset: mockProfile.preferredAsset,
        achievements: mockProfile.accolades.map(a => ({
          name: a.title,
          desc: 'Achievement unlocked from activities.',
          unlocked: a.unlocked
        }))
      };
    }
  } catch (err) {
    console.error('getProfile failed, falling back...', err);
  }
  return mockProfile;
}
