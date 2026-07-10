// Codelock Mock Data Payload

export const mockCase = {
  id: 'case_842',
  number: '842',
  name: 'The Gilded Cage',
  difficulty: 'Master',
  scenario: 'Mansion',
  roomCode: 'NX-4209',
  stats: {
    complexity: 'High',
    aiSpeed: 'Optimal',
    interrogationLimit: 12
  }
};

export const mockPlayers = [
  { id: 'p1', name: 'Eleanor Vance', initials: 'EV', isMe: true, isHost: true, status: 'READY', micStatus: 'on' },
  { id: 'p2', name: 'Arthur Pendelton', initials: 'AP', isMe: false, isHost: false, status: 'PREPARING...', micStatus: 'muted' },
  { id: 'p3', name: 'Beatrice Thorne', initials: 'BT', isMe: false, isHost: false, status: 'COMMUNICATING', micStatus: 'on' },
  { id: 'p4', name: 'Victor Vance', initials: 'VV', isMe: false, isHost: false, status: 'ELIMINATED', micStatus: 'off' },
];

export const mockCharacterSheet = {
  playerId: 'p1',
  name: 'Eleanor Vance',
  title: 'The Heiress',
  occupation: 'Socialite',
  objective: 'Ensure the inheritance remains entirely in your control, and deflect any suspicion.',
  classifiedMission: 'Recover the forged codicil before the authorities execute the Midnight Protocol.',
  syncRate: 100,
  serialNumber: 'SN-998-EV-ALPHA'
};

export const mockFeedMessages = [
  {
    id: 'm1',
    type: 'event', 
    content: 'The thunder rolls loudly outside Blackwood Manor. The lights flicker and dim.',
    timestamp: '10:45 PM'
  },
  {
    id: 'm2',
    type: 'divider',
    timestamp: '10:45 PM',
    content: 'The investigation begins'
  },
  {
    id: 'm3',
    type: 'narrative',
    content: '“A shattered glass lies near the velvet sofa. The smell of bitter almonds lingers in the damp air...”',
  },
  {
    id: 'm4',
    type: 'question',
    playerId: 'p2',
    playerName: 'Arthur',
    content: 'Did I notice anyone leaving the dining room before the lights went out?',
    timestamp: '10:47 PM'
  },
  {
    id: 'm5',
    type: 'answer',
    content: 'You recall seeing Beatrice slip away toward the conservatory just moments before the blackout.',
    timestamp: '10:48 PM'
  },
  {
    id: 'm6',
    type: 'clue',
    content: 'NEW EVIDENCE: Torn Velvet Fabric found near conservatory.',
    timestamp: '10:50 PM'
  }
];

export const mockEvidenceLog = [
  { id: 'e1', name: 'Torn Velvet', status: 'revealed', icon: 'document', description: 'A piece of torn velvet fabric that matches the drapes in the conservatory. Found snagged on a broken vase.' },
  { id: 'e2', name: 'Shattered Glass', status: 'revealed', icon: 'sample', description: 'Remnants of a crystal brandy snifter. Trace amounts of a bitter-smelling substance were detected inside.' },
  { id: 'e3', name: '???', status: 'locked', icon: 'lock', description: '' },
  { id: 'e4', name: '???', status: 'locked', icon: 'lock', description: '' },
];

export const mockObjectives = [
  { id: 'o1', text: 'Inspect the suspicious glass in the study.', completed: true },
  { id: 'o2', text: 'Question the staff about the blackout.', completed: false },
];

export const mockTimeline = [
  { date: '10:30 PM', event: 'Reginald retires to his study.' },
  { date: '10:45 PM', event: 'Blackout occurs; scream heard from the East Wing.' },
  { date: '11:00 PM', event: 'Body discovered by Eleanor Vance.' }
];

export const mockSuspects = [
  { id: 's1', name: 'Eleanor Vance', role: 'The Heiress', votes: 1, isMe: true, suspicionLevel: 25 },
  { id: 's2', name: 'Arthur Pendelton', role: 'The Butler', votes: 0, isMe: false, suspicionLevel: 10 },
  { id: 's3', name: 'Beatrice Thorne', role: 'The Confidante', votes: 3, isMe: false, suspicionLevel: 85 },
  { id: 's4', name: 'Victor Vance', role: 'The Nephew', votes: 0, isMe: false, suspicionLevel: 55 },
];

