# Pixel Breeders File Manager - Notes de Estudo

Este arquivo e o caderno tecnico do projeto. A cada passo implementado, ele deve ser atualizado com:

- o que foi construido;
- quais bibliotecas, frameworks e ferramentas foram usados;
- por que cada decisao tecnica foi tomada;
- como testar a etapa;
- conceitos teoricos envolvidos;
- detalhes praticos de como o codigo funciona.

## Visao Geral do Projeto

O Pixel Breeders File Manager e uma aplicacao full-stack para gerenciamento de arquivos por usuario. A aplicacao tera cadastro, login, upload, download, delecao, versionamento de arquivos, links temporarios, cache e frontend web.

A stack definida e:

- Backend: FastAPI com Python.
- Frontend: React, TypeScript, Vite e TailwindCSS.
- Banco de dados: PostgreSQL.
- Storage de arquivos: MinIO, compativel com S3.
- Cache: Redis.
- Infraestrutura local: Docker e Docker Compose.

A ideia arquitetural e separar responsabilidades:

- PostgreSQL guarda dados estruturados, como usuarios e metadados dos arquivos.
- MinIO guarda o conteudo binario real dos arquivos.
- Redis guarda dados temporarios e cache.
- FastAPI expoe a API HTTP.
- React consome a API e fornece a interface de usuario.

## Passo 1 - Infraestrutura e Backend Base

### O que foi implementado

Foram criados:

- `docker-compose.yml`, orquestrando os containers principais.
- `backend/Dockerfile`, definindo como construir a imagem do backend.
- `backend/requirements.txt`, listando dependencias Python.
- `backend/main.py`, criando a aplicacao FastAPI inicial.

O objetivo do Passo 1 foi permitir que a API subisse localmente com:

```bash
docker compose up -d --build postgres redis minio backend
```

Depois disso, o Swagger deve estar disponivel em:

```text
http://localhost:8000/docs
```

### Docker

Docker permite empacotar aplicacoes e dependencias em containers.

Neste projeto, usamos um container para cada servico:

- `postgres`: banco relacional.
- `redis`: cache em memoria.
- `minio`: storage de arquivos.
- `backend`: API FastAPI.
- `frontend`: reservado para o frontend, que sera concluido em etapa futura.

### Docker Compose

Docker Compose e usado para declarar varios containers em um unico arquivo YAML. Em vez de iniciar container por container manualmente, declaramos servicos, portas, variaveis de ambiente, volumes e dependencias em `docker-compose.yml`.

Exemplo conceitual:

```yaml
services:
  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
```

Isso diz que o servico `backend` sera construido a partir da pasta `./backend` e vai expor a porta `8000`.

### PostgreSQL

PostgreSQL e o banco de dados relacional do projeto.

Ele sera usado para armazenar:

- usuarios;
- senhas com hash;
- metadados dos arquivos;
- versoes dos arquivos;
- flags como `is_deleted`.

No Compose:

```yaml
POSTGRES_DB: pixel_breeders
POSTGRES_USER: pixel
POSTGRES_PASSWORD: pixel
```

Essas variaveis criam o banco inicial e o usuario de desenvolvimento.

A porta:

```yaml
"5432:5432"
```

expoe o PostgreSQL localmente na porta padrao `5432`.

### Redis

Redis e um banco em memoria, muito usado como cache.

Neste projeto, ele sera usado em passo futuro para cachear a listagem de arquivos do usuario:

```text
GET /files
```

Cache significa guardar temporariamente uma resposta pronta para evitar trabalho repetido. Por exemplo: se o usuario chama a listagem duas vezes seguidas e nada mudou, podemos devolver a resposta do Redis em vez de consultar o PostgreSQL novamente.

No Compose, o Redis esta exposto em:

```yaml
"6379:6379"
```

### MinIO

MinIO e um storage de objetos compativel com a API do Amazon S3.

Storage de objetos e diferente de banco relacional. Ele e ideal para guardar arquivos binarios, como:

- imagens;
- PDFs;
- textos;
- uploads em geral.

Neste projeto, o backend nao deve salvar arquivos no filesystem local. O arquivo real vai para o MinIO, e o PostgreSQL guarda apenas metadados, como nome, tamanho, tipo MIME e chave do objeto.

Portas:

- `9000`: API S3 usada pelo backend.
- `9001`: painel web do MinIO.

Credenciais locais:

```text
usuario: minioadmin
senha: minioadmin
```

### Volumes

Volumes Docker persistem dados mesmo se o container for removido.

No projeto:

- `postgres_data`: guarda dados do PostgreSQL.
- `redis_data`: guarda dados persistidos do Redis.
- `minio_data`: guarda arquivos enviados ao MinIO.

Sem volumes, os dados poderiam ser perdidos ao recriar containers.

### Healthcheck

Healthcheck e uma verificacao feita pelo Docker para saber se um servico esta pronto.

Exemplo:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U pixel -d pixel_breeders"]
```

Isso evita que o backend tente iniciar antes do banco estar aceitando conexoes.

### FastAPI

FastAPI e um framework Python para criar APIs HTTP.

Vantagens:

- rapido;
- baseado em type hints do Python;
- gera documentacao Swagger automaticamente;
- integra bem com Pydantic;
- suporta async e streaming, importantes para upload/download.

No `main.py`, a aplicacao e criada com:

```python
app = FastAPI(...)
```

Rotas sao criadas com decorators:

```python
@app.get("/health")
def health_check():
    return {"status": "ok"}
```

### Uvicorn

Uvicorn e o servidor ASGI usado para rodar FastAPI.

No Dockerfile, o comando final e:

```dockerfile
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

Isso significa:

- `main:app`: arquivo `main.py`, variavel `app`.
- `--host 0.0.0.0`: permite acesso de fora do container.
- `--port 8000`: porta da API.
- `--reload`: reinicia automaticamente quando arquivos mudam, util em desenvolvimento.

### CORS

CORS significa Cross-Origin Resource Sharing.

Quando o frontend roda em uma porta diferente da API, por exemplo:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8000`

o navegador considera que sao origens diferentes. Para permitir que o frontend chame a API, configuramos CORS no backend:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Passo 2 - Banco de Dados e Autenticacao

### O que foi implementado

Foram criados/modificados:

- `backend/config.py`
- `backend/database.py`
- `backend/models.py`
- `backend/schemas.py`
- `backend/security.py`
- `backend/routers/auth.py`
- `backend/main.py`
- `backend/requirements.txt`

Funcionalidades entregues:

- configuracao centralizada por variaveis de ambiente;
- conexao SQLAlchemy com PostgreSQL;
- modelos `User` e `File`;
- cadastro de usuario;
- login de usuario;
- geracao de JWT;
- validacao de Bearer Token;
- rota protegida `GET /auth/me`.

### Configuracao com Pydantic Settings

O arquivo `backend/config.py` centraliza configuracoes da aplicacao.

Foi usada a biblioteca:

```text
pydantic-settings
```

Ela permite declarar uma classe com os campos esperados:

```python
class Settings(BaseSettings):
    database_url: str
    redis_url: str
    jwt_secret_key: str
```

Esses valores podem vir de variaveis de ambiente, como no `docker-compose.yml`:

```yaml
DATABASE_URL: postgresql+psycopg2://pixel:pixel@postgres:5432/pixel_breeders
```

Vantagens:

- evita espalhar strings de configuracao pelo codigo;
- facilita trocar configuracoes entre desenvolvimento e producao;
- permite validar tipos, como `int`, `bool` e `str`.

### SQLAlchemy

SQLAlchemy e uma biblioteca Python para trabalhar com banco de dados relacional.

Ela pode ser usada de duas formas principais:

- SQL Expression Language: criando queries mais proximas de SQL.
- ORM: mapeando classes Python para tabelas do banco.

Neste projeto usamos ORM.

ORM significa Object-Relational Mapping. A ideia e representar tabelas como classes Python.

Exemplo:

```python
class User(Base):
    __tablename__ = "users"

    id = mapped_column(...)
    email = mapped_column(...)
