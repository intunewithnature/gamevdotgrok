import { useState } from "react";
import { useGameStore } from "../state/useGameStore";
import "../App.css";

export function ConnectScreen({ actions }: { actions: ReturnType<typeof useGameStore> }) {
  const [name, setName] = useState("Player");
  const [joinId, setJoinId] = useState("");
  const [minPlayers, setMinPlayers] = useState("6");

  return (
    <div className="connect-screen">
      <h1>Impious Werewolf</h1>
      <div className="card">
        <div className="input-group">
          <label>Your Name</label>
          <input value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="actions">
          <div className="action-col">
            <h3>Create New Game</h3>
            <div className="input-group">
              <label>Min Players</label>
              <input 
                type="number" 
                value={minPlayers} 
                onChange={e => setMinPlayers(e.target.value)}
                style={{ width: "60px" }}
              />
            </div>
            <button onClick={() => actions.createGame(name, Number(minPlayers))}>
              Create Game
            </button>
          </div>

          <div className="separator">OR</div>

          <div className="action-col">
            <h3>Join Existing</h3>
            <div className="input-group">
              <label>Game ID</label>
              <input value={joinId} onChange={e => setJoinId(e.target.value)} placeholder="UUID..." />
            </div>
            <button onClick={() => actions.joinGame(joinId, name)} disabled={!joinId}>
              Join Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
