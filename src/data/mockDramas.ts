import { DramaSeries } from '../dramaTypes';

const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const MOCK_DRAMAS: DramaSeries[] = [
  {
    id: 'drama-afterlight',
    title: 'Afterlight',
    synopsis: 'A night-shift photographer discovers that every portrait she takes reveals what will happen to the subject before sunrise.',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=900&auto=format&fit=crop&q=85',
    genre: 'Thriller',
    tags: ['mystery', 'urban', 'psychological'],
    director: {
      id: 'director-maya-reyes',
      name: 'Maya Reyes',
      handle: 'mayareyesfilm',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      location: 'Los Angeles, CA',
      bio: 'Independent writer-director focused on intimate thrillers and mobile-first storytelling.',
      isVerified: true
    },
    language: 'English',
    ageRating: 'TV-14',
    episodeCount: 12,
    averageEpisodeSeconds: 88,
    status: 'ongoing',
    rights: { creatorOwned: true, musicCleared: true, talentReleases: true, licenseReady: true },
    stats: { views: 128400, likes: 18420, saves: 6300 },
    featured: true,
    episodes: [
      { id: 'afterlight-1', number: 1, title: 'The First Exposure', durationSeconds: 82, videoUrl: SAMPLE_VIDEO, isFree: true },
      { id: 'afterlight-2', number: 2, title: 'Before Sunrise', durationSeconds: 91, videoUrl: SAMPLE_VIDEO, isFree: true },
      { id: 'afterlight-3', number: 3, title: 'Negative Space', durationSeconds: 86, videoUrl: SAMPLE_VIDEO, isFree: true }
    ]
  },
  {
    id: 'drama-dead-signal',
    title: 'Dead Signal',
    synopsis: 'Three friends receive voice notes from a phone number belonging to someone who disappeared five years earlier.',
    posterUrl: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=900&auto=format&fit=crop&q=85',
    genre: 'Horror',
    tags: ['found-footage', 'supernatural', 'phone'],
    director: {
      id: 'director-jordan-cole',
      name: 'Jordan Cole',
      handle: 'jcoleframes',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      location: 'Atlanta, GA',
      bio: 'DIY filmmaker creating horror stories designed for small crews, real locations, and fast release cycles.'
    },
    language: 'English',
    ageRating: 'TV-MA',
    episodeCount: 8,
    averageEpisodeSeconds: 74,
    status: 'complete',
    rights: { creatorOwned: true, musicCleared: true, talentReleases: true, licenseReady: true },
    stats: { views: 84300, likes: 11200, saves: 4100 },
    episodes: [
      { id: 'dead-signal-1', number: 1, title: 'Unknown Sender', durationSeconds: 70, videoUrl: SAMPLE_VIDEO, isFree: true },
      { id: 'dead-signal-2', number: 2, title: 'Playback', durationSeconds: 77, videoUrl: SAMPLE_VIDEO, isFree: true }
    ]
  },
  {
    id: 'drama-parallel-hearts',
    title: 'Parallel Hearts',
    synopsis: 'Two strangers keep meeting in the same places at different times, until a glitch in the city finally lets them see each other.',
    posterUrl: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=900&auto=format&fit=crop&q=85',
    genre: 'Romance',
    tags: ['sci-fi', 'romance', 'time-slip'],
    director: {
      id: 'director-imani-vale',
      name: 'Imani Vale',
      handle: 'imanivale',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      location: 'New York, NY',
      bio: 'Writer-director blending romance, speculative fiction, and music-driven visual storytelling.',
      isVerified: true
    },
    language: 'English',
    ageRating: 'TV-14',
    episodeCount: 15,
    averageEpisodeSeconds: 96,
    status: 'pilot',
    rights: { creatorOwned: true, musicCleared: false, talentReleases: true, licenseReady: false },
    stats: { views: 53700, likes: 9100, saves: 7200 },
    episodes: [
      { id: 'parallel-1', number: 1, title: 'Same Bench, Different Day', durationSeconds: 94, videoUrl: SAMPLE_VIDEO, isFree: true }
    ]
  },
  {
    id: 'drama-last-stop',
    title: 'Last Stop',
    synopsis: 'A rideshare driver realizes every passenger tonight is connected to the same unsolved crime.',
    posterUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=900&auto=format&fit=crop&q=85',
    genre: 'Crime',
    tags: ['crime', 'night', 'single-location'],
    director: {
      id: 'director-theo-park',
      name: 'Theo Park',
      handle: 'theoparkdirects',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      location: 'Seattle, WA',
      bio: 'Independent director building compact crime stories around performance, atmosphere, and contained production.'
    },
    language: 'English',
    ageRating: 'TV-14',
    episodeCount: 10,
    averageEpisodeSeconds: 83,
    status: 'ongoing',
    rights: { creatorOwned: true, musicCleared: true, talentReleases: false, licenseReady: false },
    stats: { views: 41600, likes: 6700, saves: 1900 },
    episodes: [
      { id: 'last-stop-1', number: 1, title: 'Passenger One', durationSeconds: 79, videoUrl: SAMPLE_VIDEO, isFree: true },
      { id: 'last-stop-2', number: 2, title: 'The Receipt', durationSeconds: 87, videoUrl: SAMPLE_VIDEO, isFree: true }
    ]
  }
];
