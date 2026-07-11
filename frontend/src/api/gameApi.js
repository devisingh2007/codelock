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
  let token = sessionStorage.getItem('token');
  if (!token) {
    token = localStorage.getItem('token');
    if (token) {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('username', localStorage.getItem('username'));
    }
  }
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
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('username', username);
      if (data.userId || data.user?._id || data.user?.id) {
        sessionStorage.setItem('userId', data.userId || data.user?._id || data.user?.id);
      }
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
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('username', username);
    if (data.userId || data.user?._id || data.user?.id) {
      sessionStorage.setItem('userId', data.userId || data.user?._id || data.user?.id);
    }
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
    sessionStorage.setItem('roomCode', data.room.roomCode);
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
  sessionStorage.setItem('roomCode', roomCode.toUpperCase());
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

export async function generateMysteryForRoomCode(roomCode, options = {}) {
  const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/generate-mystery`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      difficulty: options.difficulty || 'medium',
      locationHints: options.locationHints || ''
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate mystery');
  return data.story;
}

export async function getLobbyState(roomCode) {
  try {
    const room = await getRoom(roomCode);
    const currentUsername = sessionStorage.getItem('username');
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
  const token = sessionStorage.getItem('token');
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
export async function getGameState(roomCode) {
  const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
    method: 'GET',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch game state');
  return data.data || data.state;
}

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
      const state = data.data || data.state;
      if (state && state.story && state.story.victim) {
        const currentUsername = sessionStorage.getItem('username');
        const currentUserId   = sessionStorage.getItem('userId');
        const suspects = state.story.suspects || [];
        const roles = state.roles || [];

        // Match by userId._id (populated) first, then by username, then first unassigned
        let myRole = null;
        if (currentUserId) {
          myRole = roles.find(r => {
            const uid = r.userId?._id || r.userId;
            return uid && uid.toString() === currentUserId.toString();
          });
        }
        if (!myRole && currentUsername) {
          myRole = roles.find(r => r.userId?.username === currentUsername);
        }

        const mySuspect = myRole
          ? (suspects.find(s => s.name === myRole.roleName) || suspects[0] || {})
          : (suspects[0] || {});

        const isMurderer = mySuspect.isMurderer === true;
        const assignedObjective = myRole?.objective || (isMurderer
          ? `Survive the night. Deflect every accusation and make sure the truth stays buried.`
          : `Investigate the murder of ${state.story.victim.name}. Find the real killer before they frame you.`);
        const assignedSecret = myRole?.secret || mySuspect.background || 'You have a secret to protect.';
        const assignedClues  = myRole?.clues || [];

        return {
          playerId: currentUserId || 'p1',
          name: myRole?.roleName || mySuspect.name || currentUsername,
          title: mySuspect.relationshipToVictim || (isMurderer ? 'Prime Suspect' : 'Investigator'),
          occupation: mySuspect.relationshipToVictim || 'Guest',
          objective: assignedObjective,
          classifiedMission: assignedSecret,
          personalClues: assignedClues,
          isMurderer,
          syncRate: myRole ? 100 : 75,
          serialNumber: `SN-${Math.random().toString(36).substr(2,5).toUpperCase()}-EV`
        };
      }
    }
  } catch (err) {
    console.error('getMyCharacter API error, falling back...', err);
  }
  return null;
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
      const state = data.data || data.state;
      if (state && state.story && state.story.crime) {
        const weapon = state.story.crime.weapon;
        return [
          { 
            id: 'e1', 
            name: weapon, 
            status: 'revealed', 
            icon: 'sample',
            description: 'This appears to be the murder weapon. It was found near the scene of the crime. Perhaps the AI Game Master knows more about its origins?'
          },
          { 
            id: 'e2', 
            name: 'Crime Summary', 
            status: 'revealed', 
            icon: 'document',
            description: 'A detailed report of the incident. The victim was found dead under mysterious circumstances. Time of death is estimated to be around midnight. Cause of death requires further investigation.'
          },
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
      const state = data.data || data.state;
      if (state && state.story && state.story.timeline) {
        return state.story.timeline.map(t => ({
          date: t.time,
          event: t.event
        }));
      }
    }
  } catch (err) {
    console.error('getTimeline failed, falling back...', err);
  }
  return [];
}

export async function getSuspects(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      const state = data.data || data.state;
      if (state && state.story && state.story.suspects) {
        const currentUsername = sessionStorage.getItem('username');
        const roles = state.roles || [];
        
        // Fetch current votes if available
        let voteCounts = {};
        try {
          const resVotes = await fetch(`${API_BASE_URL}/api/vote/${roomCode.toUpperCase()}/results`, {
            method: 'GET',
            headers: getHeaders()
          });
          if (resVotes.ok) {
            const dataVotes = await resVotes.json();
            voteCounts = dataVotes.votes || {};
          }
        } catch (vErr) {
          console.warn('Failed to fetch vote results, defaulting counts to 0', vErr);
        }

        return state.story.suspects.map((s, idx) => {
          const associatedRole = roles.find(r => r.roleName === s.name);
          const playerUsername = associatedRole?.userId?.username;
          // Append player name to suspect name if mapped
          const displayName = playerUsername ? `${s.name} (${playerUsername})` : s.name;
          const isMe = playerUsername === currentUsername;
          
          // Get actual vote count for this suspect name
          const voteCount = voteCounts[s.name] || 0;
          
          // Calculate suspicion level dynamically based on votes (baseline 25% + 25% per vote)
          const suspicion = Math.min(25 + (voteCount * 25), 100);

          return {
            id: s.name,
            name: displayName,
            role: s.relationshipToVictim,
            votes: voteCount,
            isMe: isMe,
            suspicionLevel: suspicion
          };
        });
      }
    }
  } catch (err) {
    console.error('getSuspects failed, falling back...', err);
  }
  return [];
}

export async function castVote(roomCode, suspectId) {
  const res = await fetch(`${API_BASE_URL}/api/vote`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ roomId: roomCode.toUpperCase(), accusedPlayerId: suspectId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cast vote');
  return data;
}

export async function getRevealData(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      const state = data.data || data.state;
      if (state && state.story && state.story.crime) {
        const story = state.story;
        const killerName = story.crime.killer;
        const victimName = story.victim?.name || 'The Victim';
        const weapon = story.crime.weapon;
        const motive = story.crime.summary || story.crime.motive || 'Driven by jealousy and greed.';
        const roles = state.roles || [];
        const killerRole = roles.find(r => r.roleName === killerName);
        const killerUsername = killerRole?.userId?.username;
        const displayKillerName = killerUsername ? `${killerName} (${killerUsername})` : killerName;

        // Count correct votes: anyone who voted for the killer
        let votesCorrect = 0;
        let totalPlayers = state.players?.length || 0;
        try {
          const resVotes = await fetch(`${API_BASE_URL}/api/vote/${roomCode.toUpperCase()}/results`, {
            method: 'GET',
            headers: getHeaders()
          });
          if (resVotes.ok) {
            const voteData = await resVotes.json();
            const votes = voteData.votes || {};
            // Count votes cast for the killer's username
            if (killerName) {
              votesCorrect = votes[killerName] || 0;
            }
          }
        } catch (vErr) {
          console.warn('Could not fetch vote results for reveal', vErr);
        }

        return {
          success: votesCorrect > 0,
          subtitle: `The ${story.setting || 'Mansion'} Murder`,
          murdererName: displayKillerName,
          narrative: `${killerName} used ${weapon} to silence ${victimName}. Motive: "${motive}"`,
          victim: { name: victimName, role: 'Victim', weapon },
          stats: {
            votesCorrect,
            totalPlayers,
            evidenceFound: 2,
            totalEvidence: 4,
            timeTaken: '—'
          },
          timelineOfTruth: (story.timeline || []).map(t => ({ time: t.time, event: t.event }))
        };
      }
    }
  } catch (err) {
    console.error('getRevealData failed, falling back...', err);
  }
  return null;
}

export async function getReplayReport(roomCode) {
  try {
    // Fetch game state for story + timeline
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      const state = data.data || data.state;
      if (state && state.story) {
        const story = state.story;
        const killerName = story.crime?.killer || 'Unknown';
        const roles = state.roles || [];

        // Fetch real vote results
        let votes = {};
        try {
          const vRes = await fetch(`${API_BASE_URL}/api/vote/${roomCode.toUpperCase()}/results`, {
            method: 'GET',
            headers: getHeaders()
          });
          if (vRes.ok) {
            const vData = await vRes.json();
            votes = vData.votes || {};
          }
        } catch (_) {}

        // Build per-suspect vote breakdown from real data
        const suspects = story.suspects || [];
        const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

        const voteBreakdown = suspects.map(s => {
          const count = votes[s.name] || 0;
          return {
            suspectName: s.name,
            votedFor: s.name,
            isCorrect: s.name === killerName,
            count
          };
        });

        const correctVotes = votes[killerName] || 0;
        const accuracy = totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 100) : 0;

        return {
          title: story.title || 'The Investigation',
          location: story.location || 'Unknown Location',
          victim: story.victim?.name || 'The Victim',
          murderer: killerName,
          weapon: story.crime?.weapon || 'Unknown',
          narrative: story.crime?.summary || 'The truth has been revealed.',
          timeline: (story.timeline || []).map(t => ({ time: t.time, event: t.event })),
          voteBreakdown,
          teamAccuracy: accuracy,
          suspects: suspects.map(s => ({ name: s.name, role: s.relationshipToVictim, isKiller: s.name === killerName }))
        };
      }
    }
  } catch (err) {
    console.error('getReplayReport failed:', err);
  }
  return null;
}

export async function getClueBoard(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/${roomCode.toUpperCase()}/state`, {
      method: 'GET',
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      const state = data.data || data.state;
      if (state && state.story && state.story.crime) {
        const story = state.story;
        const clues = [];

        // Add the murder weapon as a physical clue
        if (story.crime.weapon) {
          clues.push({
            id: 'c-weapon',
            name: story.crime.weapon,
            type: 'Physical Evidence',
            status: 'New',
            importanceTier: 'High Relevance',
            desc: `The weapon used in the crime. Found at the scene of the murder.`
          });
        }

        // Add each suspect's motive/alibi as a witness clue
        if (story.suspects && story.suspects.length > 0) {
          story.suspects.slice(0, 3).forEach((s, idx) => {
            clues.push({
              id: `c-suspect-${idx}`,
              name: `${s.name}'s Statement`,
              type: 'Witness Statements',
              status: 'New',
              importanceTier: s.isMurderer ? 'High Relevance' : 'Decoy',
              desc: s.background || s.alibi || `${s.name} claims: "${s.relationshipToVictim}".`
            });
          });
        }

        // Add timeline events as time-related clues
        if (story.timeline && story.timeline.length > 0) {
          story.timeline.slice(0, 2).forEach((t, idx) => {
            clues.push({
              id: `c-timeline-${idx}`,
              name: `Event at ${t.time}`,
              type: 'Time-Related',
              status: 'Discussed',
              importanceTier: 'Medium Relevance',
              desc: t.event
            });
          });
        }

        if (clues.length > 0) return clues;
      }
    }
  } catch (err) {
    console.warn('getClueBoard API error, using mock data...', err);
  }
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
        achievements: (mockProfile.achievements || []).map(a => ({
          name: a.name,
          desc: a.desc,
          unlocked: a.unlocked
        }))
      };
    }
  } catch (err) {
    console.error('getProfile failed, falling back...', err);
  }
  return mockProfile;
}