```

Essa classe representa uma tabela chamada `users`.

### Engine

No `backend/database.py`, criamos:

```python
engine = create_engine(settings.database_url, pool_pre_ping=True)
```

`engine` e o objeto central de conexao com o banco.

Ele sabe:

- qual banco usar;
- qual driver usar;
- host;
- usuario;
- senha;
- database.

`pool_pre_ping=True` ajuda a evitar erro com conexoes antigas ou derrubadas, porque o SQLAlchemy testa a conexao antes de reutiliza-la.

### Session

Tambem criamos:

```python
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
```

Session e a unidade de trabalho com o banco. Ela e usada para:

- buscar registros;
- adicionar objetos;
- fazer commit;
- fazer rollback;
- fechar conexao.

No FastAPI, criamos uma dependencia:

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

Isso garante que cada requisicao receba uma sessao e que ela seja fechada no final.

### Declarative Base

Em SQLAlchemy moderno, usamos:

```python
class Base(DeclarativeBase):
    pass
```

Todos os modelos herdam de `Base`. Assim, o SQLAlchemy conhece todas as tabelas mapeadas.

No startup da aplicacao:

```python
Base.metadata.create_all(bind=engine)
```

Isso cria as tabelas que ainda nao existem.

Observacao: para projetos maiores, o ideal e usar Alembic para migrations. Nesta etapa, `create_all` e suficiente porque o foco e deixar cada passo testavel isoladamente.

### Modelo User

O modelo `User` representa usuarios da aplicacao.

Campos:

- `id`: identificador unico em UUID.
- `email`: email unico, usado para login.
- `password_hash`: senha protegida por hash.
- `created_at`: data de criacao.

Conceitos importantes:

- Nunca salvar senha em texto puro.
- Email tem indice e constraint unica para evitar duplicidade.
- UUID evita expor IDs sequenciais simples.

### Modelo File

O modelo `File` representa metadados de arquivos.

Campos:

- `id`: identificador unico do registro.
- `user_id`: dono do arquivo.
- `original_name`: nome original enviado pelo usuario.
- `minio_key`: chave do objeto no MinIO.
- `mime_type`: tipo do arquivo, como `image/png` ou `application/pdf`.
- `size`: tamanho em bytes.
- `version`: versao do arquivo.
- `is_deleted`: flag para exclusao logica.
- `created_at`: data de upload/criacao.

O conteudo real do arquivo nao fica no PostgreSQL. Ele ficara no MinIO.

### Relacionamento User -> File

Um usuario pode ter muitos arquivos.

No SQLAlchemy:

```python
files = relationship(back_populates="user")
```

No `File`:

```python
user = relationship(back_populates="files")
```

Esse relacionamento permite navegar entre usuario e arquivos no codigo Python.

### Constraint de versionamento

No modelo `File`, existe uma constraint:

```python
UniqueConstraint("user_id", "original_name", "version", name="uq_user_file_version")
```

Ela impede que o mesmo usuario tenha duas linhas com o mesmo nome original e a mesma versao.

Exemplo valido:

```text
user_id=1, original_name=contrato.pdf, version=1
user_id=1, original_name=contrato.pdf, version=2
```

Exemplo invalido:

```text
user_id=1, original_name=contrato.pdf, version=1
user_id=1, original_name=contrato.pdf, version=1
```

### Schemas Pydantic

O arquivo `backend/schemas.py` define schemas de entrada e saida da API.

Pydantic valida dados automaticamente.

Exemplo:

```python
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
```

Isso garante:

- email valido;
- senha com no minimo 8 caracteres;
- senha com no maximo 128 caracteres.

Se o usuario enviar dados invalidos, FastAPI retorna `422 Validation Error`.

### EmailStr e email-validator

`EmailStr` e um tipo do Pydantic para validar email.

Para funcionar, ele precisa da biblioteca:

```text
email-validator
```

Por isso ela foi adicionada ao `requirements.txt`.

### Hash de Senha

Senha nao deve ser salva em texto puro.

Em vez disso, salvamos um hash:

```python
password_hash = hash_password(payload.password)
```

Hash e uma transformacao de mao unica. A aplicacao consegue verificar se uma senha bate com o hash, mas nao deve conseguir recuperar a senha original.

Bibliotecas usadas:

- `passlib`: interface para hashing de senhas.
- `bcrypt`: algoritmo/backend de hash.

Configuracao:

```python
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
```

### Por que bcrypt foi fixado em 4.0.1

Durante o teste do cadastro, ocorreu erro `500` no endpoint:

```text
POST /auth/register
```

O traceback mostrou que o problema acontecia em:

```python
password_context.hash(password)
```

A causa foi incompatibilidade entre:

```text
passlib==1.7.4
```

e versoes novas do pacote:

```text
bcrypt
```

Mesmo com senha curta, o `passlib` executa verificacoes internas usando entradas maiores, e a versao nova do `bcrypt` pode levantar:

```text
ValueError: password cannot be longer than 72 bytes
```

Para estabilizar o ambiente, fixamos:

```text
bcrypt==4.0.1
```

Depois de alterar dependencias, e necessario reconstruir a imagem:

```bash
docker compose down
docker compose build --no-cache backend
docker compose up -d postgres redis minio backend
```

### JWT

JWT significa JSON Web Token.

Ele e um token assinado que carrega informacoes em JSON.

No projeto, o token carrega o `sub`, que significa subject. Aqui, `sub` e o `id` do usuario.

Exemplo conceitual de payload:

```json
{
  "sub": "id-do-usuario",
  "exp": "data-de-expiracao"
}
```

O backend assina o token usando:

```text
JWT_SECRET_KEY
```

e algoritmo:

```text
HS256
```

### Criacao do token

No `backend/security.py`:

```python
def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    expires_at = datetime.now(timezone.utc) + (...)
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
```

O token expira depois do tempo configurado em:

```text
ACCESS_TOKEN_EXPIRE_MINUTES
```

No ambiente local, esta configurado como:

```text
60 minutos
```

### Bearer Token

Bearer Token e uma forma comum de autenticar chamadas HTTP.

O cliente envia o token no header:

```http
Authorization: Bearer SEU_TOKEN
```

O backend le esse header, valida o JWT e identifica o usuario.

### Dependencia de usuario autenticado

No `backend/security.py`, existe:

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
```

Isso ensina o FastAPI a procurar o token Bearer no header `Authorization`.

Depois:

```python
def get_current_user(db: DbSession, token: str = Depends(oauth2_scheme)) -> User:
```

Essa funcao:

1. recebe o token;
2. decodifica o JWT;
3. pega o `sub`;
4. busca o usuario no banco;
5. retorna o usuario se tudo estiver valido;
6. retorna `401` se algo estiver errado.

Essa funcao sera reaproveitada em rotas futuras para garantir isolamento por usuario.

### Rotas de autenticacao

As rotas ficam em:

```text
backend/routers/auth.py
```

Foi usado:

```python
router = APIRouter(prefix="/auth", tags=["auth"])
```

Isso significa que todas as rotas desse arquivo comecam com `/auth`.

#### POST /auth/register

Cria um usuario.

Entrada:

```json
{
  "email": "user@example.com",
  "password": "stringst"
}
```

Fluxo:

1. valida o payload com Pydantic;
2. normaliza email para lowercase;
3. gera hash da senha;
4. cria objeto `User`;
5. adiciona na sessao do banco;
6. executa `commit`;
7. retorna JWT e dados do usuario.

Se email ja existir, retorna:

```text
409 Conflict
```

#### POST /auth/login

Autentica usuario com JSON.

Entrada:

```json
{
  "email": "user@example.com",
  "password": "stringst"
}
```

Fluxo:

1. busca usuario pelo email;
2. verifica senha com bcrypt/passlib;
3. se valido, retorna JWT;
4. se invalido, retorna `401 Unauthorized`.

Essa rota e pratica para o frontend React.

#### POST /auth/token

Autentica usuario usando formulario OAuth2.

Essa rota existe para compatibilidade com o fluxo do Swagger/FastAPI.

Ela recebe:

- `username`
- `password`

Mesmo usando o campo `username`, no nosso caso ele representa o email.

#### GET /auth/me

Rota protegida para testar autenticao.

Ela exige:

```http
Authorization: Bearer SEU_TOKEN
```

Se o token for valido, retorna:

```json
{
  "id": "...",
  "email": "user@example.com",
  "created_at": "..."
}
```

Se nao houver token ou ele for invalido, retorna:

```text
401 Unauthorized
```

