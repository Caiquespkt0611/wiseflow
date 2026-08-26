#!/usr/bin/env bash
#
# Deploy padrão InnovAdapt: backend primeiro, frontend depois, na ordem.
# O mesmo script em todos os projetos. O que muda é o deploy.conf ao lado dele.
#
#   npm run deploy            back e front, em sequência
#   npm run deploy -- --back  só o backend
#   npm run deploy -- --front só o frontend
#   npm run deploy -- --check confere tudo e não publica nada
#   npm run deploy -- --sujo  publica o disco mesmo com árvore suja
#
# A regra que justifica existir: o frontend NUNCA sobe se o backend falhou ou
# não voltou a responder. Publicar tela nova contra API velha é como o cliente
# descobre o problema antes da gente.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

[ -f deploy.conf ] || { echo "erro: deploy.conf não encontrado em $RAIZ"; exit 1; }
# shellcheck disable=SC1091
source ./deploy.conf

PROJETO="${PROJETO:-$(basename "$RAIZ")}"
GIT_EMAILS="${GIT_EMAILS:-}"
BACK="${BACK:-}"
BACK_HEALTH="${BACK_HEALTH:-}"
FRONT="${FRONT:-}"
FRONT_DIR="${FRONT_DIR:-.}"
FRONT_URL="${FRONT_URL:-}"

SO_BACK=0; SO_FRONT=0; CHECAR=0; PERMITE_SUJO=0
for arg in "$@"; do
  case "$arg" in
    --back)  SO_BACK=1 ;;
    --front) SO_FRONT=1 ;;
    --check|--dry-run) CHECAR=1 ;;
    --sujo)  PERMITE_SUJO=1 ;;
    *) echo "opção desconhecida: $arg"; exit 1 ;;
  esac
done
FAZ_BACK=1; FAZ_FRONT=1
[ "$SO_BACK" = "1" ] && FAZ_FRONT=0
[ "$SO_FRONT" = "1" ] && FAZ_BACK=0
[ -z "$BACK" ] && FAZ_BACK=0
[ -z "$FRONT" ] && FAZ_FRONT=0

titulo() { printf "\n\033[1m== %s\033[0m\n" "$1"; }
ok()     { printf "   \033[32mok\033[0m  %s\n" "$1"; }
aviso()  { printf "   \033[33m!\033[0m   %s\n" "$1"; }
erro()   { printf "   \033[31mxx\033[0m  %s\n" "$1"; }

# ---------------------------------------------------------------- pré-checagem
titulo "$PROJETO"

if [ -n "$GIT_EMAILS" ]; then
  ATUAL="$(git config user.email 2>/dev/null || true)"
  ACEITO=0
  for e in $GIT_EMAILS; do [ "$ATUAL" = "$e" ] && ACEITO=1; done
  if [ "$ACEITO" != "1" ]; then
    erro "git user.email é '$ATUAL', que a conta do GitHub não reconhece"
    erro "a Vercel bloqueia deploy de autor desconhecido: fica em BLOCKED, sem log de build"
    erro "aceitos: $GIT_EMAILS"
    erro "corrija com: git config user.email ${GIT_EMAILS%% *}"
    exit 1
  fi
  ok "autor do commit: $ATUAL"
fi

# Árvore suja é o risco real, não o push (ver CEREBRO/operacional/deploy-padrao).
# Isto era só um aviso e não bastou: em 25/08/2026 a Gestão InnovAdapt estava com
# 2.561 linhas fora do git, o disco no ar e o git para trás. Um push de correção
# republicou o commit velho contra um banco já migrado e derrubou as telas de
# quem estava logado. Agora impede. Escape consciente: --sujo.
if [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
  if [ "$PERMITE_SUJO" = "1" ]; then
    aviso "árvore suja, publicando o disco assim mesmo (--sujo)"
  else
    erro "há mudança não commitada; o git ficaria atrás do que está no ar"
    git status --short | sed 's/^/       /'
    erro "commite antes de publicar, ou use --sujo se for proposital"
    exit 1
  fi
else
  ok "árvore limpa"
fi

# Checagem específica do projeto, opcional, vinda do deploy.conf. É onde cada
# projeto põe a prova que só ele tem — drift de schema, RLS, bater com planilha.
if [ -n "${PRE_CHECK:-}" ]; then
  if bash -c "$PRE_CHECK"; then
    ok "PRE_CHECK do projeto passou"
  else
    erro "PRE_CHECK do projeto falhou; nada foi publicado"
    exit 1
  fi
fi

if [ "$FAZ_BACK" = "1" ]; then
  command -v railway >/dev/null || { erro "railway CLI não encontrada"; exit 1; }
  railway whoami >/dev/null 2>&1 || { erro "railway não logado: rode 'railway login'"; exit 1; }
  SERVICO="$(railway status --json 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("name","?"))' 2>/dev/null || echo '?')"
  [ "$SERVICO" = "?" ] && { erro "projeto não linkado no Railway: rode 'railway link'"; exit 1; }
  ok "backend: Railway · $SERVICO"
  [ -n "$BACK_HEALTH" ] && ok "healthcheck: $BACK_HEALTH"
fi

if [ "$FAZ_FRONT" = "1" ]; then
  case "$FRONT" in
    vercel)
      command -v vercel >/dev/null || { erro "vercel CLI não encontrada"; exit 1; }
      [ -f "$FRONT_DIR/.vercel/project.json" ] || { erro "sem .vercel em $FRONT_DIR: rode 'vercel link'"; exit 1; }
      NOME_VERCEL="$(python3 -c "import json;print(json.load(open('$FRONT_DIR/.vercel/project.json'))['projectName'])")"
      ok "frontend: Vercel · $NOME_VERCEL ($FRONT_DIR)"
      ;;
    hostinger)
      # A Hostinger puxa do GitHub SOZINHA quando o auto-deploy está ligado:
      # clona em hbuilds/last-source, roda npm install e build numa pasta nova em
      # hbuilds/versions/<id>, e só então move o link hbuilds/current. Publicar,
      # daqui, é empurrar o commit — não há botão a apertar.
      git remote get-url origin >/dev/null 2>&1 || { erro "sem remoto origin: a Hostinger puxa do GitHub"; exit 1; }
      ok "frontend: Hostinger · auto-deploy a partir de $(git remote get-url origin | sed -E 's#.*/##')"
      if [ -n "${HOSTINGER_SSH:-}" ] && [ -n "${HOSTINGER_SOURCE:-}" ]; then
        ok "confirmação por SSH ligada: dá para provar qual commit está no ar"
      else
        aviso "sem HOSTINGER_SSH no deploy.conf: não dá para confirmar a versão publicada"
      fi
      ;;
    *)
      erro "FRONT=\"$FRONT\" desconhecido no deploy.conf (use vercel ou hostinger)"
      exit 1
      ;;
  esac
  [ -n "$FRONT_URL" ] && ok "produção: $FRONT_URL"
