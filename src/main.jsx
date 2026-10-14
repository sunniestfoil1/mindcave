import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootResourcePacks } from '@/game/resourcePacks'

// Os pacotes de recursos escolhidos entram antes da primeira tela, para widgets e ícones já saírem do pacote certo
bootResourcePacks()
  .catch((e) => console.warn('[Pacotes] falha ao ligar os pacotes escolhidos:', e))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <App />
    )
  })