### Codigos HTTP usados

Principais status desta etapa:

- `201 Created`: usuario criado com sucesso.
- `200 OK`: login ou consulta realizada com sucesso.
- `401 Unauthorized`: credenciais invalidas ou token ausente/invalido.
- `409 Conflict`: email ja cadastrado.
- `422 Validation Error`: payload invalido.
- `500 Internal Server Error`: erro nao tratado no backend.

### Como testar o Passo 2

Subir servicos:

```bash
docker compose up -d --build postgres redis minio backend
```

Abrir Swagger:

```text
http://localhost:8000/docs
```

Criar usuario:

```text
POST /auth/register
```

Payload:

```json
{
  "email": "user@example.com",
  "password": "stringst"
}
```

Fazer login:

```text
POST /auth/login
```

Copiar `access_token`.

No Swagger, clicar em `Authorize` e preencher:

```text
Bearer SEU_TOKEN
```

Testar:

```text
GET /auth/me
```

Resultado esperado:

- com token valido: `200`;
- sem token: `401`.

### Como ler logs do backend

Quando o Swagger mostra apenas:

```text
500 Internal Server Error
```

o detalhe real fica nos logs do container:

```bash
docker compose logs --tail=200 backend
```

Para acompanhar em tempo real:

```bash
docker compose logs -f backend
```

Esse foi o metodo usado para encontrar a causa real do erro no hash da senha.

## Politica para proximos passos

A partir daqui, todo passo implementado deve atualizar este arquivo.

Formato recomendado para cada nova etapa:

1. O que foi implementado.
2. Arquivos criados/modificados.
3. Bibliotecas e frameworks usados.
4. Conceitos teoricos.
5. Fluxo pratico da funcionalidade.
6. Como testar.
7. Erros encontrados e como foram resolvidos.

## Passo 3 - Integracao MinIO e Upload/Download

### O que foi implementado

Neste passo foram implementadas as funcionalidades de armazenamento de arquivos:

- configuracao centralizada do cliente MinIO/S3;
- upload autenticado em `POST /upload`;
- validacao de extensao e tipo MIME;
- limite de tamanho de 10MB;
- leitura do upload em chunks;
- registro dos metadados no PostgreSQL usando o modelo `File`;
- versionamento automatico quando o mesmo usuario envia arquivo com o mesmo nome;
- download protegido em `GET /download/{file_id}` usando `StreamingResponse`;
- link temporario em `GET /share/{file_id}` usando presigned URL do MinIO.

Arquivos criados/modificados:

- `backend/storage.py`
- `backend/routers/files.py`
- `backend/schemas.py`
- `backend/main.py`

Importante: este passo nao implementa listagem de arquivos, cache Redis ou delete. Essas funcionalidades pertencem ao Passo 4.

### Por que o conteudo do arquivo vai para o MinIO

Arquivos binarios nao devem ser salvos diretamente no PostgreSQL neste projeto.

O PostgreSQL e excelente para dados estruturados:

- usuarios;
- nomes de arquivos;
- tamanhos;
- tipos MIME;
- versoes;
- dono do arquivo;
- datas.

Mas o conteudo real do arquivo pode ser grande e e melhor armazenado em um storage de objetos, como MinIO ou S3.

Por isso o fluxo escolhido e:

1. O usuario envia o arquivo para a API.
2. A API valida o arquivo.
3. A API envia o conteudo binario para o MinIO.
4. A API salva no PostgreSQL apenas os metadados e a chave do objeto no MinIO.

Essa chave e o campo:

```text
minio_key
```

Ela funciona como o "caminho" do objeto dentro do bucket.

### S3 e MinIO

S3 e um servico da AWS para armazenamento de objetos.

MinIO e uma alternativa open-source compativel com a API do S3. Isso significa que bibliotecas feitas para S3, como `boto3`, tambem conseguem conversar com MinIO.

Conceitos principais:

- Bucket: recipiente onde objetos sao guardados.
- Object: arquivo armazenado.
- Key: identificador unico do objeto dentro do bucket.
- Content-Type: tipo MIME do objeto, como `text/plain` ou `image/png`.

No projeto, o bucket configurado e:

```text
pixel-files
```

### boto3

`boto3` e a biblioteca oficial da AWS para Python.

Mesmo usando MinIO, utilizamos `boto3` porque MinIO entende a API S3.

No arquivo `backend/storage.py`, criamos clientes S3:

```python
minio_client = create_minio_client(settings.minio_endpoint)
public_minio_client = create_minio_client(settings.minio_public_endpoint)
```

Existem dois clientes por um motivo pratico:

- `minio_client`: usado dentro da rede Docker, apontando para `minio:9000`.
- `public_minio_client`: usado para gerar links que o navegador da maquina host consiga abrir, apontando para `localhost:9000`.

Dentro do container backend, `minio:9000` funciona porque `minio` e o nome do servico na rede Docker.

Fora do Docker, no navegador, `minio:9000` nao resolve. Por isso presigned URLs precisam usar `localhost:9000`.

### Dependency Injection do FastAPI para MinIO

No `storage.py`, tambem criamos dependencias:

```python
def get_minio():
    return minio_client
```

e:

```python
MinioClient = Annotated[object, Depends(get_minio)]
```

Isso permite declarar nas rotas:

```python
storage: MinioClient
```

O FastAPI injeta o cliente automaticamente.

Esse mesmo padrao ja tinha sido usado com banco de dados e usuario autenticado.

### Router de arquivos

As rotas de arquivos ficam em:

```text
backend/routers/files.py
```

Foi criado:

```python
router = APIRouter(tags=["files"])
```

Como nao ha `prefix`, as rotas seguem exatamente o plano:

- `POST /upload`
- `GET /download/{file_id}`
- `GET /share/{file_id}`

Todas essas rotas exigem autenticacao.

### Autenticacao nas rotas de arquivos

No router de arquivos, foi criado:

```python
CurrentUser = Annotated[User, Depends(get_current_user)]
```

Cada rota recebe:

```python
current_user: CurrentUser
```

Isso significa que:

1. a requisicao precisa enviar header `Authorization`;
2. o token precisa ser valido;
3. o usuario precisa existir no banco;
4. a rota recebe o objeto `User` autenticado.

Esse padrao garante isolamento por usuario.

### Validacao de tipo de arquivo

O projeto aceita apenas:

```text
.png
.jpg
.pdf
.txt
```

Essa regra foi implementada com:

```python
ALLOWED_EXTENSIONS = {".png", ".jpg", ".pdf", ".txt"}
```

Tambem validamos o MIME type esperado:

```python
ALLOWED_MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
}
```

Extensao e MIME type sao coisas diferentes:

- extensao e o final do nome do arquivo, como `.pdf`;
- MIME type e o tipo declarado do conteudo, como `application/pdf`.

Validar os dois reduz erros acidentais e alguns abusos simples.

### Sanitizacao do nome do arquivo

O nome do arquivo enviado pelo usuario passa por:

```python
Path(filename).name.strip()
```

Isso remove caminhos e mantem apenas o nome final.

Exemplo:

```text
../../segredo.txt
```

vira:

```text
segredo.txt
```

Esse cuidado evita que nomes de arquivos sejam tratados como caminhos.

### Limite de 10MB

O limite foi definido assim:

```python
MAX_FILE_SIZE = 10 * 1024 * 1024
```

Isso equivale a 10 megabytes em bytes.

Durante a leitura do upload, somamos o tamanho dos chunks:

```python
total_size += len(chunk)
```

Se passar de 10MB, a API retorna:

```text
413 Request Entity Too Large
```

### Upload em chunks

Chunk e um pedaco do arquivo.

Em vez de chamar uma leitura unica do arquivo inteiro, o backend le partes:

```python
CHUNK_SIZE = 1024 * 1024
```

Ou seja, 1MB por vez.

Fluxo:

1. cria um `BytesIO`;
2. le 1MB do upload;
3. soma no tamanho total;
4. verifica se passou de 10MB;
5. escreve o chunk no buffer;
6. repete ate o arquivo acabar;
7. volta o ponteiro do buffer para o inicio com `seek(0)`.

`BytesIO` e um arquivo em memoria. Como o limite e 10MB, manter esse buffer em memoria e aceitavel nesta etapa e evita gravar arquivo no filesystem local do backend.

