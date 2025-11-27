import { GameView } from "../types";

export function PlayerList({ game }: { game: GameView }) {
  return (
    <div className="panel player-list">
      <h3>Players ({game.players.length})</h3>
      <ul>
        {game.players.map(p => {
          const isMe = p.playerId === game.you.playerId;
          const isAccused = p.playerId === game.accusedId;

          return (
            <li key={p.playerId} className={`player-item ${!p.alive ? "dead" : ""} ${isAccused ? "accused" : ""}`}>
              <div className="player-row">
                <span className="player-name">
                  {p.name} {isMe && "(You)"}
                </span>
                <span className="badges">
                  {p.isHost && <span className="badge host">HOST</span>}
                  {!p.connected && <span className="badge dc">DC</span>}
                  {!p.alive && <span className="badge dead">DEAD</span>}
                </span>
              </div>
              {isAccused && <div className="status-text">ON TRIAL</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
