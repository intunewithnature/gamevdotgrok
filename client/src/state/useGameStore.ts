import { useEffect, useReducer } from "react";
import { v4 as uuidv4 } from "uuid";
import { wsClient } from "../ws/WerewolfClient";
import { 
  GameView, 
  ServerMessage, 
  ChatChannel, 
  ChatMessageDisplay,
  ClientMessage,
  VerdictChoice
} from "../types";

// Stable Account ID
const STORAGE_KEY = "impious_account_id";
let storedAccountId = localStorage.getItem(STORAGE_KEY);
if (!storedAccountId) {
  storedAccountId = uuidv4();
  localStorage.setItem(STORAGE_KEY, storedAccountId);
}
export const ACCOUNT_ID = storedAccountId!;

interface GameState {
  isConnected: boolean;
  game: GameView | null;
  playerId: string | null;
  chatMessages: Record<ChatChannel, ChatMessageDisplay[]>;
  lastError: string | null;
}

type Action =
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_GAME"; game: GameView; playerId?: string }
  | { type: "ADD_CHAT"; message: ChatMessageDisplay }
  | { type: "SET_ERROR"; error: string }
  | { type: "RESET" };

const initialState: GameState = {
  isConnected: false,
  game: null,
  playerId: null,
  chatMessages: {
    LOBBY: [],
    DAY: [],
    NIGHT_TRAITORS: [],
    TRIAL: [],
    GAME_OVER: []
  },
  lastError: null
};

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.connected };
    case "SET_GAME":
      return { 
        ...state, 
        game: action.game, 
        playerId: action.playerId || state.playerId,
        lastError: null 
      };
    case "ADD_CHAT": {
      const channel = action.message.channel;
      return {
        ...state,
        chatMessages: {
          ...state.chatMessages,
          [channel]: [...(state.chatMessages[channel] || []), action.message]
        }
      };
    }
    case "SET_ERROR":
      return { ...state, lastError: action.error };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export function useGameStore() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    wsClient.connect();
    
    const handleMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case "GAME_CREATED":
        case "PLAYER_JOINED":
          dispatch({ type: "SET_GAME", game: msg.payload.game, playerId: msg.payload.playerId });
          break;
        case "GAME_STATE":
          dispatch({ type: "SET_GAME", game: msg.payload.game });
          break;
        case "CHAT":
          dispatch({ 
            type: "ADD_CHAT", 
            message: {
              id: uuidv4(),
              senderId: msg.payload.playerId,
              text: msg.payload.text,
              channel: msg.payload.channel,
              timestamp: msg.payload.timestamp
            }
          });
          break;
        case "TRIAL_CHAT":
           dispatch({ 
            type: "ADD_CHAT", 
            message: {
              id: uuidv4(),
              senderId: msg.payload.playerId,
              text: msg.payload.text,
              channel: "TRIAL",
              timestamp: msg.payload.timestamp
            }
          });
          break;
        case "ERROR":
          dispatch({ type: "SET_ERROR", error: `[${msg.payload.code}] ${msg.payload.message}` });
          break;
      }
    };

    wsClient.addListener(handleMessage);
    return () => {
      wsClient.removeListener(handleMessage);
      wsClient.disconnect();
    };
  }, []);

  // Actions
  const send = (msg: ClientMessage) => wsClient.send(msg);

  const createGame = (name: string, minPlayers?: number) => {
    send({ type: "CREATE_GAME", payload: { accountId: ACCOUNT_ID, name, minPlayers }});
  };

  const joinGame = (gameId: string, name: string) => {
    send({ type: "JOIN_GAME", payload: { gameId, accountId: ACCOUNT_ID, name }});
  };

  const leaveGame = () => {
    if (state.game && state.playerId) {
      send({ type: "LEAVE_GAME", payload: { gameId: state.game.gameId, playerId: state.playerId }});
      dispatch({ type: "RESET" });
    }
  };

  const startGame = () => {
    if (!state.game || !state.playerId) return;
    send({ type: "START_GAME", payload: { gameId: state.game.gameId, playerId: state.playerId }});
  };

  const sendChat = (text: string) => {
    if (!state.game || !state.playerId) return;
    send({ type: "CHAT", payload: { gameId: state.game.gameId, playerId: state.playerId, text }});
  };

  const sendTrialChat = (text: string) => {
    if (!state.game || !state.playerId) return;
    send({ type: "TRIAL_CHAT", payload: { gameId: state.game.gameId, playerId: state.playerId, text }});
  };

  const sendNightVote = (targetId: string) => {
    if (!state.game || !state.playerId) return;
    send({ type: "NIGHT_VOTE", payload: { gameId: state.game.gameId, playerId: state.playerId, targetId }});
  };

  const nominate = (targetId: string) => {
    if (!state.game || !state.playerId) return;
    send({ type: "DAY_NOMINATE", payload: { gameId: state.game.gameId, playerId: state.playerId, targetId }});
  };

  const castVerdict = (choice: VerdictChoice) => {
    if (!state.game || !state.playerId) return;
    send({ type: "DAY_VERDICT_VOTE", payload: { gameId: state.game.gameId, playerId: state.playerId, choice }});
  };

  const debugPopulate = (totalPlayers: number) => {
    if (!state.game || !state.playerId) return;
    send({ type: "DEBUG_POPULATE_LOBBY", payload: { gameId: state.game.gameId, playerId: state.playerId, totalPlayers }});
  };

  const debugTimeout = () => {
    if (!state.game || !state.playerId) return;
    send({ type: "DEBUG_FORCE_TIMEOUT", payload: { gameId: state.game.gameId, playerId: state.playerId }});
  };

  return {
    ...state,
    createGame,
    joinGame,
    leaveGame,
    startGame,
    sendChat,
    sendTrialChat,
    sendNightVote,
    nominate,
    castVerdict,
    debugPopulate,
    debugTimeout
  };
}