### upload_fileobj

Depois de ler e validar o arquivo, usamos:

```python
storage.upload_fileobj(
    file_buffer,
    settings.minio_bucket,
    minio_key,
    ExtraArgs={"ContentType": mime_type},
)
```

`upload_fileobj` envia um objeto semelhante a arquivo para o S3/MinIO.

Parametros:

- `file_buffer`: conteudo do arquivo.
- `settings.minio_bucket`: nome do bucket.
- `minio_key`: chave do objeto.
- `ExtraArgs`: metadados extras, como `ContentType`.

### Geracao da minio_key

A chave do objeto e gerada assim:

```python
minio_key = f"users/{current_user.id}/{uuid4().hex}_v{version}{extension}"
```

Exemplo:

```text
users/abc-123/0f9c..._v2.txt
```

Essa estrutura ajuda a:

- separar arquivos por usuario;
- evitar colisao de nomes com UUID;
- manter a versao visivel na chave;
- preservar a extensao original.

Mesmo que dois usuarios enviem `contrato.pdf`, as chaves serao diferentes.

### Versionamento

Versionamento significa manter historico quando o usuario envia um arquivo com o mesmo nome.

Exemplo:

```text
contrato.pdf -> version 1
contrato.pdf -> version 2
contrato.pdf -> version 3
```

Para calcular a proxima versao:

```python
select(func.max(FileModel.version)).where(
    FileModel.user_id == user_id,
    FileModel.original_name == original_name,
)
```

Ou seja:

1. procura a maior versao daquele nome para aquele usuario;
2. se nao existir, comeca em 1;
3. se existir, soma 1.

Isso e feito por usuario. Arquivos de usuarios diferentes nao interferem entre si.

### Registro no PostgreSQL

Depois que o arquivo e enviado ao MinIO, criamos o registro:

```python
stored_file = FileModel(
    user_id=current_user.id,
    original_name=original_name,
    minio_key=minio_key,
    mime_type=mime_type,
    size=total_size,
    version=version,
)
```

O PostgreSQL guarda os metadados.

Campos importantes:

- `user_id`: dono do arquivo.
- `original_name`: nome que o usuario enviou.
- `minio_key`: onde esta o arquivo no MinIO.
- `mime_type`: tipo do arquivo.
- `size`: tamanho em bytes.
- `version`: versao calculada.

### Ordem upload -> DB

Neste passo, o fluxo escolhido foi:

1. enviar arquivo para MinIO;
2. salvar metadados no banco.

Se o upload para MinIO falha, nada e salvo no banco.

Se o upload funciona mas o banco falha, tentamos remover o objeto do MinIO:

```python
storage.delete_object(Bucket=settings.minio_bucket, Key=minio_key)
```

Isso reduz o risco de deixar arquivo orfao no storage.

Arquivo orfao seria um arquivo existente no MinIO sem registro correspondente no PostgreSQL.

### Schema FileRead

Foi criado em `schemas.py`:

```python
class FileRead(BaseModel):
    id: str
    original_name: str
    mime_type: str
    size: int
    version: int
    created_at: datetime
```

Esse schema define a resposta do upload.

Ele nao retorna `minio_key`, porque essa chave e detalhe interno do backend. O usuario nao precisa saber como o arquivo esta salvo no storage.

### Download com StreamingResponse

Download foi implementado com:

```python
@router.get("/download/{file_id}")
```

Primeiro, a API busca o arquivo garantindo que:

- o `id` bate;
- o `user_id` e do usuario autenticado;
- `is_deleted` e falso.

Depois, busca o objeto no MinIO:

```python
storage.get_object(Bucket=settings.minio_bucket, Key=stored_file.minio_key)
```

O retorno do MinIO contem um corpo de streaming.

Para responder ao cliente, usamos:

```python
StreamingResponse(...)
```

StreamingResponse permite enviar o arquivo em pedacos, sem carregar tudo na resposta de uma vez.

### Por que streaming importa

Streaming e importante porque arquivos podem ser grandes.

Sem streaming:

1. backend baixa o arquivo inteiro do MinIO;
2. guarda tudo em memoria;
3. so depois responde ao cliente.

Com streaming:

1. backend pega um chunk do MinIO;
2. envia esse chunk ao cliente;
3. repete ate acabar.

Isso usa menos memoria e escala melhor.

Mesmo com limite de 10MB, usar streaming desde cedo e bom porque o projeto tem esse bonus como requisito.

### Content-Disposition

No download, adicionamos header:

```python
Content-Disposition: attachment
```

Esse header orienta o navegador a baixar o arquivo como anexo.

Tambem usamos o nome original:

```python
filename*=UTF-8''{encoded_name}
```

`quote()` codifica caracteres especiais para evitar problemas em headers HTTP.

### Presigned URL

Presigned URL e um link temporario assinado.

Ele permite que alguem baixe um objeto diretamente do MinIO sem passar pela API, mas somente ate expirar.

Rota:

```text
GET /share/{file_id}
```

Parametro opcional:

```text
expires_minutes
```

Valor padrao:

```text
15 minutos
```

Limites:

```text
minimo: 1 minuto
maximo: 60 minutos
```

O codigo usa:

```python
generate_presigned_url(
    "get_object",
    Params={"Bucket": settings.minio_bucket, "Key": stored_file.minio_key},
    ExpiresIn=expires_in,
)
```

### Seguranca do share

Mesmo que a URL gerada permita baixar direto do MinIO, a geracao dela ainda e protegida.

Ou seja:

1. o usuario precisa estar autenticado;
2. o arquivo precisa pertencer ao usuario;
3. so entao a API gera o link.

Assim, um usuario nao consegue gerar link para arquivo de outro usuario.

### Schema ShareLink

Foi criado:

```python
class ShareLink(BaseModel):
    url: str
    expires_in: int
```

Resposta esperada:

```json
{
  "url": "http://localhost:9000/...",
  "expires_in": 900
}
```

`expires_in` fica em segundos.

### Erros previstos neste passo

Possiveis respostas:

- `201 Created`: upload feito com sucesso.
- `400 Bad Request`: extensao invalida, MIME type invalido ou arquivo vazio.
- `401 Unauthorized`: token ausente ou invalido.
- `404 Not Found`: arquivo nao existe ou nao pertence ao usuario.
- `413 Request Entity Too Large`: arquivo maior que 10MB.
- `422 Validation Error`: parametro/formulario invalido.
- `502 Bad Gateway`: falha ao comunicar com MinIO.

### Como testar o Passo 3 pelo Swagger

Subir servicos:

```bash
docker compose up -d --build postgres redis minio backend
```

Abrir Swagger:

```text
http://localhost:8000/docs
```

Fazer login:

```text
POST /auth/login
```

Copiar o `access_token`.

Clicar em `Authorize` e preencher:

```text
Bearer SEU_TOKEN
```

Fazer upload:

```text
POST /upload
```

Selecionar um arquivo `.txt`, `.png`, `.jpg` ou `.pdf`.

Resposta esperada:

```json
{
  "id": "...",
  "original_name": "arquivo.txt",
  "mime_type": "text/plain",
  "size": 123,
  "version": 1,
  "created_at": "..."
}
```

Enviar o mesmo arquivo novamente.

Resultado esperado:

```json
{
  "version": 2
}
```

Baixar arquivo:

```text
GET /download/{file_id}
```

Gerar link temporario:

```text
GET /share/{file_id}?expires_minutes=15
```

Copiar o campo `url` e abrir no navegador.

### Como verificar no MinIO

Abrir:

```text
http://localhost:9001
```

Login:

```text
minioadmin
```

Senha:

```text
minioadmin
```

Entrar no bucket:

```text
pixel-files
```

Verificar se existem objetos com estrutura parecida com:

```text
users/{user_id}/{uuid}_v1.txt
users/{user_id}/{uuid}_v2.txt
```

### Como verificar no banco

Opcionalmente, entrar no Postgres:

```bash
docker compose exec postgres psql -U pixel -d pixel_breeders
```

Consultar arquivos:

```sql
SELECT id, user_id, original_name, minio_key, mime_type, size, version, is_deleted, created_at
FROM files
ORDER BY created_at DESC;
```

O mesmo arquivo enviado duas vezes pelo mesmo usuario deve aparecer com versoes diferentes.

