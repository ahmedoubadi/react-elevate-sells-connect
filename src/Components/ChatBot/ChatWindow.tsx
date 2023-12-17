import React, { useEffect, useRef, useState } from 'react';
import styles from './chatbot.module.css';
import { Client } from 'client';
import { API_RESPONSE, Assistant, CHAT, DISCUSSION } from 'types';
// @ts-ignore
import Send from '../../Assets/icons/send.svg';
// @ts-ignore
import BotIcon from '../../Assets/icons/ai-assistant.png';
export interface ChatWindowProps {
  apiKey: string;
  assistantId: string;
  baseURL:string
}
export function ChatWindow({ apiKey, assistantId,baseURL }: ChatWindowProps) {
  const bottomEl = useRef<HTMLDivElement>(null);
  const [isVisible, setVisible] = useState<boolean>(true);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [discussion, setDiscussion] = useState<DISCUSSION | null>(null);
  const [messages, setMessages] = useState<CHAT[]>([]);
  const [answer, setAnswer] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [user, setUser] = useState<string>('');
  const [userInput, setUserInput] = useState<string>('');
  const client = new Client({
    apiKey,
    assistantId,
    baseURL,
  });
  async function createChat(assistant_id: string) {
    const checkDiscussion = localStorage.getItem('discussion')
    if (checkDiscussion) {
      setDiscussion(JSON.parse(checkDiscussion))
      return
    }
    try {
      const response: API_RESPONSE = await client.post(
        `${client.baseURL}/chat/create-chat`,
        {
          body: {
            input: { assistant_id },
          },
        }
      );
      if (response && response.data) {
        localStorage.setItem("discussion",JSON.stringify(response.data))
        setDiscussion(response.data);
      }
    } catch (error) {
      console.log({ error });
    }
  }

  async function getAssistantInfo() {
    try {
      const response: API_RESPONSE = await client.get(
        `${client.baseURL}/assistant/info/${assistantId}`
      );

      if (response && response.data) {
        setAssistant(response.data);
      }
    } catch (error) {
      console.log({ error });
    }
  }

  const generateResponse = async () => {
    if (!user) {
      return;
    }
    setUserInput(user);
    if (!discussion?.id) return;
    setAnswer('');
    setLoading(true);
    const url = `${client.baseURL}/chat/completions/${discussion?.id}`;
    let finalAnswer = '';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { user },
        }),
      });
      // This data is a ReadableStream
      const data = response.body;

      if (!data) {
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break; // Exit the loop when the response is complete
        }

        const chunkValue = decoder.decode(value);
        finalAnswer = finalAnswer + chunkValue;
        // Append the received chunk to the output element
        setAnswer((prev) => prev + chunkValue);
      }
    } catch (error) {
      console.log({ error });
    } finally {
      setUserInput('');
      setMessages([
        ...messages,
        { user, assistant: finalAnswer, discussion_id: discussion.id },
      ]);
      setUser('');
      setAnswer('');
      setLoading(false);
    }
  };
  useEffect(() => {
    getAssistantInfo()
      .catch((e) => console.log(e))
      .finally(() => {
        createChat(assistantId);
      });
  }, []);

  const scrollToBottom = () => {
    bottomEl?.current?.scrollIntoView();
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages, answer, userInput]);
  return (
    <div className={styles.win_chat}>
      <section
        className={`${styles.win_body} ${
          isVisible
            ? styles.scale_up_bottom_right
            : styles.scale_down_bottom_right
        }`}
      >
        <header
          style={{
            height: '70px',
            backgroundImage: `-webkit-linear-gradient(90deg,${assistant?.color} 0,#2182df 100%)`,
          }}
        >
          <div className={styles.header_content}>
            <div className={styles.company_logo}>
              <span>
                <img width={30} height={30} src={assistant?.logo} />
              </span>
            </div>
            <div className={styles.header_txt}>
              <div className={`${styles.agent_name} ${styles.txtelips}`}>
                {assistant?.name}
              </div>
            </div>
          </div>
          <div
            onClick={() => setVisible(false)}
            className={`${styles.win_close} ${styles.win_close_arrow}`}
            aria-label="Minimize live chat window"
          ></div>
        </header>
        <section className={styles.content}>
          <div className={styles.chat_content}>
            <div className={styles.disply_tbl}>
              <div className={styles.disply_cel}>
                <div
                  className={`${styles.msgbx} ${styles.assistant}`}
                  style={{ backgroundColor: assistant?.color }}
                >
                  <span className={styles.message}>
                    <div> {assistant?.welcome_message} </div>
                  </span>
                </div>
                {messages.map((message, index) => (
                  <div key={`${index}user`}>
                    <div className={styles.msgbx}>
                      <span className={styles.message}>
                        <div> {message.user} </div>
                      </span>
                    </div>
                    <div
                      className={`${styles.msgbx} ${styles.assistant}`}
                      style={{ backgroundColor: assistant?.color }}
                    >
                      <span className={styles.message}>
                        <div> {message.assistant} </div>
                      </span>
                    </div>
                  </div>
                ))}
                {userInput && (
                  <div className={styles.msgbx}>
                    <span className={styles.message}>
                      <div> {userInput} </div>
                    </span>
                  </div>
                )}
                {answer && (
                  <div
                    className={`${styles.msgbx} ${styles.assistant}`}
                    style={{ backgroundColor: assistant?.color }}
                  >
                    <span className={styles.message}>
                      <div> {answer} </div>
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div ref={bottomEl}></div>
          </div>
          <div className={styles.user_input}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                generateResponse();
              }}
            >
              <input
                placeholder="ask your question..."
                onChange={(e) => setUser(e.target.value)}
                value={user}
              />
              <button type="submit" disabled={isLoading}>
                <img src={Send} />
              </button>
            </form>
          </div>
        </section>
      </section>
      <section
        className={`${styles.chat_circle_body} ${
          isVisible
            ? styles.scale_down_bottom_right
            : styles.scale_up_bottom_right
        }`}
      >
        {assistant && (
          <div
            className={styles.chat_bubble}
            style={{ backgroundColor: assistant ? assistant.color : '#5A5EB9' }}
          >
            <p>
              {assistant.welcome_message &&
              assistant.welcome_message.length > 400
                ? assistant.welcome_message.slice(0, 400) + '...'
                : assistant.welcome_message}
            </p>
          </div>
        )}
        <div
          onClick={() => setVisible(true)}
          className={`${styles.chat_circle} ${styles.center}`}
          style={{ backgroundColor: assistant ? assistant.color : '#5A5EB9' }}
        >
          <div className={`${styles.chat_assistant} ${styles.center}`}>
            <img src={BotIcon} />
          </div>
        </div>
      </section>
    </div>
  );
}
