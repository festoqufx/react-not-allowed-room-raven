import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Send, X } from 'lucide-react';
import { getNarReply, NAR_BOT_NAME } from '../lib/narBot';
import './NarChatbot.css';

const starter = {
  id: 'nar-hello',
  from: 'bot',
  text: 'Hi. I am NAR. Ask me about rooms, camera, calls, or invites.',
};

const NarChatbot = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState([starter]);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = (event) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;

    const userMessage = { id: `user-${Date.now()}`, from: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPending(true);

    window.setTimeout(() => {
      const reply = getNarReply(text, 'there');
      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, from: 'bot', text: reply },
      ]);
      setPending(false);
    }, 420);
  };

  return (
    <div className={`nar-chatbot ${location.pathname.startsWith('/room/') ? 'in-room' : ''}`}>
      <AnimatePresence>
        {open && (
          <motion.section
            className="nar-chatbot-panel"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            aria-label="NAR assistant"
          >
            <header className="nar-chatbot-header">
              <div>
                <strong>{NAR_BOT_NAME}</strong>
                <span>Always-on room assistant</span>
              </div>
              <button type="button" className="nar-chatbot-icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X size={16} />
              </button>
            </header>

            <div className="nar-chatbot-messages" ref={listRef}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`nar-chatbot-bubble ${message.from === 'user' ? 'own' : 'bot'}`}
                >
                  {message.text}
                </div>
              ))}
              {pending && <div className="nar-chatbot-bubble bot pending">NAR is typing…</div>}
            </div>

            <form className="nar-chatbot-form" onSubmit={send}>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask NAR anything…"
                aria-label="Message NAR"
              />
              <button type="submit" disabled={!input.trim() || pending} aria-label="Send message">
                <Send size={16} />
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        className={`nar-chatbot-toggle ${open ? 'open' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close NAR assistant' : 'Open NAR assistant'}
      >
        {open ? <X size={20} /> : <Bot size={20} />}
      </button>
    </div>
  );
};

export default NarChatbot;
