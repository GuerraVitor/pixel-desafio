# Pixel Breeders File Manager

Aplicacao web full-stack para gerenciamento de arquivos por usuarios autenticados. O projeto permite criar conta, fazer login, enviar arquivos, listar arquivos enviados, baixar, deletar, visualizar previews de imagens e gerar links temporarios de compartilhamento.

## Stack

- Frontend: React, TypeScript, Vite, TailwindCSS, Axios e React Router.
- Backend: Python, FastAPI, SQLAlchemy e JWT.
- Banco de dados: PostgreSQL.
- Storage de arquivos: MinIO, compativel com S3.
- Cache: Redis.
- Infraestrutura: Docker e Docker Compose.

## Como rodar localmente

Prerequisitos:

- Docker
- Docker Compose

Suba a aplicacao completa com um unico comando:

```bash
docker compose up -d --build
```

Acesse:

- Frontend: http://localhost:5173
- Swagger/API docs: http://localhost:8000/docs
- MinIO Console: http://localhost:9001

Credenciais locais do MinIO:

```text
usuario: minioadmin
senha: minioadmin
```

Para parar os containers:

```bash
docker compose down
```

Para parar e remover volumes locais:

```bash
docker compose down -v
```

## Fluxo principal

1. Acesse `http://localhost:5173`.
2. Crie uma conta em `/register`.
3. Apos o cadastro, voce sera redirecionado para `/dashboard`.
4. Envie um arquivo `.png`, `.jpg`, `.pdf` ou `.txt` de ate 10MB.
5. Veja o arquivo na tabela "Meus Arquivos".
6. Use as acoes da tabela para baixar, deletar ou gerar link temporario.

## Arquitetura

```text
frontend React
   |
   | HTTP/JSON + Bearer Token
   v
backend FastAPI
   |
   | metadata
   v
PostgreSQL
   |
   | cache de GET /files
   v
Redis
   |
   | objetos/arquivos
   v
MinIO
```

O PostgreSQL armazena usuarios e metadados dos arquivos. O MinIO armazena o conteudo binario real dos arquivos. O Redis guarda cache da listagem de arquivos por usuario.

## Estrutura do projeto

```text
.
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── security.py
│   ├── storage.py
│   └── routers/
│       ├── auth.py
│       └── files.py
├── frontend/
│   ├── src/
│   │   ├── auth/
│   │   ├── lib/
│   │   └── pages/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── notes.md
└── README.md
```

## Funcionalidades implementadas

### Autenticacao

- Cadastro com email e senha.
- Login com email e senha.
- Senhas salvas com hash usando Passlib/Bcrypt.
- JWT com expiracao.
- Sessao persistente no frontend com `localStorage`.
- Rotas protegidas com Bearer Token.

Endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/token`
- `GET /auth/me`

### Arquivos

- Upload via formulario no frontend.
- Limite de 10MB.
- Tipos aceitos: `.png`, `.jpg`, `.pdf`, `.txt`.
- Validacao de extensao e MIME type no backend.
- Listagem dos arquivos do usuario autenticado.
- Download apenas dos proprios arquivos.
- Delecao apenas dos proprios arquivos.
- Metadata salva no banco: id, usuario, nome original, chave do storage, MIME type, tamanho, versao, flag de delecao e data.

Endpoints:

- `POST /upload`
- `GET /files`
- `GET /download/{file_id}`
- `DELETE /files/{file_id}`
- `GET /share/{file_id}`

## Bonus implementados

- Upload lido em chunks no backend.
- Download com `StreamingResponse`.
- Links temporarios com presigned URL do MinIO.
- Preview de imagens `.png` e `.jpg` no frontend.
- Versionamento de arquivos por usuario e nome original.
- Cache Redis para `GET /files`.
- Invalidacao de cache em upload e delecao.
- MinIO como storage S3-compatible.
- Docker Compose para subir toda a aplicacao.
- Dockerfile multi-stage no frontend.

## Decisoes tecnicas

### FastAPI

Foi escolhido por ser simples para APIs REST, ter documentacao Swagger automatica, boa integracao com Pydantic e suporte natural a streaming.

### PostgreSQL

Usado para dados relacionais e metadados. Ele guarda usuarios e registros de arquivos, mas nao guarda o conteudo binario dos uploads.

### MinIO

Usado como storage de objetos. O backend nao salva arquivos no filesystem local. O MinIO guarda o arquivo real, enquanto o PostgreSQL guarda a `minio_key`.

### Redis

Usado para cachear a resposta de `GET /files`. A chave do cache inclui o `user_id`, evitando vazamento de dados entre usuarios.

### JWT

JWT foi usado para autenticar chamadas da API. O frontend envia:

```http
Authorization: Bearer <token>
```

O backend valida o token e identifica o usuario atual.

### Soft delete + delecao fisica

Ao deletar um arquivo, a aplicacao remove o objeto do MinIO e marca o registro no banco como `is_deleted=True`. Isso cumpre a delecao fisica no storage e preserva rastreabilidade no banco.

### Versionamento

Se o mesmo usuario envia um arquivo com o mesmo nome, a aplicacao cria uma nova versao:

```text
arquivo.pdf v1
arquivo.pdf v2
arquivo.pdf v3
```

A listagem mostra apenas a versao ativa mais recente.

## Banco de dados

Modelos principais:

### User

- `id`
- `email`
- `password_hash`
- `created_at`

### File

- `id`
- `user_id`
- `original_name`
- `minio_key`
- `mime_type`
- `size`
- `version`
- `is_deleted`
- `created_at`

As tabelas sao criadas automaticamente no startup da aplicacao com `Base.metadata.create_all`. Para um projeto de producao, o ideal seria usar migrations com Alembic.

## Cache

`GET /files` usa Redis com chave:

```text
files:user:{user_id}
```

O cache tem TTL de 5 minutos e e invalidado em:

- upload de arquivo;
- delecao de arquivo.

## Testes manuais recomendados

### Autenticacao

1. Criar usuario pelo frontend.
2. Fazer logout.
3. Fazer login.
4. Recarregar a pagina e verificar se a sessao persiste.

### Upload

1. Enviar `.txt`, `.pdf`, `.png` ou `.jpg`.
2. Verificar barra de progresso.
3. Tentar enviar arquivo acima de 10MB.
4. Tentar enviar extensao nao permitida.

### Listagem e versionamento

1. Enviar `arquivo.txt`.
2. Enviar outro `arquivo.txt`.
3. Confirmar que a tabela mostra a versao mais recente.
4. Conferir no banco que existem registros com versoes diferentes.

### Download

1. Clicar no botao de download.
2. Verificar se o arquivo baixado abre corretamente.

### Delete

1. Deletar um arquivo pela UI.
2. Confirmar que ele some da tabela.
3. Conferir no banco que `is_deleted=True`.
4. Conferir no MinIO que o objeto foi removido.

### Link temporario

1. Clicar em gerar link.
2. Abrir o link em uma nova aba.
3. Confirmar que o arquivo e acessivel ate o tempo de expiracao.

## Comandos uteis

Ver logs do backend:

```bash
docker compose logs -f backend
```

Ver logs do frontend:

```bash
docker compose logs -f frontend
```

Acessar PostgreSQL:

```bash
docker compose exec postgres psql -U pixel -d pixel_breeders
```

Consultar arquivos:

```sql
SELECT id, user_id, original_name, minio_key, mime_type, size, version, is_deleted, created_at
FROM files
ORDER BY created_at DESC;
```

Acessar Redis:

```bash
docker compose exec redis redis-cli
```

Listar chaves de cache:

```text
KEYS files:user:*
```

## Funcionalidades nao implementadas ou limitacoes

- Nao ha tela para visualizar historico completo de versoes. O historico existe no banco, mas a UI mostra somente a versao ativa mais recente.
- Nao ha suite automatizada de testes. A validacao foi feita manualmente via Swagger, frontend e comandos Docker.
- Nao ha Alembic/migrations. As tabelas sao criadas automaticamente no startup para simplificar a execucao local.
- O upload e lido em chunks e limitado a 10MB, mas o conteudo e bufferizado em memoria antes do envio ao MinIO.
- O deploy em cloud/publico nao foi realizado; a aplicacao esta pronta para execucao local via Docker Compose.

## Uso de IA

Ferramentas de IA foram usadas de forma relevante durante o desenvolvimento para auxiliar na estruturacao incremental do projeto, revisao de erros, geracao de codigo inicial, documentacao e explicacao das decisoes tecnicas.

## Status geral

Obrigatorios implementados:

- autenticacao;
- upload;
- listagem;
- download;
- delecao;
- isolamento por usuario;
- persistencia de metadata;
- frontend React;
- backend FastAPI;
- Docker Compose.

Bonus implementados:

- streaming no download;
- leitura de upload em chunks;
- links com expiracao;
- preview de imagens;
- versionamento;
- cache Redis;
- MinIO;
- Docker.
