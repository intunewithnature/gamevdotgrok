import { useState, useEffect, useRef, FormEvent } from "react";
import { GameView, ChatChannel, ChatMessageDisplay } from "../types";

interface ChatPanelProps {
  game: GameView;
  messages: Record<ChatChannel, ChatMessageDisplay[]>;
  sendChat: (text: string) => void;
  sendTrialChat: (text: string) => void;
}

export function ChatPanel({ game, messages, sendChat, sendTrialChat }: ChatPanelProps) {
  const me = game.you;
  const isAlive = me.alive;
  const isTraitor = me.role === "TRAITOR";
  const isAccused = game.accusedId === me.playerId;

  const [activeTab, setActiveTab] = useState<ChatChannel>("LOBBY");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (game.phase === "LOBBY") setActiveTab("LOBBY");
    else if (game.phase === "GAME_OVER") setActiveTab("GAME_OVER");
    else if (game.phase === "TRIAL") setActiveTab("TRIAL");
    else if (game.phase === "NIGHT" && isTraitor) setActiveTab("NIGHT_TRAITORS");
    else setActiveTab("DAY");
  }, [game.phase, isTraitor]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  const currentMessages = messages[activeTab] || [];

  const canSendInTab = (() => {
    if (activeTab === "TRIAL") {
      return game.phase === "TRIAL" && isAccused;
    }
    if (activeTab === "DAY") {
      return game.phase === "DAY_DISCUSSION" || game.phase === "DAY_VERDICT";
    }
    if (activeTab === "NIGHT_TRAITORS") {
      return game.phase === "NIGHT" && isTraitor && isAlive;
    }
    if (activeTab === "LOBBY") {
      return game.phase === "LOBBY";
    }
    if (activeTab === "GAME_OVER") {
      return game.phase === "GAME_OVER";
    }
    return false;
  })();

  const handleSend = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSendInTab) return;

    const input = e.currentTarget.elements.namedItem("chatInput") as HTMLInputElement;
    const text = input.value.trim();
    if (!text) return;

    if (activeTab === "TRIAL") {
      sendTrialChat(text);
    } else {
      sendChat(text);
    }
    input.value = "";
  };

  const getSenderName = (id: string) => {
    const p = game.players.find(x => x.playerId === id);
    return p ? p.name : "Unknown";
  };

  return (
    <div className="panel chat-panel">
      <div className="chat-tabs">
        <button className={activeTab === "LOBBY" ? "active" : ""} onClick={() => setActiveTab("LOBBY")}>Lobby</button>
        <button className={activeTab === "DAY" ? "active" : ""} onClick={() => setActiveTab("DAY")}>Day</button>
        {isTraitor && <button className={activeTab === "NIGHT_TRAITORS" ? "active" : ""} onClick={() => setActiveTab("NIGHT_TRAITORS")}>Traitor</button>}
        <button className={activeTab === "TRIAL" ? "active" : ""} onClick={() => setActiveTab("TRIAL")}>Trial</button>
        <button className={activeTab === "GAME_OVER" ? "active" : ""} onClick={() => setActiveTab("GAME_OVER")}>End</button>
      </div>

      <div className="chat-log">
        {currentMessages.map(m => (
          <div key={m.id} className="chat-msg">
            <span className="chat-author">{getSenderName(m.senderId)}: </span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSend}>
        <input
          name="chatInput"
          placeholder={canSendInTab ? `Message ${activeTab}...` : "You cannot chat here right now"}
          autoComplete="off"
          disabled={!canSendInTab}
        />
        <button type="submit" disabled={!canSendInTab}>Send</button>
      </form>
    </div>
  );
}
