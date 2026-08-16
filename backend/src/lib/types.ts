export type Category =
  | '72H'
  | 'MARIJA_BISTRICA'
  | 'BIBLIJA'
  | 'VJERA'
  | 'SVECI'
  | 'MARIJA_KRUNICA';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type OptionKey = 'A' | 'B' | 'C';

export interface QuestionSeed {
  id: string;
  category: Category;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct_answer: OptionKey;
  difficulty: Difficulty;
  active: boolean;
}

export interface QuestionRow extends QuestionSeed {}

export interface PlayerRow {
  id: string;
  nickname: string;
  email: string;
  marketing_consent: boolean;
  terms_accepted: boolean;
  created_at: string;
}

export type AttemptStatus = 'in_progress' | 'finished' | 'expired';

export interface AttemptRow {
  id: string;
  player_id: string;
  started_at: string;
  expires_at: string;
  finished_at: string | null;
  score: number;
  answered_count: number;
  status: AttemptStatus;
  question_order: string[];
  created_at: string;
}

export interface AnswerRow {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_answer: OptionKey;
  is_correct: boolean;
  answered_at: string;
  sequence_number: number;
}

export interface EventConfigRow {
  id: number;
  project_name: string;
  edition_year: number;
  slogan: string | null;
  official_registration_url: string | null;
  official_project_url: string | null;
  organizer_name: string | null;
  age_min: number | null;
  age_max: number | null;
  updated_at: string;
}

export const QUIZ_DURATION_SECONDS = 72;
export const MIN_72H_MANDATORY = 3; // always first 3
export const MIN_72H_TOTAL = 5; // at least 5 total per attempt
