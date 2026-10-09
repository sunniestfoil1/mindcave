// Worker de meshing/geração (PRD 23/24): mantém espelho dos chunks (blocos + tinta + luz) e responde a lotes.
// Sempre responde: 'meshed'/'generated' em sucesso ou 'error'/'genError' em falha.
import { MeshMirror, handleMeshMessage } from '../meshCore';

const mirror = new MeshMirror();

self.onmessage = (e) => {
  handleMeshMessage(mirror, e.data, (msg, transfer) => self.postMessage(msg, transfer));
};