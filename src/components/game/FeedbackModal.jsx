import React, { useState, useEffect } from 'react';
import { mindcaveApi } from '@/api/supabaseClient';
import { playClickSound } from '@/game/sounds';

export default function FeedbackModal({ onClose, user }) {
  const [activeTab, setActiveTab] = useState('bugs'); // 'bugs' | 'improvements' | 'new'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('bug');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const data = await mindcaveApi.entities.CommunityFeedback.list();
      setItems(data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  const handleVote = async (id, e) => {
    e.stopPropagation();
    playClickSound();
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, votes: (it.votes || 0) + 1 } : it))
    );
    await mindcaveApi.entities.CommunityFeedback.upvote(id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    playClickSound();

    const authorName = user?.full_name || user?.email?.split('@')[0] || 'Jogador';
    const userId = user?.id || 'anon';

    try {
      const newItem = await mindcaveApi.entities.CommunityFeedback.create({
        userId,
        userName: authorName,
        type,
        title: title.trim(),
        description: description.trim(),
      });

      setItems((prev) => [newItem, ...prev]);
      setTitle('');
      setDescription('');
      setSuccessMsg('Enviado com sucesso! Obrigado pela contribuição.');
      setTimeout(() => {
        setSuccessMsg('');
        setActiveTab(type === 'bug' ? 'bugs' : 'improvements');
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((it) =>
    activeTab === 'bugs' ? it.type === 'bug' : it.type === 'improvement'
  );

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#2b2b2b] border-2 border-[#1e1e1e] rounded shadow-2xl flex flex-col font-minecraft text-white overflow-hidden">
        {/* Header */}
        <div className="bg-[#1f1f1f] border-b-2 border-[#121212] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-lg text-yellow-400 drop-shadow-[1px_1px_0_#000]">
              Central de Bugs & Sugestões
            </h2>
          </div>
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center bg-[#4a4a4a] hover:bg-[#c93434] border border-[#111] text-white font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#252525] border-b border-[#1a1a1a] p-1 gap-1">
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('bugs');
            }}
            className={`flex-1 py-2 text-xs md:text-sm cursor-pointer transition-all border ${
              activeTab === 'bugs'
                ? 'bg-[#404040] border-[#666] text-red-300 font-bold'
                : 'bg-[#2f2f2f] border-[#222] text-stone-400 hover:bg-[#383838]'
            }`}
          >
            🐛 Bugs ({items.filter((i) => i.type === 'bug').length})
          </button>
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('improvements');
            }}
            className={`flex-1 py-2 text-xs md:text-sm cursor-pointer transition-all border ${
              activeTab === 'improvements'
                ? 'bg-[#404040] border-[#666] text-yellow-300 font-bold'
                : 'bg-[#2f2f2f] border-[#222] text-stone-400 hover:bg-[#383838]'
            }`}
          >
            💡 Sugestões ({items.filter((i) => i.type === 'improvement').length})
          </button>
          <button
            onClick={() => {
              playClickSound();
              setActiveTab('new');
            }}
            className={`flex-1 py-2 text-xs md:text-sm cursor-pointer transition-all border ${
              activeTab === 'new'
                ? 'bg-[#404040] border-[#666] text-green-300 font-bold'
                : 'bg-[#2f2f2f] border-[#222] text-stone-400 hover:bg-[#383838]'
            }`}
          >
            ➕ Novo Relato
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          {activeTab === 'new' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-stone-300 mb-1">Categoria:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="type"
                      value="bug"
                      checked={type === 'bug'}
                      onChange={() => setType('bug')}
                    />
                    <span className="text-red-300">🐛 Bug / Problema no Jogo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="type"
                      value="improvement"
                      checked={type === 'improvement'}
                      onChange={() => setType('improvement')}
                    />
                    <span className="text-yellow-300">💡 Nova Ideia / Melhoria</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-stone-300 mb-1">Título Resumido:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Creeper não deve spawnar na água / Adicionar bloco X"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#181818] border border-[#444] px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs text-stone-300 mb-1">Detalhes / Explicação:</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Explique o que aconteceu, como reproduzir ou como a melhoria deve funcionar..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#181818] border border-[#444] px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400 resize-none font-sans"
                />
              </div>

              {successMsg && (
                <div className="p-2 bg-emerald-900/80 border border-emerald-500 text-emerald-200 text-xs text-center rounded">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#4a6b35] hover:bg-[#5a8040] disabled:bg-stone-700 border-2 border-[#2b401e] text-white text-sm font-bold cursor-pointer transition-all shadow"
              >
                {submitting ? 'Enviando...' : 'Publicar na Central'}
              </button>
            </form>
          ) : (
            <>
              {loading ? (
                <div className="text-center py-12 text-stone-400 text-sm">
                  Carregando relatos da comunidade...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-sm">
                  Nenhum relato encontrado nesta categoria ainda. Seja o primeiro a criar!
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[#1e1e1e] border border-[#333] hover:border-[#555] rounded transition-all flex flex-col md:flex-row gap-3 items-start justify-between"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            item.status === 'resolved'
                              ? 'bg-green-900 text-green-300 border border-green-600'
                              : item.status === 'in_progress'
                              ? 'bg-yellow-900 text-yellow-300 border border-yellow-600'
                              : 'bg-stone-800 text-stone-300 border border-stone-600'
                          }`}
                        >
                          {item.status === 'resolved'
                            ? 'Resolvido'
                            : item.status === 'in_progress'
                            ? 'Em Análise'
                            : 'Aberto'}
                        </span>
                        <h4 className="text-sm font-bold text-yellow-200">{item.title}</h4>
                      </div>
                      <p className="text-xs text-stone-300 font-sans leading-relaxed">
                        {item.description}
                      </p>
                      <div className="text-[10px] text-stone-500">
                        Por <span className="text-stone-400">{item.user_name}</span> em{' '}
                        {new Date(item.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleVote(item.id, e)}
                      title="Votar nesta sugestão ou bug"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d3748] hover:bg-[#3b4a62] border border-[#4a5568] text-xs font-bold rounded cursor-pointer transition-colors shrink-0 self-end md:self-center"
                    >
                      <span className="text-emerald-400">▲</span>
                      <span>{item.votes || 0}</span>
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#1e1e1e] border-t border-[#121212] px-4 py-2 text-right">
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-6 py-1.5 bg-[#404040] hover:bg-[#505050] border border-[#222] text-xs cursor-pointer text-stone-200 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
