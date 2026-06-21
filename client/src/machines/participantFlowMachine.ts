import { assign, setup } from 'xstate';
import type { SearchResult } from '../shared/types';

type StatusMessage = { type: 'success' | 'error'; text: string } | null;

export type ParticipantFlowContext = {
  passkey: string;
  query: string;
  suggestions: string[];
  results: SearchResult[];
  isConfirmed: boolean;
  submittingId: string | null;
  statusMsg: StatusMessage;
  cooldownSeconds: number;
  suggestionRequestId: number;
  searchRequestId: number;
};

type ParticipantFlowEvent =
  | { type: 'PASSKEY_CHANGED'; value: string }
  | { type: 'SUBMIT_PASSKEY' }
  | { type: 'JOIN_OK' }
  | { type: 'JOIN_FAILED'; error: string }
  | { type: 'QUERY_CHANGED'; value: string }
  | { type: 'SUGGESTIONS_REQUESTED'; query: string }
  | { type: 'SUGGESTIONS_RECEIVED'; requestId: number; query: string; suggestions: string[] }
  | { type: 'SEARCH_REQUESTED'; query: string }
  | { type: 'SEARCH_RECEIVED'; requestId: number; query: string; results: SearchResult[] }
  | { type: 'SELECT_SONG'; youtubeId: string }
  | { type: 'SUBMIT_OK' }
  | { type: 'SUBMIT_FAILED'; error: string }
  | { type: 'COOLDOWN_TICK' }
  | { type: 'CLEAR_STATUS' }
  | { type: 'CONFIRM_QUERY'; value: boolean };

const initialContext: ParticipantFlowContext = {
  passkey: '',
  query: '',
  suggestions: [],
  results: [],
  isConfirmed: false,
  submittingId: null,
  statusMsg: null,
  cooldownSeconds: 0,
  suggestionRequestId: 0,
  searchRequestId: 0,
};

const sameQuery = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export const participantFlowMachine = setup({
  types: {
    context: {} as ParticipantFlowContext,
    events: {} as ParticipantFlowEvent,
  },
  actions: {
    setPasskey: assign(({ event }) =>
      event.type === 'PASSKEY_CHANGED' ? { passkey: event.value.replace(/\D/g, '') } : {},
    ),
    setJoinSuccess: assign({ statusMsg: { type: 'success', text: 'Access granted! Welcome to the room.' } }),
    setJoinFailure: assign(({ event }) =>
      event.type === 'JOIN_FAILED' ? { statusMsg: { type: 'error', text: event.error } } : {},
    ),
    setQuery: assign(({ context, event }) => {
      if (event.type !== 'QUERY_CHANGED') return {};
      const trimmed = event.value.trim();
      return {
        query: event.value,
        suggestions: trimmed.length < 2 ? [] : context.suggestions,
        results: trimmed.length === 0 ? [] : context.results,
      };
    }),
    startSuggestions: assign(({ context }) => ({ suggestionRequestId: context.suggestionRequestId + 1 })),
    finishSuggestions: assign(({ context, event }) => {
      if (event.type !== 'SUGGESTIONS_RECEIVED') return {};
      if (event.requestId !== context.suggestionRequestId || !sameQuery(event.query, context.query) || context.isConfirmed) return {};
      return { suggestions: event.suggestions.slice(0, 8) };
    }),
    startSearch: assign(({ context }) => ({ searchRequestId: context.searchRequestId + 1 })),
    finishSearch: assign(({ context, event }) => {
      if (event.type !== 'SEARCH_RECEIVED') return {};
      if (event.requestId !== context.searchRequestId || !sameQuery(event.query, context.query)) return {};
      return { results: event.results, statusMsg: null };
    }),
    setSubmitting: assign(({ event }) => (event.type === 'SELECT_SONG' ? { submittingId: event.youtubeId, statusMsg: { type: 'success', text: 'Submitting request...' } } : {})),
    setSubmitOk: assign({ submittingId: null, statusMsg: { type: 'success', text: 'Song added to queue!' }, cooldownSeconds: 3 }),
    setSubmitFailed: assign(({ event }) =>
      event.type === 'SUBMIT_FAILED' ? { submittingId: null, statusMsg: { type: 'error', text: event.error } } : {},
    ),
    tickCooldown: assign(({ context }) => ({ cooldownSeconds: Math.max(0, context.cooldownSeconds - 1) })),
    clearStatus: assign({ statusMsg: null }),
    setConfirmed: assign(({ event }) => (event.type === 'CONFIRM_QUERY' ? { isConfirmed: event.value } : {})),
  },
}).createMachine({
  id: 'participantFlow',
  initial: 'locked',
  context: initialContext,
  on: {
    PASSKEY_CHANGED: { actions: 'setPasskey' },
    QUERY_CHANGED: { actions: 'setQuery' },
    SUGGESTIONS_REQUESTED: { actions: 'startSuggestions' },
    SUGGESTIONS_RECEIVED: { actions: 'finishSuggestions' },
    SEARCH_REQUESTED: { target: '.searching', actions: 'startSearch' },
    SEARCH_RECEIVED: { actions: 'finishSearch' },
    CLEAR_STATUS: { actions: 'clearStatus' },
    CONFIRM_QUERY: { actions: 'setConfirmed' },
  },
  states: {
    locked: { on: { SUBMIT_PASSKEY: 'joining', JOIN_OK: { target: 'joined', actions: 'setJoinSuccess' } } },
    joining: { on: { JOIN_OK: { target: 'joined', actions: 'setJoinSuccess' }, JOIN_FAILED: { target: 'locked', actions: 'setJoinFailure' } } },
    joined: { on: { SELECT_SONG: { target: 'submitting', actions: 'setSubmitting' } } },
    searching: { on: { SEARCH_RECEIVED: { target: 'joined', actions: 'finishSearch' }, SELECT_SONG: { target: 'submitting', actions: 'setSubmitting' } } },
    submitting: { on: { SUBMIT_OK: { target: 'cooldown', actions: 'setSubmitOk' }, SUBMIT_FAILED: { target: 'joined', actions: 'setSubmitFailed' } } },
    cooldown: { on: { COOLDOWN_TICK: [{ guard: ({ context }) => context.cooldownSeconds <= 1, target: 'joined', actions: 'tickCooldown' }, { actions: 'tickCooldown' }] } },
    error: {},
  },
});
