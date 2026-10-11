// Biblioteca de assets: lista, busca, upload — PRD 10 RF-002, RF-010..011
import React, { useState, useEffect, useCallback } from "react";
import { Upload, Search, Trash2, FileBox, Image, Music, Package } from "lucide-react";
import { uploadAsset, listAssets, deleteAsset } from "@/studio/assetStore";

const TYPE_ICONS = { model: FileBox, texture: Image, audio: Music, package: Package, skin: Image };
const TYPE_LABELS = { model: 'Modelo', texture: 'Textura', audio: 'Áudio', package: 'Pacote', skin: 'Skin' };

export default function AssetLibrary({ user, selectedAsset, onSelect, onUploadComplete }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listAssets({ type: filterType || undefined, search: search || undefined });
    setAssets(list);
    setLoading(false);
  }, [filterType, search]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFiles = useCallback(async (files) => {
    if (!user) return;
    setUploading(true);
    for (const file of files) {
      setUploadProgress(`Enviando ${file.name}...`);
      try {
        const asset = await uploadAsset(file, user, { license: 'Autoral' });
        if (onUploadComplete) onUploadComplete(asset);
      } catch (e) {
        console.error('Upload error:', e);
        setUploadProgress(`Erro: ${e.message}`);
      }
    }
    setUploadProgress('');
    setUploading(false);
    refresh();
  }, [user, onUploadComplete, refresh]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleDelete = async (asset) => {
    if (!confirm(`Excluir asset "${asset.name}"?`)) return;
    await deleteAsset(asset.id);
    refresh();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={"border-2 border-dashed rounded-lg p-3 mb-3 text-center cursor-pointer transition-colors " +
          (dragOver ? "border-blue-400 bg-blue-400/10" : "border-stone-600 hover:border-stone-500")}
        onClick={() => document.getElementById('studio-file-input')?.click()}
      >
        <Upload className="w-5 h-5 mx-auto mb-1 text-stone-400" />
        <p className="text-xs text-stone-400">Arrastar arquivos ou clicar</p>
        <input
          id="studio-file-input"
          type="file"
          multiple
          className="hidden"
          accept=".glb,.gltf,.png,.webp,.ogg,.mp3,.wav"
          onChange={(e) => { if (e.target.files?.length) handleFiles(Array.from(e.target.files)); e.target.value = ''; }}
        />
      </div>

      {uploading && (
        <div className="text-xs text-blue-400 mb-2 px-1">{uploadProgress || 'Enviando...'}</div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-stone-900 text-white rounded border border-stone-700 outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1 text-xs bg-stone-900 text-white rounded border border-stone-700 outline-none"
        >
          <option value="">Todos</option>
          <option value="model">Modelos</option>
          <option value="texture">Texturas</option>
          <option value="audio">Áudio</option>
        </select>
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && <p className="text-xs text-stone-500 text-center py-4">Carregando...</p>}
        {!loading && assets.length === 0 && (
          <p className="text-xs text-stone-500 text-center py-4">Nenhum asset enviado.</p>
        )}
        {assets.map((asset) => {
          const Icon = TYPE_ICONS[asset.type] || FileBox;
          const meta = asset.metadata ? JSON.parse(asset.metadata) : {};
          const isSelected = selectedAsset?.id === asset.id;
          return (
            <div
              key={asset.id}
              onClick={() => onSelect?.(asset)}
              className={"flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors " +
                (isSelected ? "bg-blue-600 text-white" : "hover:bg-stone-700 text-stone-300")}
            >
              <Icon className="w-4 h-4 shrink-0 opacity-70" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{asset.name}</div>
                <div className="text-[10px] opacity-60">
                  {TYPE_LABELS[asset.type] || asset.type} · {formatSize(asset.size)}
                  {meta.triangles ? ` · ${meta.triangles} tris` : ''}
                  {meta.clips?.length ? ` · ${meta.clips.length} anims` : ''}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                className={"p-1 rounded hover:bg-red-600/50 " + (isSelected ? "text-white/70" : "text-stone-500")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}