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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let currentMessages = [...mockFeedMessages];
let currentSuspects = JSON.parse(JSON.stringify(mockSuspects));
let currentClues = JSON.parse(JSON.stringify(mockClueBoard));

export async function getCase() {
  await delay(200);
  return mockCase;
}

export async function getLobbyState(roomCode) {
  await delay(300);
  return mockRoomState;
}

export async function getMyCharacter(roomCode) {
  await delay(300);
  return mockCharacterSheet;
}

export async function getFeedMessages(roomCode) {
  await delay(300);
  return currentMessages;
}

export async function sendMessage(roomCode, content) {
  await delay(200);
  const newMessage = {
    id: `msg-${Date.now()}`,
    sender: 'You',
    type: 'player',
    content: content,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    avatar: 'https://i.pravatar.cc/150?u=you'
  };
  
  currentMessages = [...currentMessages, newMessage];
  
  // Simulate AI Response
  setTimeout(() => {
    const aiResponse = {
      id: `msg-${Date.now()+1}`,
      sender: 'Game Master',
      type: 'gm',
      content: 'I have noted your observation. The suspects are becoming restless.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    currentMessages = [...currentMessages, aiResponse];
  }, 2000);

  return newMessage;
}

export async function sendAction(roomCode, type, payload) {
  await delay(500);
  console.log(`[API MOCK] sendAction - Room: ${roomCode}, Type: ${type}`, payload);
  return { success: true };
}

export async function getEvidence(roomCode) {
  await delay(200);
  return mockEvidenceLog;
}

export async function getObjectives(roomCode) {
  await delay(200);
  return mockObjectives;
}

export async function getTimeline(roomCode) {
  await delay(200);
  return mockTimeline;
}

export async function getSuspects(roomCode) {
  await delay(300);
  return currentSuspects;
}

export async function castVote(roomCode, suspectId) {
  await delay(500);
  currentSuspects = currentSuspects.map(s => {
    if (s.id === suspectId) {
      return { ...s, suspicion: Math.min(100, s.suspicion + 20) };
    }
    return s;
  });
  console.log(`[API MOCK] castVote - Room: ${roomCode}, Suspect: ${suspectId}`);
  return { success: true };
}

export async function getRevealData(roomCode) {
  await delay(1000);
  return mockRevealData;
}

export async function getReplayReport(roomCode) {
  await delay(500);
  return mockReplayReport;
}

export async function getClueBoard(roomCode) {
  await delay(500);
  return currentClues;
}

export async function toggleClueStatus(clueId) {
  await delay(100);
  currentClues = currentClues.map(c => {
    if (c.id === clueId) {
      const nextStatus = c.status === 'New' ? 'Discussed' : (c.status === 'Discussed' ? 'Verified' : 'New');
      return { ...c, status: nextStatus };
    }
    return c;
  });
  return { success: true };
}

export async function getProfile() {
  await delay(300);
  return mockProfile;
}