### Cuidados importantes

O Passo 3 ainda nao tem listagem `GET /files`.

Isso e intencional. Listagem, cache Redis e delecao pertencem ao Passo 4.

Mesmo sem listagem, o Passo 3 e testavel isoladamente pelo Swagger porque `POST /upload` retorna o `id` do arquivo, e esse `id` pode ser usado em:

- `GET /download/{file_id}`
- `GET /share/{file_id}`

## Passo 4 - Listagem, Delecao e Cache Redis

### O que foi implementado

Neste passo foram implementadas as funcionalidades de leitura da lista de arquivos, cache e delecao:

- rota `GET /files` para listar arquivos do usuario autenticado;
- retorno apenas da versao mais recente ativa de cada nome de arquivo;
- cache da resposta de `GET /files` no Redis;
- logs de `cache hit` e `cache miss`;
- invalidacao do cache quando ocorre upload;
- rota `DELETE /files/{file_id}`;
- exclusao fisica do objeto no MinIO;
- exclusao logica no PostgreSQL com `is_deleted=True`;
- invalidacao do cache quando ocorre delecao.

Arquivos modificados:

- `backend/routers/files.py`
- `backend/main.py`
- `.gitignore`
- `context.md`
- `notes.md`

Importante: este passo nao cria frontend. Ele continua sendo testavel isoladamente pelo Swagger e pelos logs do backend.

### O que significa listar apenas a versao mais recente ativa

O projeto tem versionamento de arquivos.

Se o usuario envia o mesmo nome varias vezes, o banco guarda historico:

```text
relatorio.pdf version 1
relatorio.pdf version 2
relatorio.pdf version 3
```

Para o dashboard, normalmente queremos mostrar apenas a versao atual. Por isso `GET /files` retorna apenas a maior versao ativa de cada `original_name`.

Exemplo:

```text
contrato.pdf v1 ativo
contrato.pdf v2 ativo
foto.png v1 ativo
```

Resposta esperada:

```text
contrato.pdf v2
foto.png v1
```

Se a versao mais nova for deletada logicamente:

```text
contrato.pdf v1 ativo
contrato.pdf v2 deletado
```

A listagem considera apenas arquivos ativos, entao pode voltar:

```text
contrato.pdf v1
```

Isso preserva o historico no banco, mas remove da lista aquilo que foi deletado.

### Query de ultima versao ativa

A funcao responsavel e:

```python
get_latest_active_files(db, user_id)
```

Ela cria uma subquery:

```python
select(
    FileModel.original_name,
    func.max(FileModel.version)
)
.where(FileModel.user_id == user_id, FileModel.is_deleted.is_(False))
.group_by(FileModel.original_name)
```

Conceitos:

- `group_by(original_name)`: agrupa arquivos pelo nome original.
- `max(version)`: pega a maior versao em cada grupo.
- `is_deleted.is_(False)`: ignora arquivos deletados.
- `user_id == user_id`: garante isolamento por usuario.

Depois, a query principal faz join com essa subquery para recuperar os registros completos.

### Redis como cache

Redis e usado para guardar temporariamente a resposta pronta de `GET /files`.

Sem cache:

1. cliente chama `GET /files`;
2. backend consulta PostgreSQL;
3. backend monta JSON;
4. backend responde.

Com cache:

1. primeira chamada consulta PostgreSQL e salva JSON no Redis;
2. segunda chamada busca direto no Redis;
3. backend evita repetir a query enquanto o cache estiver valido.

Isso melhora performance e reduz carga no banco.

### Chave de cache por usuario

O cache precisa ser separado por usuario.

Se todos usassem a mesma chave, um usuario poderia receber a lista de outro. Por isso a chave inclui o `user_id`:

```python
def files_cache_key(user_id: str) -> str:
    return f"files:user:{user_id}"
```

Exemplo:

```text
files:user:abc-123
files:user:def-456
```

Cada usuario tem sua propria entrada no Redis.

### TTL do cache

TTL significa Time To Live.

Foi definido:

```python
CACHE_TTL_SECONDS = 60 * 5
```

Ou seja, o cache expira automaticamente em 5 minutos.

Mesmo com invalidacao manual em upload e delete, TTL e uma protecao adicional. Se algum fluxo esquecer de invalidar o cache, ele nao fica antigo para sempre.

### Cache hit e cache miss

No endpoint `GET /files`, o backend tenta buscar primeiro no Redis:

```python
cached_files = cache.get(cache_key)
```

Se encontrou valor:

```text
cache hit
```

Significa que a resposta veio do Redis.

Se nao encontrou:

```text
cache miss
```

Significa que o backend precisou consultar o PostgreSQL e salvar a resposta no Redis.

Foram adicionados logs:

```python
logger.info("GET /files cache hit for user %s", current_user.id)
logger.info("GET /files cache miss for user %s", current_user.id)
```

Para esses logs aparecerem, o `main.py` configura:

```python
logging.basicConfig(level=logging.INFO)
```

### Serializacao para JSON

Redis guarda strings/bytes. A resposta da API e uma lista de objetos.

Por isso a aplicacao converte os arquivos para dicionarios JSON-safe:

```python
FileRead.model_validate(stored_file).model_dump(mode="json")
```

O `mode="json"` e importante porque transforma tipos como `datetime` em formatos serializaveis.

Depois salvamos:

```python
cache.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(files))
```

E, quando vem do cache:

```python
json.loads(cached_files)
```

### Invalidacao de cache

Invalidar cache significa apagar uma resposta antiga para que a proxima chamada recalcule os dados.

Foi criada a funcao:

```python
def invalidate_files_cache(cache: RedisClient, user_id: str) -> None:
    cache.delete(files_cache_key(user_id))
```

Ela e chamada em dois momentos neste passo:

1. depois de upload com sucesso;
2. depois de delete com sucesso.

Por que invalidar no upload?

Porque um arquivo novo ou uma nova versao deve aparecer na listagem.

Por que invalidar no delete?

Porque o arquivo deletado nao deve continuar aparecendo na lista.

### Rota GET /files

Rota:

```text
GET /files
```

Ela exige Bearer Token.

Fluxo:

1. valida usuario pelo JWT;
2. monta chave de cache por usuario;
3. tenta buscar lista no Redis;
4. se existir, retorna a lista cacheada;
5. se nao existir, consulta PostgreSQL;
6. serializa os arquivos;
7. salva no Redis com TTL;
8. retorna a lista.

Resposta esperada:

```json
[
  {
    "id": "...",
    "original_name": "arquivo.txt",
    "mime_type": "text/plain",
    "size": 123,
    "version": 2,
    "created_at": "..."
  }
]
```

### Delecao fisica e delecao logica

O requisito pede dois tipos de delecao:

- fisica no MinIO;
- logica no PostgreSQL.

Delecao fisica significa remover o objeto real do storage:

```python
storage.delete_object(Bucket=settings.minio_bucket, Key=stored_file.minio_key)
```

Delecao logica significa manter a linha no banco, mas marcar como deletada:

```python
stored_file.is_deleted = True
```

Vantagens da delecao logica:

- preserva historico;
- evita perder rastreabilidade;
- permite auditoria;
- ajuda no versionamento.

### Rota DELETE /files/{file_id}

Rota:

```text
DELETE /files/{file_id}
```

Ela exige Bearer Token.

Fluxo:

1. valida usuario pelo JWT;
2. busca o arquivo pelo `id`;
3. garante que `user_id` pertence ao usuario autenticado;
4. garante que `is_deleted=False`;
5. deleta o objeto no MinIO;
6. marca `is_deleted=True` no PostgreSQL;
7. executa `commit`;
8. invalida o cache do usuario;
9. retorna `204 No Content`.

### Isolamento por usuario

Tanto `GET /files` quanto `DELETE /files/{file_id}` respeitam isolamento por usuario.

Na busca de arquivo individual, usamos:

```python
select(FileModel).where(
    FileModel.id == file_id,
    FileModel.user_id == current_user.id,
    FileModel.is_deleted.is_(False),
)
```

Isso impede que um usuario delete, baixe, compartilhe ou enxergue arquivo de outro usuario.

Se o arquivo existe, mas pertence a outro usuario, a API retorna:

```text
404 Not Found
```

