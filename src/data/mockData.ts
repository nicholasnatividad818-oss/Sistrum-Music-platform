import { Track, Artist, Playlist, Comment } from '../types';

// Helper to generate dynamic waveform bars
const genWaveform = (seed: number[]): number[] => {
  const bars: number[] = [];
  const count = 75;
  for (let i = 0; i < count; i++) {
    const base = seed[i % seed.length];
    const wave = Math.sin((i / count) * Math.PI * 4) * 0.25;
    const noise = (Math.sin(i * 13.37) * 0.15);
    const amp = Math.min(1.0, Math.max(0.18, base + wave + noise));
    bars.push(Number(amp.toFixed(2)));
  }
  return bars;
};

export const MOCK_ARTISTS: Artist[] = [
  {
    id: 'artist-1',
    name: 'Kroma Waves',
    handle: 'kromawaves',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1600&auto=format&fit=crop&q=80',
    bio: 'Analog modular synthesizers, nostalgic VHS vibes, and nocturnal electronic soundscapes from Tokyo & Berlin.',
    location: 'Berlin / Tokyo',
    followersCount: 148200,
    followingCount: 342,
    tracksCount: 28,
    isVerified: true,
    spotlightTrackId: 'track-1',
    socials: {
      twitter: 'kromawaves',
      instagram: 'kroma.waves',
      website: 'https://kromawaves.audio'
    }
  },
  {
    id: 'artist-2',
    name: 'Lo-Fi Chill Sanctuary',
    handle: 'lofisanctuary',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=1600&auto=format&fit=crop&q=80',
    bio: 'Late night study beats, dusty vinyl grooves, coffee shop rain, and relaxed Rhodes piano.',
    location: 'Kyoto, Japan',
    followersCount: 312500,
    followingCount: 89,
    tracksCount: 45,
    isVerified: true,
    spotlightTrackId: 'track-2'
  },
  {
    id: 'artist-3',
    name: 'Hyperion Club',
    handle: 'hyperionclub',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80',
    bio: 'Deep melodic house, underground tech grooves, and sunset festival anthems. Live hardware sets.',
    location: 'Ibiza / London',
    followersCount: 89400,
    followingCount: 512,
    tracksCount: 19,
    isVerified: true,
    spotlightTrackId: 'track-3'
  },
  {
    id: 'artist-4',
    name: 'Astral Echoes',
    handle: 'astralechoes',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
    bio: 'Deep space ambient meditations, cinematic drone frequencies, and zero-gravity modular textures.',
    location: 'Reykjavik, Iceland',
    followersCount: 64200,
    followingCount: 110,
    tracksCount: 14,
    isVerified: false,
    spotlightTrackId: 'track-4'
  },
  {
    id: 'artist-5',
    name: 'Neon Samurai',
    handle: 'neonsamurai',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    banner: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&auto=format&fit=crop&q=80',
    bio: 'Cyberpunk basslines, dark synthwave, fast 808s, and dystopian night drives.',
    location: 'Neo-Seoul',
    followersCount: 204300,
    followingCount: 220,
    tracksCount: 36,
    isVerified: true,
    spotlightTrackId: 'track-5'
  }
];

