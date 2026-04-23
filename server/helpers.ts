import { config } from './config.js';

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function getCurrentDate(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

export async function checkStatus(response: Response, shouldRaise = true): Promise<boolean> {
  if (!response.ok) {
    await slackAlert(`Error code ${response.status} for request ${response.url}`);
    if (shouldRaise) {
      throw new Error(`Error code ${response.status} for request ${response.url}`);
    }
    return false;
  }
  return true;
}

export async function slackAlert(message: string, mention = false): Promise<void> {
  if (!config.slackHookTechnical) return;
  if (mention) message += ' <@U020FU609LG>';
  await fetch(config.slackHookTechnical, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  }).catch(() => {});
}

export async function slackInfo(message: string): Promise<void> {
  if (!config.slackHookGeneral) return;
  await fetch(config.slackHookGeneral, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  }).catch(() => {});
}
