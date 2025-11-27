import { useGameStore } from "./state/useGameStore";
import { ConnectScreen } from "./components/ConnectScreen";
import { GameScreen } from "./components/GameScreen";
import "./App.css";

function App() {
  const store = useGameStore();
  const { game, lastError } = store;

  return (
    <div className="app-container">
      {lastError && (
        <div className="error-banner">
            {lastError}
            <button onClick={() => store.leaveGame()}>Dismiss</button>
        </div>
      )}
      
      {!game ? (
        <ConnectScreen actions={store} />
      ) : (
        <GameScreen state={store} actions={store} />
      )}
    </div>
  );
}

export default App;