fi

[ "$FAZ_BACK" = "0" ] && [ "$FAZ_FRONT" = "0" ] && { aviso "nada para publicar"; exit 0; }

if [ "$CHECAR" = "1" ]; then
  titulo "modo --check: nada foi publicado"
  exit 0
fi

# ------------------------------------------------------------------- 1. BACKEND
if [ "$FAZ_BACK" = "1" ]; then
  titulo "1/2  backend"
  railway up -c -y
  ok "railway up concluído"

  if [ -n "$BACK_HEALTH" ]; then
    printf "   aguardando o healthcheck responder"
    SUBIU=0
    for _ in $(seq 1 40); do
      CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BACK_HEALTH" || true)"
      if [ "$CODIGO" = "200" ]; then SUBIU=1; break; fi
      printf "."
      sleep 5
    done
    printf "\n"
    if [ "$SUBIU" != "1" ]; then
      erro "o backend não respondeu 200 em $BACK_HEALTH"
      erro "o frontend NÃO foi publicado, de propósito"
      erro "veja o que houve: railway logs -d \$(railway status --json | python3 -c 'import json,sys;print(json.load(sys.stdin)[\"deployments\"][\"edges\"][0][\"node\"][\"id\"])')"
      exit 1
    fi
    ok "backend no ar e respondendo"
  else
    aviso "sem BACK_HEALTH no deploy.conf: subindo o front sem confirmar a API"
  fi
fi

# ------------------------------------------------------------------ 2. FRONTEND
if [ "$FAZ_FRONT" = "1" ]; then
  titulo "2/2  frontend"
  case "$FRONT" in
    vercel)
      ( cd "$FRONT_DIR" && vercel deploy --prod --yes )
      ok "vercel deploy concluído"
      ;;
    hostinger)
      git push origin "$(git rev-parse --abbrev-ref HEAD)"
      ALVO="$(git rev-parse HEAD)"
      ok "commit ${ALVO:0:7} no GitHub; a Hostinger puxa e reconstrói sozinha"

      # Conferir de fora é impossível: os nomes dos arquivos do Next derivam do
      # caminho dos módulos, não do conteúdo, e ficam iguais entre versões. Só o
      # commit que está no servidor responde, e para isso é preciso entrar nele.
      if [ -n "${HOSTINGER_SSH:-}" ] && [ -n "${HOSTINGER_SOURCE:-}" ]; then
        printf "   aguardando a Hostinger construir"
        CHEGOU=0
        for _ in $(seq 1 40); do
          LA="$(ssh $HOSTINGER_SSH -o BatchMode=yes -o ConnectTimeout=15 \
                  "git -C $HOSTINGER_SOURCE rev-parse HEAD" 2>/dev/null || true)"
          if [ "$LA" = "$ALVO" ]; then CHEGOU=1; break; fi
          printf "."
          sleep 15
        done
        printf "\n"
        if [ "$CHEGOU" = "1" ]; then
          ok "servidor está no commit ${ALVO:0:7} — build novo publicado"
        else
          aviso "o servidor ainda não está em ${ALVO:0:7} (último visto: ${LA:0:7})"
          aviso "o auto-deploy pode estar desligado: hPanel → site → Git → Deploy"
        fi
      else
        aviso "sem HOSTINGER_SSH: a conferência abaixo só diz que o site responde,"
        aviso "NÃO que já é a versão nova"
      fi
      ;;
  esac

  if [ -n "$FRONT_URL" ]; then
    printf "   conferindo o front"
    NOAR=0
    for _ in $(seq 1 20); do
      CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$FRONT_URL" || true)"
      case "$CODIGO" in 200|301|302|307|308) NOAR=1; break ;; esac
      printf "."
      sleep 3
    done
    printf "\n"
    [ "$NOAR" = "1" ] && ok "front respondendo em $FRONT_URL" || aviso "front não respondeu ainda; confira em $FRONT_URL"
  fi
fi

titulo "publicado"
[ "$FAZ_BACK" = "1" ] && echo "   backend:  ${BACK_HEALTH%/*}"
[ "$FAZ_FRONT" = "1" ] && echo "   frontend: $FRONT_URL"
echo
