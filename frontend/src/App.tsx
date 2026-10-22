import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, firebaseEnabled, googleProvider } from "../utils/firebase";
import { Activity, ArrowUp, Check, ChevronDown, CircleHelp, Code2, Copy, FileImage, Globe2, ImagePlus, Menu, MessageSquare, Plus, Search, Settings2, Sparkles, Trash2, X } from "lucide-react";

type Role = "user" | "assistant";
type Message = { id:string; role:Role; content:string; agent?:string; images?:string[]; sources?:Array<{title?:string;url?:string}> };
type Conversation = { id:string; title:string; createdAt?:string; updatedAt?:string };
const API = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/,"");
const userKey = "akshar-guest-id";
function getUserId() { let id=localStorage.getItem(userKey); if(!id){id=crypto.randomUUID();localStorage.setItem(userKey,id)} return id; }
async function request<T>(path:string, init?:RequestInit):Promise<T> {
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
  const response=await fetch(`${API}/api${path}`,{...init,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`} : {}),...(init?.headers||{})}});
  const data=await response.json().catch(()=>({error:"The server returned an invalid response."}));
  if(!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
function newMessage(role:Role,content:string,extra:Partial<Message>={}):Message { return {id:crypto.randomUUID(),role,content,...extra}; }

export default function App() {
  const [guestId] = useState(getUserId);
  const [authUser,setAuthUser] = useState<User|null>(auth?.currentUser ?? null);
  const userId = authUser?.uid || guestId;
  const [conversations,setConversations]=useState<Conversation[]>([]);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [prompt,setPrompt]=useState("");
  const [images,setImages]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLTextAreaElement>(null);

  async function loadConversations() {
    try { const data=await request<{conversations:Conversation[]}>(`/conversations?userId=${encodeURIComponent(userId)}`); setConversations(data.conversations); }
    catch(e){setError(e instanceof Error?e.message:"Could not load conversations.");}
  }
  useEffect(()=>{ if(!auth) return; return onAuthStateChanged(auth,setAuthUser); },[]);
  useEffect(()=>{void loadConversations();},[userId]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages,loading]);
  async function openConversation(id:string) {
    setActiveId(id); setError("");
    try { const data=await request<{messages:Array<{id:string;role:Role;content:string;agent:string;images?:string[]}>}>(`/conversations/${encodeURIComponent(id)}/messages?userId=${encodeURIComponent(userId)}`); setMessages(data.messages.map(m=>({...m,images:m.images||[]}))); }
    catch(e){setError(e instanceof Error?e.message:"Could not load messages.");}
  }
  function startNew() { setActiveId(null);setMessages([]);setPrompt("");setImages([]);setError("");inputRef.current?.focus(); }
  async function attachFiles(list:FileList|null) {
    if(!list)return;
    const files=Array.from(list).filter(f=>f.type.startsWith("image/")).slice(0,4-images.length);
    const converted=await Promise.all(files.map(file=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read image."));reader.readAsDataURL(file)})));
    setImages(prev=>[...prev,...converted].slice(0,4));
  }
  async function send(event?:FormEvent) {
    event?.preventDefault();
    const text=prompt.trim();
    if((!text && !images.length)||loading)return;
    setLoading(true);setError("");
    const sentImages=[...images];
    const userMessage=newMessage("user",text||"Please analyze this image.",{images:sentImages});
    setMessages(prev=>[...prev,userMessage]);setPrompt("");setImages([]);
    try {
      const data=await request<{conversationId:string;message:{id:string;role:Role;content:string;agent:string};agent:string;sources:Array<{title?:string;url?:string}>}>("/chat",{method:"POST",body:JSON.stringify({userId,conversationId:activeId||undefined,prompt:text||"Please analyze this image.",images:sentImages,history:messages.slice(-10).map(m=>({role:m.role,content:m.content}))})});
      setActiveId(data.conversationId);
      setMessages(prev=>[...prev,{...data.message,sources:data.sources}]);
      await loadConversations();
    } catch(e) { setError(e instanceof Error?e.message:"Something went wrong."); }
    finally {setLoading(false);inputRef.current?.focus();}
  }
  function onKeyDown(e:KeyboardEvent<HTMLTextAreaElement>) { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send()} }
  async function deleteConversation(id:string) {
    try { await request(`/conversations/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,{method:"DELETE"});setConversations(prev=>prev.filter(c=>c.id!==id));if(activeId===id)startNew(); }
    catch(e){setError(e instanceof Error?e.message:"Could not delete chat.");}
  }
  async function copyText(message:Message) { await navigator.clipboard.writeText(message.content);setCopied(message.id);setTimeout(()=>setCopied(""),1200); }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen?"":"sidebar-hidden"}`}>
      <div className="brand-row"><div className="brand-mark"><span>A</span><i /></div><span className="brand-name">akshar<span>.</span></span><button className="icon-button subtle mobile-only" aria-label="Close sidebar" onClick={()=>setSidebarOpen(false)}><X size={17}/></button></div>
      <button className="new-chat" onClick={startNew}><Plus size={17}/><span>New chat</span><kbd>⌘ K</kbd></button>
      <div className="sidebar-label">WORKSPACE</div>
      <button className="side-link active"><MessageSquare size={16}/> All chats</button>
      <button className="side-link" onClick={()=>{setPrompt("Help me research this topic: ");inputRef.current?.focus()}}><Search size={16}/> Research</button>
      <button className="side-link" onClick={()=>{setPrompt("Help me debug this code: ");inputRef.current?.focus()}}><Code2 size={16}/> Coding</button>
      <div className="history-heading"><span>RECENT</span><button className="icon-button" onClick={loadConversations} title="Refresh"><Activity size={14}/></button></div>
      <div className="conversation-list">
        {conversations.length===0?<div className="empty-history">Your conversations<br/>will show up here.</div>:conversations.map(c=><div className={`conversation-item ${activeId===c.id?"selected":""}`} key={c.id}><button className="conversation-open" onClick={()=>void openConversation(c.id)}><MessageSquare size={14}/><span>{c.title||"New chat"}</span></button><button className="delete-chat" aria-label="Delete conversation" onClick={()=>void deleteConversation(c.id)}><Trash2 size={13}/></button></div>)}
      </div>
      <div className="sidebar-bottom"><div className="user-avatar">{(authUser?.displayName||"Y").slice(0,1).toUpperCase()}</div><div className="user-meta"><strong>{authUser?.displayName||"Guest session"}</strong><span>{authUser?.email||"Local development"}</span></div>{authUser&&<button className="icon-button" title="Sign out" onClick={()=>void signOut(auth!)}><Settings2 size={16}/></button>}</div>
    </aside>
    <main className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="icon-button" aria-label="Toggle sidebar" onClick={()=>setSidebarOpen(v=>!v)}><Menu size={18}/></button><div className="breadcrumb"><span>Akshar</span><span className="crumb-slash">/</span><strong>{activeId?conversations.find(c=>c.id===activeId)?.title||"Chat":"New conversation"}</strong></div></div><div className="topbar-right"><span className="status-dot"/><span className="status-text">AI systems ready</span><button className="model-pill"><span className="model-orb"><Sparkles size={12}/></span> Akshar AI <ChevronDown size={13}/></button></div></header>
      {messages.length===0?<section className="welcome"><div className="welcome-kicker"><span className="pulse-dot"/> YOUR THINKING PARTNER</div><div className="hero-symbol"><div className="hero-ring ring-one"/><div className="hero-ring ring-two"/><div className="hero-a">A<span>·</span></div><Sparkles className="sparkle sparkle-a" size={16}/><Sparkles className="sparkle sparkle-b" size={11}/></div><h1>What are we<br/><em>figuring out</em> today?</h1><p className="hero-description">Research an idea, build something, or drop in an image.<br/>Let's make the complicated feel simple.</p><div className="suggestion-grid">
        <button className="suggestion-card" onClick={()=>setPrompt("Explain a complex topic in simple terms: ")}><span className="suggestion-icon orange"><Sparkles size={16}/></span><span><strong>Make sense of a topic</strong><small>Break down something complex</small></span><ArrowUp size={15}/></button>
        <button className="suggestion-card" onClick={()=>setPrompt("Help me debug this code: ")}><span className="suggestion-icon slate"><Code2 size={16}/></span><span><strong>Build or debug code</strong><small>Turn an idea into working code</small></span><ArrowUp size={15}/></button>
        <button className="suggestion-card" onClick={()=>{setPrompt("Research the latest information about ");inputRef.current?.focus()}}><span className="suggestion-icon red"><Globe2 size={16}/></span><span><strong>Explore what's happening</strong><small>Find context and useful sources</small></span><ArrowUp size={15}/></button>
        <button className="suggestion-card" onClick={()=>fileRef.current?.click()}><span className="suggestion-icon muted"><FileImage size={16}/></span><span><strong>Understand an image</strong><small>Upload a screenshot or photo</small></span><ArrowUp size={15}/></button>
      </div><div className="welcome-foot"><CircleHelp size={13}/> Akshar can make mistakes. Verify important information.</div></section>:<section className="messages-area"><div className="thread-intro"><div className="thread-line"/><span>CONVERSATION</span><div className="thread-line"/></div>{messages.map(m=><article key={m.id} className={`message-row ${m.role==="user"?"from-user":"from-ai"}`}>{m.role==="assistant"&&<div className="assistant-avatar"><span>A</span></div>}<div className="message-main"><div className="message-meta"><strong>{m.role==="user"?"You":"Akshar"}</strong>{m.role==="assistant"&&<><span className="meta-dot">·</span><span className="agent-label">{m.agent||"assistant"}</span></>}<span className="meta-time">{m.role==="user"?"YOU":"AI"}</span></div>{!!m.images?.length&&<div className="message-images">{m.images.map((src,i)=><img src={src} key={i} alt="User attachment"/>)}</div>}<div className="message-content">{m.content}</div>{!!m.sources?.length&&<div className="sources"><span>Sources</span>{m.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noreferrer">{s.title||s.url}</a>)}</div>}{m.role==="assistant"&&<div className="message-actions"><button onClick={()=>void copyText(m)}>{copied===m.id?<Check size={13}/>:<Copy size={13}/>} {copied===m.id?"Copied":"Copy"}</button></div>}</div></article>)}{loading&&<div className="thinking-row"><div className="assistant-avatar"><span>A</span></div><div><div className="thinking-label">AKSHAR IS THINKING</div><div className="thinking-dots"><i/><i/><i/></div></div></div>}<div ref={bottomRef}/></section>}
      {error&&<div className="error-banner"><span>{error}</span><button onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
      <div className="composer-wrap"><form className="composer" onSubmit={send}>{images.length>0&&<div className="attachment-strip">{images.map((src,i)=><div className="attachment-thumb" key={i}><img src={src} alt={`Attachment ${i+1}`}/><button type="button" onClick={()=>setImages(prev=>prev.filter((_,n)=>n!==i))} aria-label="Remove image"><X size={12}/></button></div>)}<span>{images.length}/4 images</span></div>}<textarea ref={inputRef} rows={1} value={prompt} onChange={e=>setPrompt(e.target.value)} onKeyDown={onKeyDown} placeholder="Ask anything, or attach an image..." aria-label="Message Akshar AI"/><div className="composer-tools"><div className="composer-left"><button type="button" className="tool-button" onClick={()=>fileRef.current?.click()} title="Attach image"><ImagePlus size={16}/><span>Attach</span></button><span className="tool-divider"/><span className="mode-label"><span className="mode-dot"/> Auto mode</span></div><div className="composer-right"><span className="enter-hint">↵ to send</span><button className="send-button" type="submit" disabled={loading||(!prompt.trim()&&!images.length)} aria-label="Send message">{loading?<span className="send-spinner"/>:<ArrowUp size={17}/>}</button></div></div></form><div className="composer-caption">Built for curiosity <span>·</span> Powered by your configured model provider</div></div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e=>{void attachFiles(e.target.files);e.currentTarget.value=""}}/>
    </main>
    {firebaseEnabled && !authUser && <div className="auth-overlay"><div className="auth-card"><div className="brand-mark auth-mark"><span>A</span><i /></div><div><h2>Welcome to Akshar AI</h2><p>Sign in to keep your conversations synced to your account.</p></div><button className="google-login" onClick={()=>auth&&void signInWithPopup(auth,googleProvider)}><span className="google-g">G</span> Continue with Google</button><small>Your Firebase sign-in is handled securely by Google.</small></div></div>}
  </div>;
}