Esse comportamento evita revelar a existencia de arquivos de outros usuarios.

### Por que DELETE retorna 204

`204 No Content` significa que a operacao foi concluida com sucesso, mas nao ha corpo de resposta.

E comum em rotas DELETE.

Exemplo:

```text
DELETE /files/{file_id}
```

Resposta:

```text
204 No Content
```

### Como testar o Passo 4 pelo Swagger

Subir servicos:

```bash
docker compose up -d --build postgres redis minio backend
```

Abrir Swagger:

```text
http://localhost:8000/docs
```

Fazer login em:

```text
POST /auth/login
```

Autorizar com:

```text
Bearer SEU_TOKEN
```

Garantir que existe ao menos um arquivo enviado em:

```text
POST /upload
```

Chamar:

```text
GET /files
```

Resultado esperado:

- retorna lista de arquivos;
- primeira chamada deve gerar log de `cache miss`.

Chamar novamente:

```text
GET /files
```

Resultado esperado:

- retorna a mesma lista;
- segunda chamada deve gerar log de `cache hit`.

Ver logs:

```bash
docker compose logs --tail=100 backend
```

Deletar um arquivo:

```text
DELETE /files/{file_id}
```

Resultado esperado:

```text
204 No Content
```

Chamar novamente:

```text
GET /files
```

Resultado esperado:

- arquivo deletado nao aparece mais;
- cache foi invalidado;
- a chamada apos delete deve gerar novo `cache miss`.

### Como verificar no Redis

Opcionalmente, entrar no Redis:

```bash
docker compose exec redis redis-cli
```

Listar chaves:

```text
KEYS files:user:*
```

Ver TTL:

```text
TTL files:user:{user_id}
```

Apagar manualmente uma chave, se precisar:

```text
DEL files:user:{user_id}
```

### Como verificar no PostgreSQL

Entrar no Postgres:

```bash
docker compose exec postgres psql -U pixel -d pixel_breeders
```

Consultar arquivos:

```sql
SELECT id, original_name, version, is_deleted, created_at
FROM files
ORDER BY created_at DESC;
```

Depois de deletar, o arquivo deve continuar existindo no banco, mas com:

```text
is_deleted = true
```

### Como verificar no MinIO

Abrir:

```text
http://localhost:9001
```

Entrar no bucket:

```text
pixel-files
```

Depois do delete, o objeto correspondente ao arquivo deletado deve ter sido removido do bucket.

### Erros previstos neste passo

Possiveis respostas:

- `200 OK`: listagem retornada com sucesso.
- `204 No Content`: delecao concluida.
- `401 Unauthorized`: token ausente ou invalido.
- `404 Not Found`: arquivo inexistente, deletado ou pertencente a outro usuario.
- `502 Bad Gateway`: falha ao comunicar com MinIO durante delecao.
- `500 Internal Server Error`: falha inesperada ao salvar alteracao no banco.

### Cuidados importantes

Cache e uma copia temporaria de dados. Sempre que a fonte real muda, o cache precisa ser invalidado.

Neste passo, a fonte real muda em:

- upload;
- delete.

Por isso os dois fluxos chamam:

```python
invalidate_files_cache(cache, current_user.id)
```

No futuro, se existir uma rota para restaurar arquivo, renomear arquivo ou alterar versao ativa, ela tambem devera invalidar o cache.

## Passo 5 - Setup do Frontend e Autenticacao

### O que foi implementado

Neste passo foi criada a base do frontend da aplicacao:

- projeto React com TypeScript e Vite;
- configuracao do TailwindCSS;
- configuracao do Axios para chamar a API FastAPI;
- estado global de autenticacao com React Context;
- persistencia do token JWT em `localStorage`;
- paginas de Login e Cadastro;
- rota protegida `/dashboard`;
- redirecionamento automatico apos login/cadastro;
- `Dockerfile` multi-stage do frontend;
- atualizacao do `docker-compose.yml` para construir e subir o frontend.

Arquivos criados/modificados:

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/index.html`
- `frontend/vite.config.ts`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/tsconfig.node.json`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `frontend/src/lib/api.ts`
- `frontend/src/auth/AuthContext.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `docker-compose.yml`
- `.gitignore`
- `notes.md`

Importante: este passo nao implementa tabela de arquivos, upload visual, barra de progresso, download pela UI ou preview de imagens. Essas partes pertencem ao Passo 6.

### React

React e uma biblioteca JavaScript para construir interfaces de usuario usando componentes.

Componente e uma funcao que retorna UI.

Exemplo conceitual:

```tsx
function Button() {
  return <button>Entrar</button>
}
```

No projeto, as telas foram separadas em componentes:

- `LoginPage`
- `RegisterPage`
- `DashboardPage`
- `App`
- `AuthProvider`

Essa separacao facilita manutencao porque cada arquivo tem uma responsabilidade clara.

### TypeScript

TypeScript adiciona tipos ao JavaScript.

Ele ajuda a detectar erros antes da aplicacao rodar.

Exemplo usado no projeto:

```ts
type User = {
  id: string
  email: string
  created_at: string
}
```

Com isso, quando o codigo usa `user.email`, o editor e o compilador sabem que essa propriedade existe e e uma string.

### Vite

Vite e a ferramenta usada para rodar e buildar o frontend.

Ele fornece:

- servidor de desenvolvimento rapido;
- hot reload;
- build de producao;
- suporte moderno a TypeScript e React.

Scripts no `package.json`:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview --host 0.0.0.0"
}
```

`npm run dev` sobe o frontend em desenvolvimento.

`npm run build` primeiro valida TypeScript e depois gera arquivos otimizados em `dist`.

### TailwindCSS

TailwindCSS e um framework CSS baseado em classes utilitarias.

Em vez de criar classes CSS manuais para tudo, usamos classes como:

```tsx
className="rounded-md bg-moss px-4 py-3 text-white"
```

Vantagens:

- rapido para construir UI;
- evita CSS global excessivo;
- mantem estilos perto do componente;
- facilita responsividade com classes como `sm:px-6`.

Arquivos principais:

- `tailwind.config.js`
- `postcss.config.js`
- `src/index.css`

No `src/index.css`, as diretivas ativam as camadas do Tailwind:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Paleta visual

Foi definida uma paleta simples no `tailwind.config.js`:

```js
colors: {
  ink: "#16201c",
  moss: "#3f6b57",
  mint: "#d7f2e5",
  coral: "#ef7b68",
  cloud: "#f7faf8",
}
```

Ela evita um visual generico e mantem a interface consistente.

### React Router

`react-router-dom` gerencia rotas no frontend.

Rotas criadas:

```text
/login
/register
/dashboard
```

