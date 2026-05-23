import { getLocale } from '@/i18n';

/**
 * Dandara — the in-app AI assistant. There is no backend, so replies are
 * picked from locale-aware pools, lightly themed by keywords in the prompt.
 */
type Pool = {
  greet: string[];
  idea: string[];
  fact: string[];
  summary: string[];
  question: string[];
  general: string[];
};

const PT: Pool = {
  greet: [
    'Olá! Em que posso ajudar-te hoje?',
    'Oi! Diz-me o que precisas e trato disso.',
  ],
  idea: [
    'Aqui vai uma ideia: organiza um pequeno encontro temático esta semana — simples, mas memorável.',
    'Que tal uma rotina de 10 minutos por dia para o que tens andado a adiar? Pequenos passos somam.',
    'Ideia rápida: transforma a próxima conversa num desafio — uma pergunta inesperada para cada pessoa.',
  ],
  fact: [
    'Curiosidade: o polvo tem três corações e sangue azul. Dois bombeiam para as guelras e um para o corpo.',
    'Sabias que o mel praticamente nunca se estraga? Já encontraram mel comestível com mais de 3000 anos.',
    'Curiosidade: um dia em Vénus dura mais do que um ano em Vénus — gira muito devagar sobre si mesma.',
  ],
  summary: [
    'Resumindo: foca-te no essencial, agrupa tarefas parecidas e deixa o menos urgente para depois.',
    'Em poucas palavras — define uma prioridade clara, dá um passo de cada vez e revê no fim do dia.',
  ],
  question: [
    'Boa pergunta. Em geral, sim — mas depende do contexto. Com mais detalhes, afino a resposta.',
    'Deixa-me pensar... Resposta curta: começa pelo mais simples e ajusta conforme avanças.',
    'Pelo que sei, vale a pena testar em pequeno antes de decidir. Queres que detalhe os passos?',
  ],
  general: [
    'Percebi! Posso ajudar-te a desenvolver isso — queres que comece por um rascunho?',
    'Claro. Aqui está o que penso: trata primeiro do que traz mais valor e o resto encaixa.',
    'Posso tratar disso. Dá-me só um pouco mais de contexto e avanço.',
    'Boa! Se quiseres, organizo isto em tópicos curtos para ficar fácil de partilhar.',
  ],
};

const EN: Pool = {
  greet: ['Hi! How can I help you today?', 'Hey! Tell me what you need and I’ll handle it.'],
  idea: [
    'Here’s an idea: host a small themed get-together this week — simple, but memorable.',
    'How about a 10-minute daily routine for the thing you keep postponing? Small steps add up.',
    'Quick idea: turn your next chat into a challenge — one surprising question for each person.',
  ],
  fact: [
    'Fun fact: an octopus has three hearts and blue blood. Two pump to the gills, one to the body.',
    'Did you know honey basically never spoils? Edible honey over 3,000 years old has been found.',
    'Fun fact: a day on Venus lasts longer than a year on Venus — it spins very slowly.',
  ],
  summary: [
    'In short: focus on the essentials, batch similar tasks, and leave the less urgent for later.',
    'Briefly — set one clear priority, take it one step at a time, and review at the end of the day.',
  ],
  question: [
    'Good question. Generally yes — but it depends on context. With more detail I can refine this.',
    'Let me think... Short answer: start with the simplest path and adjust as you go.',
    'From what I know, it’s worth testing small before deciding. Want me to lay out the steps?',
  ],
  general: [
    'Got it! I can help you develop that — want me to start with a draft?',
    'Sure. Here’s my take: handle what brings the most value first and the rest falls into place.',
    'I can take care of that. Just give me a little more context and I’ll go.',
    'Nice! If you like, I’ll organize this into short bullet points so it’s easy to share.',
  ],
};

const MENTION = /@dandara/gi;

export function dandaraReply(prompt: string): string {
  const pool = getLocale().startsWith('pt') ? PT : EN;
  const clean = prompt.replace(MENTION, '').trim();
  const lower = clean.toLowerCase();
  let bucket: string[];
  if (!clean) bucket = pool.greet;
  else if (/(^|\s)(oi|ol[áa]|hey|hi|hello|bom dia|boa tarde|boa noite)\b/.test(lower)) bucket = pool.greet;
  else if (/(curiosidade|facto|fact)/.test(lower)) bucket = pool.fact;
  else if (/(ideia|idea|sugest)/.test(lower)) bucket = pool.idea;
  else if (/(resum|summar)/.test(lower)) bucket = pool.summary;
  else if (lower.includes('?')) bucket = pool.question;
  else bucket = pool.general;
  return bucket[Math.floor(Math.random() * bucket.length)];
}

export function dandaraSuggestions(): string[] {
  return getLocale().startsWith('pt')
    ? ['Dá-me uma ideia criativa', 'Conta uma curiosidade', 'Resume o meu dia', 'Escreve uma mensagem simpática']
    : ['Give me a creative idea', 'Tell me a fun fact', 'Summarize my day', 'Write a friendly message'];
}
