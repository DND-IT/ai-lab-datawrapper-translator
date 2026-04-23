import { config } from '../config.js';
import { checkStatus } from '../helpers.js';

export function addLineBreaks(title: string): string {
  if (typeof title !== 'string') return title;
  if (title.length <= config.maxLineLength) return title;

  const words = title.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    if ((line + word).length < config.maxLineLength) {
      line += word + ' ';
    } else {
      lines.push(line.trimEnd());
      line = word + ' ';
    }
  }
  lines.push(line.trimEnd());
  return lines.join('\n');
}

function capitalizeFirstLetter(text: string): string {
  return text.length > 1 ? text[0].toUpperCase() + text.slice(1) : text;
}

export async function getApiUsage(): Promise<Record<string, number> | false> {
  const url = config.deeplEndpoint.replace('translate', 'usage');
  const res = await fetch(url, {
    headers: { Authorization: `DeepL-Auth-Key ${config.deeplToken}` },
  });
  const ok = await checkStatus(res, false);
  const data = await res.json();
  console.log(data);

  if (ok) {
    return {
      percentage_remaining: 100 - (data.character_count / data.character_limit) * 100,
      character_count: data.character_count,
      character_limit: data.character_limit,
    };
  }
  return false;
}

export async function getDeeplDictionary(
  cleanTitles: string[],
  sourceLang = 'DE',
  targetLang = 'FR',
): Promise<Record<string, string>> {
  if (cleanTitles.length === 0) return {};

  const uniqueTexts = [...new Set(cleanTitles)];
  const body = new URLSearchParams();
  uniqueTexts.forEach(text => body.append('text', text));
  body.append('source_lang', sourceLang);
  body.append('target_lang', targetLang);

  const res = await fetch(config.deeplEndpoint, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${config.deeplToken}` },
    body,
  });
  await checkStatus(res);

  const data = await res.json();
  const translations: string[] = data.translations.map((t: any) => capitalizeFirstLetter(t.text));

  const result: Record<string, string> = {};
  uniqueTexts.forEach((text, i) => {
    result[text] = translations[i];
  });
  return result;
}