No `App.tsx`, usamos:

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
</Routes>
```

O navegador muda de tela sem recarregar a pagina inteira.

Isso e o comportamento tipico de uma SPA, Single Page Application.

### SPA

SPA significa Single Page Application.

Em uma SPA:

1. o navegador baixa o HTML inicial;
2. React assume a renderizacao;
3. mudancas de rota sao controladas no cliente;
4. chamadas de dados acontecem via API.

O backend FastAPI nao renderiza HTML. Ele apenas fornece dados JSON.

### Axios

Axios e uma biblioteca para fazer requisicoes HTTP no frontend.

Criamos uma instancia centralizada em:

```text
frontend/src/lib/api.ts
```

Configuracao:

```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
})
```

`VITE_API_URL` vem do `docker-compose.yml`:

```yaml
VITE_API_URL: http://localhost:8000
```

Assim o frontend sabe onde esta a API.

### Variaveis de ambiente no Vite

No Vite, variaveis expostas ao frontend precisam comecar com:

```text
VITE_
```

Por isso usamos:

```text
VITE_API_URL
```

Variaveis sem esse prefixo nao ficam disponiveis no codigo do navegador.

### localStorage

`localStorage` e uma API do navegador para guardar strings localmente.

Neste projeto, o token JWT e salvo com a chave:

```ts
TOKEN_STORAGE_KEY = "pixel_breeders_token"
```

Quando o usuario faz login ou cadastro:

```ts
localStorage.setItem(TOKEN_STORAGE_KEY, token)
```

Quando o usuario sai:

```ts
localStorage.removeItem(TOKEN_STORAGE_KEY)
```

Isso permite sessao persistente: se o usuario recarregar a pagina, o frontend tenta reutilizar o token salvo.

### Header Authorization

Para rotas protegidas, o backend espera:

```http
Authorization: Bearer SEU_TOKEN
```

No frontend, a funcao `setAuthToken` configura o Axios:

```ts
api.defaults.headers.common.Authorization = `Bearer ${token}`
```

Assim, as proximas chamadas feitas com `api` enviam o token automaticamente.

### React Context para autenticacao

React Context permite compartilhar estado entre componentes sem passar props manualmente por varios niveis.

Foi criado:

```text
frontend/src/auth/AuthContext.tsx
```

Ele expõe:

- `user`
- `token`
- `isLoading`
- `login`
- `register`
- `logout`

Qualquer componente dentro de `AuthProvider` pode usar:

```ts
const { user, login, logout } = useAuth()
```

### Fluxo ao carregar a aplicacao

Quando o app abre:

1. `AuthProvider` verifica se existe token no `localStorage`;
2. se existir, configura o Axios com Bearer Token;
3. chama `GET /auth/me`;
4. se o token for valido, salva o usuario no estado;
5. se o token for invalido, remove o token e limpa a sessao.

Isso evita considerar autenticado um token expirado ou invalido.

### Login

Tela:

```text
/login
```

Arquivo:

```text
frontend/src/pages/LoginPage.tsx
```

Fluxo:

1. usuario informa email e senha;
2. frontend chama `POST /auth/login`;
3. backend retorna `access_token` e dados do usuario;
4. frontend salva token no `localStorage`;
5. frontend configura header `Authorization`;
6. usuario e redirecionado para `/dashboard`.

### Cadastro

Tela:

```text
/register
```

Arquivo:

```text
frontend/src/pages/RegisterPage.tsx
```

Fluxo:

1. usuario informa email e senha;
2. frontend chama `POST /auth/register`;
3. backend cria usuario e retorna JWT;
4. frontend salva token;
5. usuario e redirecionado para `/dashboard`.

### Dashboard minimo

Tela:

```text
/dashboard
```

Arquivo:

```text
frontend/src/pages/DashboardPage.tsx
```

Neste passo, o dashboard ainda e propositalmente simples.

Ele mostra:

- marca/nome da aplicacao;
- email do usuario autenticado;
- botao de sair.

A tabela de arquivos, upload visual e preview entram no Passo 6.

### Rotas protegidas

No `App.tsx`, foi criado `ProtectedRoute`.

Ele verifica:

```ts
if (!token) {
  return <Navigate to="/login" replace />
}
```

Isso significa:

- se ha token, mostra a pagina protegida;
- se nao ha token, redireciona para login.

Tambem existe `PublicRoute`, que faz o contrario:

- se o usuario ja esta autenticado, `/login` e `/register` redirecionam para `/dashboard`.

### Logout

O logout faz:

```ts
setToken(null)
setUser(null)
setAuthToken(null)
```

Isso:

- remove token do estado React;
- remove usuario do estado React;
- remove header Authorization do Axios;
- remove token do `localStorage`.

Como `/dashboard` e rota protegida, o usuario volta para `/login`.

### lucide-react

`lucide-react` foi adicionado para icones nos botoes.

Icones usados:

- `LogIn`
- `UserPlus`
- `LogOut`

Icones ajudam a reconhecer a acao visualmente sem criar SVG manual.

### Dockerfile do frontend

Foi criado:

```text
frontend/Dockerfile
```

Ele tem tres stages:

1. `dev`
2. `build`
3. `prod`

Stage `dev`:

```dockerfile
FROM node:22-alpine AS dev
...
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

Usado pelo Docker Compose para desenvolvimento.

Stage `build`:

```dockerfile
RUN npm run build
```

Gera os arquivos estaticos de producao.

Stage `prod`:

```dockerfile
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
```

Serve o build estatico com Nginx.

### docker-compose.yml

O servico frontend agora usa build proprio:

```yaml
frontend:
  build:
    context: ./frontend
    target: dev
```

Em desenvolvimento, o Compose executa:

```yaml
command: sh -c "npm install && npm run dev -- --host 0.0.0.0"
```

Esse comando garante que o volume `frontend_node_modules` seja preenchido antes de iniciar o Vite. Isso e importante porque volumes nomeados podem nascer vazios mesmo quando a imagem Docker ja possui `node_modules`.

Porta:

```yaml
"5173:5173"
```

Volume:

```yaml
./frontend:/app
frontend_node_modules:/app/node_modules
```

O bind mount permite editar arquivos localmente e ver hot reload.

O volume `frontend_node_modules` evita misturar dependencias do container diretamente com o filesystem local.

### .gitignore

Foram adicionados:

```text
node_modules/
dist/
frontend/node_modules/
frontend/dist/
```

`node_modules` nao deve entrar no Git porque:

- e muito grande;
- e gerado por `npm install`;
- muda conforme ambiente;
- o lockfile ja registra as versoes instaladas.

`dist` tambem nao deve entrar porque e gerado por `npm run build`.

### Como testar o Passo 5

Subir a stack completa:

```bash
docker compose up -d --build
```

Acessar:

```text
http://localhost:5173
```

Fluxo de cadastro:

1. abrir `/register`;
2. informar email e senha com pelo menos 8 caracteres;
3. enviar;
4. deve redirecionar para `/dashboard`;
5. o email deve aparecer no dashboard.

Fluxo de login:

1. clicar em sair;
2. abrir `/login`;
3. informar credenciais existentes;
4. enviar;
5. deve redirecionar para `/dashboard`.

Teste de persistencia:

1. fazer login;
2. recarregar a pagina;
3. o usuario deve continuar autenticado;
4. se o token for invalido, o app volta para `/login`.

### Validacoes feitas neste passo

Foi executado:

```bash
npm install
```

para instalar dependencias e atualizar `package-lock.json`.

Foi executado:

```bash
npm run build
```

para validar TypeScript e build Vite.

Foi executado:

```bash
docker compose config
```

para validar a configuracao do Compose.

### Cuidados importantes

O frontend depende do backend estar acessivel em:

```text
http://localhost:8000
```

Se o cadastro ou login falhar, verificar:

1. se o backend esta rodando;
2. se `http://localhost:8000/docs` abre;
3. se `VITE_API_URL` esta correto no `docker-compose.yml`;
4. se CORS permite `http://localhost:5173`;
5. se o usuario ja existe;
6. se a senha tem pelo menos 8 caracteres.

## Passo 6 - Dashboard, Upload UI e Bonus

### O que foi implementado

Neste passo o dashboard deixou de ser apenas uma tela autenticada minima e passou a executar o fluxo principal do produto:

- tabela "Meus Arquivos" consumindo `GET /files`;
- upload de arquivo pela interface;
- barra de progresso de upload;
- atualizacao da tabela apos upload;
- preview de imagens `.png` e `.jpg`;
- download de arquivo pela UI;
- delete de arquivo pela UI;
- geracao de link temporario pela UI;
- copia do link temporario para a area de transferencia quando possivel;
- exibicao de mensagens de erro para operacoes de arquivo.

Arquivos criados/modificados:

