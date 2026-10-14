import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootResourcePacks } from '@/game/resourcePacks'
import { loadMcFont } from '@/game/gui/font'

// Os pacotes de recursos escolhidos entram antes da primeira tela, para widgets e ícones já saírem do pacote certo;
// a fonte bitmap vem logo depois deles (um pacote pode trazer a própria ascii.png), também antes do primeiro texto
bootResourcePacks()
  .catch((e) => console.warn('[Pacotes] falha ao ligar os pacotes escolhidos:', e))
  .then(() => loadMcFont())
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <App />
    )
  })