export const MOCK_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'Midnight Grid Run (1984)',
    artist: 'Kroma Waves',
    artistId: 'artist-1',
    artistAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    duration: 215, // 3:35
    bpm: 124,
    genre: 'Synthwave',
    tags: ['Retrowave', 'Darksynth', 'Cyberpunk', 'Analog'],
    waveformData: genWaveform([0.3, 0.45, 0.65, 0.85, 0.9, 0.75, 0.4, 0.25, 0.6, 0.8, 0.95, 0.7, 0.5]),
    playCount: 482190,
    likeCount: 28400,
    repostCount: 4910,
    commentCount: 142,
    releaseDate: '3 days ago',
    description: 'Recorded live using vintage Juno-106, Prophet-5, and LinnDrum through tape saturation. Cruising down the neon freeway at 2 AM.',
    synthPreset: 'synthwave',
    isLiked: true,
    isReposted: false
  },
  {
    id: 'track-2',
    title: 'Raindrops on Paper Cranes',
    artist: 'Lo-Fi Chill Sanctuary',
    artistId: 'artist-2',
    artistAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    duration: 168, // 2:48
    bpm: 82,
    genre: 'Lo-Fi',
    tags: ['Study Beats', 'Chillhop', 'Vinyl', 'Relax'],
    waveformData: genWaveform([0.2, 0.35, 0.4, 0.55, 0.6, 0.65, 0.5, 0.45, 0.5, 0.6, 0.55, 0.4, 0.3]),
    playCount: 1250400,
    likeCount: 94200,
    repostCount: 18400,
    commentCount: 680,
    releaseDate: '1 week ago',
    description: 'A cozy cup of matcha and quiet rain on the wooden veranda. Rhodes chords played with gentle swing.',
    synthPreset: 'lofi',
    isLiked: false,
    isReposted: true
  },
  {
    id: 'track-3',
    title: 'Solar Flare (Ibiza Extended Cut)',
    artist: 'Hyperion Club',
    artistId: 'artist-3',
    artistAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    duration: 254, // 4:14
    bpm: 126,
    genre: 'House',
    tags: ['Deep House', 'Melodic', 'Club', 'Sunset'],
    waveformData: genWaveform([0.4, 0.5, 0.6, 0.75, 0.9, 0.95, 0.85, 0.7, 0.5, 0.65, 0.85, 0.95, 0.6]),
    playCount: 389100,
    likeCount: 22100,
    repostCount: 3400,
    commentCount: 95,
    releaseDate: '2 weeks ago',
    description: 'Premiered at Cafe del Mar sunset session. Driving 4/4 rhythm with warm analog pads and lush brass stabs.',
    synthPreset: 'house',
    isLiked: true,
    isReposted: false
  },
  {
    id: 'track-4',
    title: 'Starlight Drift (Zero Gravity)',
    artist: 'Astral Echoes',
    artistId: 'artist-4',
    artistAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    duration: 310, // 5:10
    bpm: 65,
    genre: 'Ambient',
    tags: ['Space', 'Meditation', 'Drone', 'Ethereal'],
    waveformData: genWaveform([0.15, 0.25, 0.35, 0.45, 0.5, 0.55, 0.6, 0.55, 0.45, 0.4, 0.35, 0.3, 0.2]),
    playCount: 198400,
    likeCount: 15300,
    repostCount: 2100,
    commentCount: 78,
    releaseDate: '1 month ago',
    description: 'Recorded during the northern lights in Reykjavik. Pure frequencies for deep focus, sleep, and transcendental journeys.',
    synthPreset: 'ambient',
    isLiked: false,
    isReposted: false
  },
  {
    id: 'track-5',
    title: 'Katana Drift (VIP Dub)',
    artist: 'Neon Samurai',
    artistId: 'artist-5',
    artistAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    duration: 192, // 3:12
    bpm: 140,
    genre: 'Trap',
    tags: ['Darksynth', 'Bass', 'Trap', 'Aggressive'],
    waveformData: genWaveform([0.35, 0.55, 0.75, 0.9, 0.95, 0.6, 0.3, 0.85, 0.95, 0.9, 0.75, 0.6, 0.4]),
    playCount: 720300,
    likeCount: 51200,
    repostCount: 9100,
    commentCount: 310,
    releaseDate: '4 days ago',
    description: 'Heavy sliding 808 sub basslines, distorted vocal chops, and razor sharp synth leads. Turn the subwoofers up.',
    synthPreset: 'synthwave',
    isLiked: true,
    isReposted: true
  },
  {
    id: 'track-6',
    title: 'Velvet Afternoon (Coffeehouse Edit)',
    artist: 'Lo-Fi Chill Sanctuary',
    artistId: 'artist-2',
    artistAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=600&auto=format&fit=crop&q=80',
    duration: 175,
    bpm: 78,
    genre: 'Lo-Fi',
    tags: ['Chill', 'Acoustic', 'Vibes', 'Coffee'],
    waveformData: genWaveform([0.25, 0.3, 0.45, 0.5, 0.6, 0.55, 0.45, 0.4, 0.5, 0.6, 0.55, 0.35, 0.25]),
    playCount: 540200,
    likeCount: 42100,
    repostCount: 6300,
    commentCount: 180,
    releaseDate: '3 weeks ago',
    description: 'Gentle acoustic chords layered with soft vinyl warmth and mellow bassline.',
    synthPreset: 'chillhop',
    isLiked: false,
    isReposted: false
  },
  {
    id: 'track-7',
    title: 'Neon Odyssey (Overdrive Remix)',
    artist: 'Kroma Waves',
    artistId: 'artist-1',
    artistAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    coverArt: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80',
    duration: 228,
    bpm: 128,
    genre: 'Electronic',
    tags: ['Outrun', 'Electro', 'Dance', 'Synth'],
    waveformData: genWaveform([0.3, 0.6, 0.8, 0.9, 0.95, 0.8, 0.4, 0.7, 0.85, 0.95, 0.85, 0.7, 0.5]),
    playCount: 310500,
    likeCount: 23400,
    repostCount: 3800,
    commentCount: 88,
    releaseDate: '1 month ago',
    description: 'High octane electro with driving arpeggios and punchy gated snares.',
    synthPreset: 'synthwave',
    isLiked: false,
    isReposted: false
  }
];

