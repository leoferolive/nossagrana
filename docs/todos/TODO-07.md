# TODO-07 — Auth e Onboarding

**Status:** ✅ Concluído

## Objetivo

Alinhar as telas de autenticação e onboarding ao wireframe mobile.

## Arquivos envolvidos

- `apps/web/src/pages/login-page.tsx`
- `apps/web/src/pages/sign-up-page.tsx`
- `apps/web/src/pages/onboarding-page.tsx`
- `apps/web/src/components/ui/auth-shell.tsx`
- `apps/web/src/components/ui/brand-mark.tsx`

## Referência: wireframe-mobile.jsx

### LoginScreen

```
- Topo centrado: "NossaGrana" (verde, 36px, peso 800, letter-spacing -1px)
- Subtítulo: "Finanças da família, simplificadas" (cinza, 13px)
- Campo: Email
- Campo: Senha (type=password)
- Botão "Entrar" (verde, cheio, w-full)
- Link: "Não tem conta? Cadastre-se"
```

### SignupScreen

```
- Link "← Voltar" (verde, 13px)
- Título "Criar Conta" (22px, bold)
- Campo: Nome
- Campo: Email
- Campo: Senha
- Botão "Continuar" (verde, cheio, w-full)
```

### FamilySetupScreen (OnboardingPage)

```
- Título "Entrar numa Família" (22px, bold)
- Subtítulo explicativo
- 3 cards clicáveis (border, bg-panel):
  1. 🏠 Criar Família — "Comece uma nova família e convide membros"
  2. 🔗 Tenho um código de convite — "Cole o código ou link que recebeu"
  3. 🔍 Buscar Família — "Encontre e solicite entrada numa família"
- Cada card navega para o formulário correspondente (pode manter fluxo atual com mode state)
```

## Critérios de Aceite

1. AuthShell mostra "NossaGrana" em verde como destaque principal (BrandMark)
2. LoginPage tem layout e ordem dos elementos conforme wireframe
3. SignupPage tem "← Voltar" e fluxo nome → email → senha → Continuar
4. OnboardingPage exibe os 3 cards antes do formulário inline (modo seleção → formulário)
5. Testes unitários existentes devem continuar passando
6. Novos comportamentos adicionados têm cobertura de teste

## Notas

- `AuthShell` já tem fundo escuro e blur — verificar se BrandMark exibe "NossaGrana" em verde proeminente
- Não duplicar lógica de submissão/autenticação
- Manter props existentes para não quebrar App.tsx
