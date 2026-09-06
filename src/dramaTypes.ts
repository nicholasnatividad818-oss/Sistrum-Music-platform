export type DramaGenre =
  | 'Drama'
  | 'Thriller'
  | 'Romance'
  | 'Crime'
  | 'Sci-Fi'
  | 'Comedy'
  | 'Horror'
  | 'Experimental';

export interface DramaDirector {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  location: string;
  bio: string;
  isVerified?: boolean;
}

export interface DramaEpisode {
  id: string;
  number: number;
  title: string;
  durationSeconds: number;
  videoUrl?: string;
  isFree: boolean;
}

export interface DramaSeries {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  genre: DramaGenre;
  tags: string[];
  director: DramaDirector;
  language: string;
  ageRating: string;
  episodeCount: number;
  averageEpisodeSeconds: number;
  status: 'pilot' | 'ongoing' | 'complete';
  rights: {
    creatorOwned: boolean;
    musicCleared: boolean;
    talentReleases: boolean;
    licenseReady: boolean;
  };
  stats: {
    views: number;
    likes: number;
    saves: number;
  };
  featured?: boolean;
  episodes: DramaEpisode[];
}

export interface DramaSubmission {
  id: string;
  title: string;
  directorName: string;
  email: string;
  logline: string;
  screenerUrl: string;
  format: 'vertical' | 'horizontal' | 'mixed';
  rightsConfirmed: boolean;
  submittedAt: string;
}