export const mockRevealData = {
  success: true,
  subtitle: "The Final Act at Blackwood Manor",
  murdererName: 'Beatrice Thorne',
  narrative: 'Beatrice Thorne slips cyanide into the brandy glass, driven by the motive: "He threatened to ruin everything we built. I couldn\'t let him destroy me."',
  victim: {
    name: 'Lord Reginald Vance',
    role: 'Patriarch',
    weapon: 'Cyanide-laced Brandy'
  },
  stats: {
    votesCorrect: 2,
    totalPlayers: 4,
    evidenceFound: 2,
    totalEvidence: 4,
    timeTaken: '42m 18s',
    accuracy: 94,
    rank: 'Master Detective'
  },
  timelineOfTruth: [
    { time: '10:45 PM', event: 'Beatrice slips cyanide into the glass.' },
    { time: '11:00 PM', event: 'Reginald drinks the brandy.' },
    { time: '11:15 PM', event: 'Eleanor enters the study, forging the codicil.' }
  ]
};

export const mockProfile = {
  name: 'Inspector Croft',
  rank: 'Senior Detective',
  registered: '2025',
  level: 42,
  stats: {
    casesSolved: 128,
    winRate: 76,
    accuracyTrend: [60, 65, 70, 72, 85, 94]
  },
  preferredAsset: {
    name: 'Eleanor Vance',
    quote: '"Money speaks, but silence is golden."',
    syncRate: 98
  },
  accolades: [
    { id: 'a1', title: 'First Blood', unlocked: true },
    { id: 'a2', title: 'Master Sleuth', unlocked: true },
    { id: 'a3', title: 'Flawless Victory', unlocked: false },
    { id: 'a4', title: 'Speedrunner', unlocked: false }
  ]
};

export const mockRoomState = {
  caseInfo: mockCase,
  status: 'waiting', 
  players: mockPlayers,
};

export const mockClueBoard = [
  { id: 'c1', name: 'Torn Velvet', type: 'Physical Evidence', status: 'New', importanceTier: 'High Relevance', connectedTo: ['s3'], desc: 'Found near the conservatory doors.' },
  { id: 'c2', name: 'Shattered Glass', type: 'Physical Evidence', status: 'Verified', importanceTier: 'Medium Relevance', connectedTo: ['s1'], desc: 'Contained traces of cyanide.' },
  { id: 'c3', name: 'Arthur\'s Testimony', type: 'Witness Statements', status: 'Discussed', importanceTier: 'Decoy', connectedTo: ['s2', 'c1'], desc: 'Claims he was in the wine cellar.' },
  { id: 'c4', name: 'Power Outage', type: 'Time-Related', status: 'Ignored', importanceTier: 'Medium Relevance', connectedTo: [], desc: 'Occurred exactly at 10:45 PM.' },
];

export const mockReplayReport = {
  timeline: [
    { time: '10:45 PM', event: 'Power outage triggered by Beatrice.' },
    { time: '10:50 PM', event: 'Reginald Vance poisoned.' },
    { time: '11:00 PM', event: 'Body discovered by Eleanor.' }
  ],
  votes: [
    { player: 'Eleanor Vance', votedFor: 'Beatrice Thorne', correct: true },
    { player: 'Arthur Pendelton', votedFor: 'Victor Vance', correct: false },
    { player: 'Beatrice Thorne', votedFor: 'Eleanor Vance', correct: false },
    { player: 'Victor Vance', votedFor: 'Beatrice Thorne', correct: true }
  ],
  clueImpact: {
    mattered: ['Torn Velvet', 'Shattered Glass'],
    ignored: ['Power Outage']
  },
  lies: [
    { character: 'Beatrice Thorne', lie: 'Claimed to be in her room during the blackout.' },
    { character: 'Arthur Pendelton', lie: 'Said he checked the fuse box immediately.' }
  ],
  accuracy: '50%',
  badges: [
    { id: 'b1', name: 'Master Sleuth', desc: 'Solved the case first', holder: 'Eleanor Vance' },
    { id: 'b2', name: 'Most Suspicious', desc: 'Received the most stray votes', holder: 'Victor Vance' },
    { id: 'b3', name: 'Clue Hunter', desc: 'Found the most critical clues', holder: 'Eleanor Vance' }
  ]
};
