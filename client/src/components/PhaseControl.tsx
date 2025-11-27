import { GameView } from "../types";

interface PhaseControlProps {
  game: GameView;
  actions: any;
}

export function PhaseControl({ game, actions }: PhaseControlProps) {
  const me = game.you;
  const isHost = me.isHost;
  const isAlive = me.alive;

  // LOBBY
  if (game.phase === "LOBBY") {
    return (
      <div className="phase-control lobby">
        <h2>Lobby</h2>
        <p>Waiting for players...</p>
        {isHost && (
          <div className="host-actions">
             <button className="primary-btn" onClick={() => actions.startGame()}>START GAME</button>
             <hr />
             <div className="debug-box">
               <small>Debug Actions (Host Only)</small>
               <button onClick={() => actions.debugPopulate(game.players.length)}>
                 Fill with Bots
               </button>
             </div>
          </div>
        )}
      </div>
    );
  }

  // GAME OVER
  if (game.phase === "GAME_OVER") {
    return (
      <div className="phase-control game-over">
        <h2>GAME OVER</h2>
        <h1 className="winner">{game.winner} WIN!</h1>
        <button onClick={() => actions.leaveGame()}>Back to Menu</button>
      </div>
    );
  }

  // NIGHT
  if (game.phase === "NIGHT") {
    if (isAlive && me.role === "TRAITOR") {
      const targets = game.players.filter(p => p.alive && p.playerId !== me.playerId);
      return (
        <div className="phase-control night">
          <h2>Night Phase</h2>
          <p>Choose a target to eliminate:</p>
          <div className="target-list">
            {targets.map(p => (
              <button key={p.playerId} onClick={() => actions.sendNightVote(p.playerId)}>
                Attack {p.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="phase-control night">
        <h2>Night Phase</h2>
        <p>You are sleeping...</p>
      </div>
    );
  }

  // DAY DISCUSSION
  if (game.phase === "DAY_DISCUSSION") {
    if (!isAlive) return <div className="phase-control"><p>You are dead and cannot nominate.</p></div>;

    const targets = game.players.filter(p => p.alive && p.playerId !== me.playerId);
    return (
      <div className="phase-control day">
        <h2>Day Discussion</h2>
        <p>Discuss and nominate a suspect for trial.</p>
        <div className="target-list">
          {targets.map(p => (
            <button key={p.playerId} className="nominate-btn" onClick={() => actions.nominate(p.playerId)}>
              Nominate {p.name}
            </button>
          ))}
        </div>
        {isHost && (
             <div className="debug-box">
               <button onClick={() => actions.debugTimeout()}>Force Timeout (Skip)</button>
             </div>
        )}
      </div>
    );
  }

  // TRIAL
  if (game.phase === "TRIAL") {
    const isAccused = game.accusedId === me.playerId;
    const accusedName = game.players.find(p => p.playerId === game.accusedId)?.name || "Unknown";

    return (
      <div className="phase-control trial">
        <h2>Trial: {accusedName}</h2>
        {isAccused ? (
           <p>You are on trial! Defend yourself in the Trial Chat.</p>
        ) : (
           <p>Listen to the defense...</p>
        )}
        {isHost && (
             <div className="debug-box">
               <button onClick={() => actions.debugTimeout()}>Force Vote</button>
             </div>
        )}
      </div>
    );
  }

  // DAY VERDICT
  if (game.phase === "DAY_VERDICT") {
    const accusedName = game.players.find(p => p.playerId === game.accusedId)?.name || "Unknown";
    
    if (!isAlive) return <div className="phase-control"><p>You are dead and cannot vote.</p></div>;

    return (
      <div className="phase-control verdict">
        <h2>Verdict for {accusedName}</h2>
        <div className="verdict-buttons">
          <button className="hang-btn" onClick={() => actions.castVerdict("HANG")}>HANG</button>
          <button className="spare-btn" onClick={() => actions.castVerdict("SPARE")}>SPARE</button>
        </div>
      </div>
    );
  }

  return <div>Unknown Phase</div>;
}
