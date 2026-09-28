# AlertaCidade — Front-end

Interface web de denúncias urbanas colaborativas em HTML/CSS/JS puro, sem
build ou framework. O front-end usa a API REST Express em `../backend` para
autenticação, usuários, denúncias, comentários, curtidas e notificações.
A única informação de negócio guardada no `LocalStorage` são rascunhos de
denúncia, isolados por usuário.

## Estrutura

```
frontend/
├── index.html
├── css/style.css
└── js/
    ├── api.js       # transporte REST, token Bearer e uploads multipart
    ├── camera.js    # captura de foto/vídeo no dispositivo
    ├── data.js      # adaptador entre modelos da API e modelos da interface
    ├── map.js
    └── ui.js        # renderização e eventos da interface
```

## Como rodar

Inicie o backend em `localhost:3333` (ver `../backend/README.md`) e sirva a
pasta com qualquer servidor estático:

```bash
npx serve frontend
# ou
python3 -m http.server 8080 --directory frontend
```

Por padrão, as chamadas são feitas para `http://localhost:3333/api`. Para
usar outra origem, defina `window.ALERTACIDADE_API_URL` antes de carregar
`js/api.js` no `index.html`. Use uma conta criada na API; não há usuários
de demonstração no navegador.

## Mapa

O seletor usa Leaflet com tiles do OpenStreetMap e não requer chave de API.
Clique no mapa ou arraste o marcador para escolher o ponto; a busca reversa de
endereço usa o serviço Nominatim do OpenStreetMap.

## Funcionalidades

- Cadastro e login; a sessão é restaurada via `/auth/me` usando token Bearer.
- Papéis de cidadão, moderador, admin e super admin controlam a navegação e as ações.
- Denúncias com foto ou vídeo, status, curtidas e comentários em thread.
- Vídeos enviados ou gravados limitados a 3 minutos.
- Notificações e painel administrativo de usuários.
- Rascunho do formulário de denúncia salvo por usuário por até 30 minutos.
- Foto de perfil via arquivo ou câmera.
- Layout responsivo e mapa para selecionar a localização.

## Decisões técnicas

- `api.js` cuida da comunicação HTTP, autorização e envio de arquivos
  multipart. `data.js` normaliza enums e modelos da API para preservar a UI.
- Dados de negócio não são mantidos localmente. Somente o token de sessão e
  rascunhos de denúncia por usuário ficam no `LocalStorage`.
- Fotos e vídeos selecionados ou capturados são enviados como arquivos
  multipart; capturas geradas como data URL são convertidas para Blob/File.
- `#modal-root` fica fora de `#app` para não interromper um stream de câmera
  durante re-renderizações.