export const MOCK_COMMENTS: Record<string, Comment[]> = {
  'track-1': [
    {
      id: 'c-1',
      trackId: 'track-1',
      userId: 'u-1',
      userName: 'SynthRider99',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
      text: 'THIS DROP IS INSANE 🔥🔥🔥',
      timestamp: 45,
      createdAt: '2 hours ago',
      likes: 34
    },
    {
      id: 'c-2',
      trackId: 'track-1',
      userId: 'u-2',
      userName: 'Elena_V',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      text: 'The bassline here hits right in the chest 💖',
      timestamp: 82,
      createdAt: '5 hours ago',
      likes: 19
    },
    {
      id: 'c-3',
      trackId: 'track-1',
      userId: 'u-3',
      userName: 'RetroWaveGod',
      userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
      text: 'What synth did you use for the arpeggio? Prophet?',
      timestamp: 120,
      createdAt: '1 day ago',
      likes: 12
    },
    {
      id: 'c-4',
      trackId: 'track-1',
      userId: 'u-4',
      userName: 'BeatCraft',
      userAvatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&auto=format&fit=crop&q=80',
      text: 'Mastering is so crisp! Instant playlist add 🚀',
      timestamp: 165,
      createdAt: '2 days ago',
      likes: 8
    }
  ],
  'track-2': [
    {
      id: 'c-5',
      trackId: 'track-2',
      userId: 'u-5',
      userName: 'StudyBuddy',
      userAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80',
      text: 'Passed my finals listening to this loop ❤️',
      timestamp: 30,
      createdAt: '4 hours ago',
      likes: 85
    },
    {
      id: 'c-6',
      trackId: 'track-2',
      userId: 'u-6',
      userName: 'CoffeeCat',
      userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80',
      text: 'That snare crunch is heavenly ☕',
      timestamp: 95,
      createdAt: '1 day ago',
      likes: 42
    }
  ],
  'track-3': [
    {
      id: 'c-7',
      trackId: 'track-3',
      userId: 'u-7',
      userName: 'IbizaVibes',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      text: 'Take me back to the beach party! 🌅🍹',
      timestamp: 64,
      createdAt: '3 days ago',
      likes: 27
    }
  ]
};

export const MOCK_PLAYLISTS: Playlist[] = [
  {
    id: 'pl-1',
    title: 'Neon Dystopia 2099',
    description: 'Driving dark synthwave, electro-industrial beats, and nocturnal cyberpunk soundscapes.',
    coverArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    creator: 'Alex Rivera',
    creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
    trackIds: ['track-1', 'track-5', 'track-7'],
    isPublic: true,
    likesCount: 1420,
    createdAt: '2 weeks ago',
    tags: ['Cyberpunk', 'Synthwave', 'Bass']
  },
  {
    id: 'pl-2',
    title: 'Midnight Coding & Coffee',
    description: 'Ultra-mellow lo-fi beats, gentle vinyl crackle, and soothing Rhodes piano.',
    coverArt: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    creator: 'SoundWave Curators',
    creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    trackIds: ['track-2', 'track-6', 'track-4'],
    isPublic: true,
    likesCount: 8930,
    createdAt: '1 month ago',
    tags: ['Lo-Fi', 'Study', 'Coding']
  },
  {
    id: 'pl-3',
    title: 'Ibiza Sunset Sessions',
    description: 'Uplifting melodic house, tropical club rhythms, and golden hour terrace vibes.',
    coverArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    creator: 'Hyperion Club',
    creatorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    trackIds: ['track-3', 'track-1', 'track-7'],
    isPublic: true,
    likesCount: 3450,
    createdAt: '3 weeks ago',
    tags: ['House', 'Club', 'Melodic']
  }
];

export const CURRENT_USER = {
  id: 'current-user',
  name: 'Alex Rivera',
  handle: 'alexrivera',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
  banner: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80',
  bio: 'Music enthusiast, producer & audio designer. Listening to beats 24/7.',
  likedTrackIds: ['track-1', 'track-3', 'track-5'],
  repostedTrackIds: ['track-2', 'track-5'],
  followingArtistIds: ['artist-1', 'artist-2', 'artist-3']
};

export const GENRE_LIST = [
  'All Genres',
  'Synthwave',
  'Lo-Fi',
  'Electronic',
  'House',
  'Ambient',
  'Trap',
  'Chillhop',
  'Future Bass'
];