- `frontend/src/lib/files.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `notes.md`
- `context.md`
- `.gitignore`

Importante: nenhuma rota nova foi criada no backend neste passo. O frontend passou a consumir as rotas ja implementadas nos Passos 3 e 4.

### Servico de arquivos no frontend

Foi criado:

```text
frontend/src/lib/files.ts
```

Esse arquivo centraliza chamadas HTTP relacionadas a arquivos.

Funcoes criadas:

- `listFiles`
- `uploadFile`
- `downloadFile`
- `deleteFile`
- `createShareLink`
- `isImageFile`

Separar chamadas HTTP da tela deixa o componente `DashboardPage` mais legivel. A tela cuida da interface; o servico cuida da comunicacao com a API.

### Tipo StoredFile

Foi criado o tipo:

```ts
export type StoredFile = {
  id: string
  original_name: string
  mime_type: string
  size: number
  version: number
  created_at: string
}
```

Esse tipo representa a resposta do backend para arquivos.

Ele espelha o schema `FileRead` do FastAPI.

Ter esse tipo no frontend ajuda o TypeScript a validar usos como:

```ts
file.original_name
file.version
file.mime_type
```

### GET /files no frontend

No frontend:

```ts
export async function listFiles() {
  const response = await api.get<StoredFile[]>("/files")
  return response.data
}
```

Essa chamada usa o Axios configurado em `api.ts`.

Como o token JWT ja fica no header `Authorization`, a API retorna somente arquivos do usuario autenticado.

### DashboardPage

O arquivo principal deste passo e:

```text
frontend/src/pages/DashboardPage.tsx
```

Ele controla:

- estado da lista de arquivos;
- estado de carregamento;
- estado de upload;
- progresso;
- erros;
- arquivo ocupado por alguma acao;
- previews de imagens;
- link temporario gerado.

Estados principais:

```ts
const [files, setFiles] = useState<StoredFile[]>([])
const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
const [isLoading, setIsLoading] = useState(true)
const [isUploading, setIsUploading] = useState(false)
const [uploadProgress, setUploadProgress] = useState(0)
const [error, setError] = useState("")
const [shareLink, setShareLink] = useState<{ fileId: string; url: string } | null>(null)
const [busyFileId, setBusyFileId] = useState<string | null>(null)
```

### Carregamento inicial

Quando o dashboard abre, um `useEffect` chama:

```ts
refreshFiles()
```

Essa funcao chama `GET /files` e atualiza o estado:

```ts
const data = await listFiles()
setFiles(data)
```

Se der erro, a tela mostra uma mensagem amigavel.

### Tabela Meus Arquivos

A tabela mostra:

- preview;
- nome original;
- tipo MIME;
- tamanho;
- versao;
- data de upload;
- acoes.

Como `GET /files` ja retorna apenas a versao mais recente ativa por nome, a tabela mostra a visao correta para o dashboard.

O historico completo de versoes ainda existe no banco, mas nao e exibido nesta etapa.

### Formatacao de tamanho

Foi criada:

```ts
function formatFileSize(size: number)
```

Ela transforma bytes em:

- `B`;
- `KB`;
- `MB`.

Exemplo:

```text
1536 bytes -> 1.5 KB
```

Isso torna a tabela mais facil de ler.

### Formatacao de data

Foi criada:

```ts
function formatDate(value: string)
```

Ela usa:

```ts
Intl.DateTimeFormat("pt-BR")
```

Assim, datas aparecem em formato familiar para o usuario brasileiro.

### Upload pela UI

O input de arquivo aceita:

```text
.png,.jpg,.pdf,.txt
```

No codigo:

```ts
const ACCEPTED_TYPES = ".png,.jpg,.pdf,.txt"
```

Esse `accept` ajuda o navegador a filtrar arquivos no seletor.

Importante: isso nao substitui a validacao do backend. O backend continua sendo a fonte de verdade para seguranca e regras.

### FormData

Upload de arquivo no navegador usa `FormData`.

No `files.ts`:

```ts
const formData = new FormData()
formData.append("file", file)
```

O nome `"file"` precisa bater com o parametro esperado pelo FastAPI:

```python
file: UploadFile = UploadField(...)
```

### Barra de progresso

Axios permite acompanhar progresso de upload com:

```ts
onUploadProgress
```

No projeto:

```ts
setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
```

Conceitos:

- `loaded`: bytes ja enviados;
- `total`: total de bytes;
- percentual: `loaded / total * 100`.

A barra visual usa a largura CSS:

```tsx
style={{ width: `${uploadProgress}%` }}
```

### Atualizacao apos upload

Depois de upload bem-sucedido:

```ts
await refreshFiles()
```

Isso chama `GET /files` novamente para atualizar a tabela.

No backend, o upload invalida o cache Redis do usuario. Entao a listagem apos upload vem atualizada.

### Preview de imagens

O backend exige token para baixar arquivos.

Uma tag `<img src="http://...">` comum nao permite adicionar facilmente o header:

```http
Authorization: Bearer ...
```

Por isso o frontend busca a imagem com Axios, que ja envia o Bearer Token, e transforma o blob em uma URL local:

```ts
const blob = await downloadFile(file)
const url = URL.createObjectURL(blob)
```

Depois:

```tsx
<img src={previewUrl} alt={file.original_name} />
```

Essa abordagem permite preview mesmo com download protegido.

### Blob

Blob representa dados binarios no navegador.

Ao baixar uma imagem, PDF ou TXT como blob, o frontend recebe o conteudo bruto do arquivo.

Esse blob pode ser:

- mostrado como preview;
- salvo como download;
- transformado em URL temporaria local.

### URL.createObjectURL

`URL.createObjectURL(blob)` cria uma URL local temporaria para um blob.

Exemplo:

```text
blob:http://localhost:5173/...
```

Essas URLs ocupam memoria enquanto existem.

Por isso o componente limpa com:

```ts
URL.revokeObjectURL(url)
```

Isso evita vazamento de memoria no navegador.

### Download pela UI

Download usa a rota protegida:

```text
GET /download/{file_id}
```

No frontend:

```ts
const response = await api.get<Blob>(`/download/${file.id}`, {
  responseType: "blob",
})
```

Depois, a funcao `saveBlob` cria uma tag `<a>` temporaria:

```ts
const link = document.createElement("a")
link.href = url
link.download = filename
link.click()
```

Isso dispara o download no navegador com o nome original.

### Delete pela UI

Delete usa:

```text
DELETE /files/{file_id}
```

Fluxo:

1. usuario clica no botao de deletar;
2. frontend chama a API;
3. backend deleta fisicamente no MinIO;
4. backend marca `is_deleted=True` no PostgreSQL;
5. backend invalida cache Redis;
6. frontend chama `refreshFiles`;
7. arquivo some da tabela.

### Gerar link pela UI

Gerar link usa:

```text
GET /share/{file_id}?expires_minutes=15
```

O frontend guarda:

```ts
setShareLink({ fileId: file.id, url: link.url })
```

Assim o link fica associado ao arquivo correto.

Quando possivel, tambem copia para a area de transferencia:

```ts
await navigator.clipboard?.writeText(link.url)
```

### Acoes por linha

Cada arquivo tem botoes com icones:

- Download;
- Gerar link;
- Abrir link gerado;
- Deletar.

Os icones vem de:

```text
lucide-react
```

Isso mantem a interface mais compacta e consistente.

### Estado busyFileId

Foi criado:

```ts
const [busyFileId, setBusyFileId] = useState<string | null>(null)
```

Ele indica qual arquivo esta executando uma acao.

Enquanto uma acao esta em andamento, os botoes daquele arquivo ficam desabilitados.

Isso evita cliques repetidos durante download, delete ou geracao de link.

### Estados vazios e erros

A tela trata:

- lista carregando;
- lista vazia;
- erro ao carregar arquivos;
- erro de upload;
- erro de download;
- erro de delete;
- erro ao gerar link.

Esses estados deixam a experiencia mais previsivel.

### Como testar o Passo 6

Subir a stack completa:

```bash
docker compose up -d --build
```

Acessar:

```text
http://localhost:5173
```

Fluxo completo:

1. fazer login ou cadastro;
2. entrar em `/dashboard`;
3. enviar um arquivo `.txt`;
4. verificar a barra de progresso;
5. confirmar que o arquivo aparece na tabela;
6. enviar o mesmo arquivo novamente;
7. confirmar que a versao exibida aumenta;
8. enviar uma imagem `.png` ou `.jpg`;
9. confirmar que o preview aparece na tabela;
10. clicar em download e verificar o arquivo baixado;
11. clicar em gerar link;
12. abrir o link gerado em nova aba;
13. deletar um arquivo;
14. confirmar que ele some da tabela.

### Validacoes feitas neste passo

Foi executado:

```bash
npm run build
```

Isso validou:

- TypeScript;
- importacoes;
- JSX;
- build Vite;
- Tailwind no bundle final.

### Cuidados importantes

O preview de imagens faz downloads autenticados das imagens para criar URLs locais.

Isso e seguro para esta etapa porque:

- a imagem continua protegida pelo backend;
- o token e enviado via Axios;
- a URL local so existe no navegador do usuario;
- `URL.revokeObjectURL` limpa os blobs antigos.

Se o volume de imagens crescer muito no futuro, pode ser interessante criar thumbnails no backend ou gerar URLs assinadas especificas para preview.
