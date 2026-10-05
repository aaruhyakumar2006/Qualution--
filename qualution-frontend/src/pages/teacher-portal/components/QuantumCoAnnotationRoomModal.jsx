import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  MessageSquare,
  Bookmark,
  Sparkles,
  Send,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Tag,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Quote
} from 'lucide-react';
import {
  joinCollaborationRoom,
  createRoomAnnotation,
  deleteRoomAnnotation,
  postRoomChatMessage
} from '../api/portalApi';
import { COLLAB_ROOM_STRINGS } from '../constants/portalConstants';
import { supabase } from '../../../lib/supabase';

export default function QuantumCoAnnotationRoomModal({
  isOpen,
  onClose,
  item
}) {
  const [activeTab, setActiveTab] = useState('annotations'); // 'annotations' | 'chat'
  const [roomData, setRoomData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // New annotation form state
  const [showAddAnn, setShowAddAnn] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [paragraphRef, setParagraphRef] = useState('Section 3.1 Hardware Invariants');
  const [annComment, setAnnComment] = useState('');
  const [annTag, setAnnTag] = useState('breakthrough');
  const [isSubmittingAnn, setIsSubmittingAnn] = useState(false);

  // Chat message state
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !item?.id) return;
    loadRoomData();
  }, [isOpen, item?.id]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current?.scrollIntoView) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, roomData?.recent_messages]);

  async function getAuthToken() {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) return data.session.access_token;
    } catch (e) {}
    return localStorage.getItem('token') || 'usr-teacher-prof-ram';
  }

  async function loadRoomData() {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const resp = await joinCollaborationRoom(
        item.id,
        {
          user_id: 'usr-teacher-prof-ram',
          user_name: 'Prof. Ram',
          user_role: 'educator'
        },
        token
      );
      setRoomData(resp);
    } catch (err) {
      console.error('[QuantumCoAnnotationRoomModal] Error loading room:', err);
      setError(err?.message || 'Failed to connect to collaboration room.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddAnnotation(e) {
    e.preventDefault();
    if (!annComment.trim() || !selectedText.trim() || isSubmittingAnn) return;

    setIsSubmittingAnn(true);
    try {
      const token = await getAuthToken();
      const colorMap = {
        breakthrough: '#10B981',
        hardware: '#6366F1',
        math: '#38BDF8',
        pedagogy: '#EC4899',
        question: '#F59E0B'
      };

      const newAnn = await createRoomAnnotation(
        item.id,
        {
          item_id: item.id,
          selected_text: selectedText,
          paragraph_ref: paragraphRef,
          comment: annComment,
          tag: annTag,
          color: colorMap[annTag] || '#10B981'
        },
        token
      );

      setRoomData((prev) => ({
        ...prev,
        annotations: [newAnn, ...(prev?.annotations || [])]
      }));

      setSelectedText('');
      setAnnComment('');
      setShowAddAnn(false);
    } catch (err) {
      console.error('[QuantumCoAnnotationRoomModal] Error adding annotation:', err);
      setError(err?.message || 'Failed to save annotation.');
    } finally {
      setIsSubmittingAnn(false);
    }
  }

  async function handleDeleteAnnotation(annotationId) {
    if (!window.confirm(COLLAB_ROOM_STRINGS.DELETE_ANNOTATION_CONFIRM)) return;
    try {
      const token = await getAuthToken();
      await deleteRoomAnnotation(item.id, annotationId, token);
      setRoomData((prev) => ({
        ...prev,
        annotations: prev.annotations.filter((a) => a.id !== annotationId)
      }));
    } catch (err) {
      console.error('[QuantumCoAnnotationRoomModal] Error deleting annotation:', err);
    }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setIsSendingChat(true);

    try {
      const token = await getAuthToken();
      const msg = await postRoomChatMessage(item.id, messageText, token);
      setRoomData((prev) => ({
        ...prev,
        recent_messages: [...(prev?.recent_messages || []), msg]
      }));
    } catch (err) {
      console.error('[QuantumCoAnnotationRoomModal] Error posting chat:', err);
      setError(err?.message || 'Failed to send message.');
    } finally {
      setIsSendingChat(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      data-testid="collab-room-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collab-room-title"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900/95 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="collab-room-title"
                className="text-lg font-bold tracking-wide text-white flex items-center gap-2"
              >
                {COLLAB_ROOM_STRINGS.MODAL_TITLE}
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xl font-medium">
                {item?.title || 'Quantum Research Signal'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors"
            data-testid="close-collab-room-modal"
            aria-label="Close collaboration room"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Reviewers Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold">{COLLAB_ROOM_STRINGS.ACTIVE_PARTICIPANTS}:</span>
            <div className="flex items-center gap-1.5 ml-2" data-testid="active-participants-list">
              {roomData?.active_participants?.map((user, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200"
                  title={`${user.user_name} (${user.role})`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: user.avatar_color }}
                  />
                  <span>{user.user_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/20 px-6">
          <button
            onClick={() => setActiveTab('annotations')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'annotations'
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-annotations"
          >
            <Bookmark className="w-4 h-4" />
            {COLLAB_ROOM_STRINGS.SHARED_ANNOTATIONS_TAB}
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 font-mono text-[10px]">
              {roomData?.annotations?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'chat'
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-chat"
          >
            <MessageSquare className="w-4 h-4" />
            {COLLAB_ROOM_STRINGS.LIVE_CHAT_TAB}
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 font-mono text-[10px]">
              {roomData?.recent_messages?.length || 0}
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-sm gap-2">
              <Sparkles className="w-6 h-6 animate-spin text-indigo-400" />
              <span>{COLLAB_ROOM_STRINGS.JOINING_ROOM}</span>
            </div>
          ) : activeTab === 'annotations' ? (
            <div className="space-y-4">
              {/* Add Annotation Button / Toggle */}
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  Shared Paragraph Notes ({roomData?.annotations?.length || 0})
                </span>
                <button
                  onClick={() => setShowAddAnn(!showAddAnn)}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                  data-testid="toggle-add-annotation-btn"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {COLLAB_ROOM_STRINGS.ADD_ANNOTATION_BTN}
                </button>
              </div>

              {/* Add Annotation Form */}
              {showAddAnn && (
                <form
                  onSubmit={handleAddAnnotation}
                  className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/40 space-y-3 animate-fade-in"
                  data-testid="add-annotation-form"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                        {COLLAB_ROOM_STRINGS.PARAGRAPH_LABEL}
                      </label>
                      <input
                        type="text"
                        value={paragraphRef}
                        onChange={(e) => setParagraphRef(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                        placeholder="e.g. Section 2.1 Hamiltonian Formulation"
                        data-testid="input-paragraph-ref"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                        Tag Category:
                      </label>
                      <select
                        value={annTag}
                        onChange={(e) => setAnnTag(e.target.value)}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      >
                        <option value="breakthrough">{COLLAB_ROOM_STRINGS.TAG_BREAKTHROUGH}</option>
                        <option value="hardware">{COLLAB_ROOM_STRINGS.TAG_HARDWARE}</option>
                        <option value="math">{COLLAB_ROOM_STRINGS.TAG_MATH}</option>
                        <option value="pedagogy">{COLLAB_ROOM_STRINGS.TAG_PEDAGOGY}</option>
                        <option value="question">{COLLAB_ROOM_STRINGS.TAG_QUESTION}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                      {COLLAB_ROOM_STRINGS.SELECTED_TEXT_LABEL}
                    </label>
                    <textarea
                      value={selectedText}
                      onChange={(e) => setSelectedText(e.target.value)}
                      rows={2}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                      placeholder="Quote exact sentence or equation from preprint..."
                      data-testid="input-selected-text"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-slate-400 block mb-1">
                      {COLLAB_ROOM_STRINGS.COMMENT_LABEL}
                    </label>
                    <textarea
                      value={annComment}
                      onChange={(e) => setAnnComment(e.target.value)}
                      rows={2}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
                      placeholder="Write your research critique or explanation..."
                      data-testid="input-annotation-comment"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddAnn(false)}
                      className="px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedText.trim() || !annComment.trim() || isSubmittingAnn}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold"
                      data-testid="submit-annotation-btn"
                    >
                      {COLLAB_ROOM_STRINGS.POST_ANNOTATION_BTN}
                    </button>
                  </div>
                </form>
              )}

              {/* Annotation Cards List */}
              <div className="space-y-3" data-testid="annotations-container">
                {(!roomData?.annotations || roomData.annotations.length === 0) ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">
                    {COLLAB_ROOM_STRINGS.NO_ANNOTATIONS}
                  </p>
                ) : (
                  roomData.annotations.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 relative group hover:border-indigo-500/30 transition-all"
                      data-testid={`annotation-item-${ann.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                            style={{
                              backgroundColor: `${ann.color}20`,
                              color: ann.color,
                              borderColor: `${ann.color}40`,
                              borderWidth: 1
                            }}
                          >
                            {ann.tag}
                          </span>
                          <span className="text-xs font-semibold text-slate-300">
                            {ann.paragraph_ref}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{ann.user_name}</span>
                          <button
                            onClick={() => handleDeleteAnnotation(ann.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                            title="Delete annotation"
                            data-testid={`delete-ann-${ann.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900/80 border-l-2 border-indigo-400 text-xs text-slate-300 italic flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        <span>"{ann.selected_text}"</span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium pl-1">
                        {ann.comment}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-[400px]">
              {/* Chat Stream Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 p-2 custom-scrollbar" data-testid="chat-messages-container">
                {(!roomData?.recent_messages || roomData.recent_messages.length === 0) ? (
                  <p className="text-xs text-slate-500 italic text-center py-6">
                    {COLLAB_ROOM_STRINGS.NO_MESSAGES}
                  </p>
                ) : (
                  roomData.recent_messages.map((msg, mIdx) => (
                    <div
                      key={msg.id || mIdx}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                        {msg.user_name?.charAt(0) || 'Q'}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-200">{msg.user_name}</span>
                          <span className="text-slate-500">{msg.timestamp?.slice(11, 16) || 'now'}</span>
                        </div>
                        <p className="text-xs text-slate-300">{msg.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendChat} className="flex gap-2 pt-3 border-t border-slate-800">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={COLLAB_ROOM_STRINGS.SEND_CHAT_PLACEHOLDER}
                  className="flex-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
                  data-testid="input-chat-message"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isSendingChat}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/20"
                  data-testid="send-chat-btn"
                >
                  <Send className="w-4 h-4" />
                  {COLLAB_ROOM_STRINGS.SEND_BTN}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
