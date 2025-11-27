import { useState, useEffect } from "react";
import { useGameStore } from "../state/useGameStore";
import { PlayerList } from "./PlayerList";
import { PhaseControl } from "./PhaseControl";
import { ChatPanel } from "./ChatPanel";

function Timer({ endsAt }: { endsAt: number }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
        const diff = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
        setLeft(diff);
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);
  return <span className="timer">{left}s</span>;
}

export function GameScreen({ state, actions }: { state: ReturnType<typeof useGameStore>, actions: any }) {
  const { game, chatMessages } = state;

  if (!game) return <div>Loading...</div>;

  return (
    <div className="game-screen">
      <div className="top-bar">
        <div className="game-info">
            <strong>Game:</strong> {game.gameId} 
            <button className="copy-btn" onClick={() => navigator.clipboard.writeText(game.gameId)}>Copy</button>
        </div>
        <div className="phase-info">
            <span className="phase-badge">{game.phase.replace("_", " ")}</span>
            <span className="counters">D{game.dayNumber} | N{game.nightNumber}</span>
            <Timer endsAt={game.phaseEndsAt} />
        </div>
        <button className="leave-btn" onClick={() => actions.leaveGame()}>Leave</button>
      </div>

      <div className="main-layout">
        <div className="left-panel">
            <PlayerList game={game} />
        </div>
        
        <div className="center-panel">
            <PhaseControl game={game} actions={actions} />
        </div>

        <div className="right-panel">
            <ChatPanel 
                game={game} 
                messages={chatMessages} 
                sendChat={actions.sendChat} 
                sendTrialChat={actions.sendTrialChat} 
            />
        </div>
      </div>
    </div>
  );
}
