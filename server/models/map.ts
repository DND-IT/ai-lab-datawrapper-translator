import * as dw from '../services/datawrapper.js';
import { getDeeplDictionary, addLineBreaks } from '../services/deepl.js';
import { updateSpreadsheet, getSpreadsheetValues } from '../services/google-sheets.js';

interface Marker {
  id: string;
  title: string;
  text: string | null;
  type: string;
  visibility: { mobile: boolean; desktop: boolean };
  [key: string]: any;
}

const HTML_TAGS = /<[^>]+>/g;

function removeTags(value: string): string {
  return value.replace(HTML_TAGS, '').replace(/\n/g, ' ').replace(/  /g, ' ');
}

export class DwMap {
  mapId: string;
  metadata: any = null;
  data: any = {};

  constructor(mapId: string) {
    this.mapId = mapId;
  }

  async fetchMetadata(): Promise<any> {
    if (!this.metadata) {
      this.metadata = await dw.getMeta(this.mapId);
    }
    return this.metadata;
  }

  async fetchData(): Promise<boolean> {
    try {
      this.data = await dw.getMapData(this.mapId);
      return true;
    } catch {
      return false;
    }
  }

  getMarkers(): Marker[] {
    if (!this.data.markers) {
      console.log('Map data contains no marker');
      return [];
    }
    return this.data.markers;
  }

  async translateMap(
    sourceLang: string,
    targetLang: string,
  ): Promise<Array<{ key: string; source: string; translation: string }> | false> {
    try {
      const sourceTextDict = await dw.getChartTexts(this.mapId);

      if (!this.data.markers) await this.fetchData();
      const markers = this.getMarkers();

      const filtered = markers.filter(
        m => m.text != null && m.title !== '' && !m.title.startsWith('<img'),
      );
      for (const m of filtered) {
        sourceTextDict[m.id] = m.title;
      }

      console.log(sourceTextDict);
      const sourceTextList = Object.values(sourceTextDict);
      const translationsDict = await getDeeplDictionary(sourceTextList, sourceLang, targetLang);
      console.log('Translations:', translationsDict);

      return Object.entries(sourceTextDict).map(([key, sourceText]) => ({
        key,
        source: sourceText,
        translation: translationsDict[sourceText] || '',
      }));
    } catch (e) {
      console.error('Exception:', e);
      return false;
    }
  }

  async translateUkraineMap(): Promise<void> {
    // Get static dictionary from spreadsheet
    const dictValues = await getSpreadsheetValues(
      '1I6QQPKiGjC9re668EpheiomVTjsszPJrrBVTL7J3UUE',
      'dictionnaire!A2:B100',
    );
    const staticDict: Record<string, string> = {};
    for (const row of dictValues) {
      if (row.de && row.fr) staticDict[row.de] = row.fr;
    }

    // Get markers
    if (!this.data.markers) await this.fetchData();
    const markers = this.getMarkers();

    const filtered = markers.filter(
      m => m.text != null && m.title !== '' && !m.title.startsWith('<img'),
    );

    const rows = filtered.map(m => ({
      id: m.id,
      type: m.type,
      mobile: m.visibility?.mobile || false,
      desktop: m.visibility?.desktop || false,
      title_de_raw: m.title,
      title_de_clean: removeTags(m.title),
      translation_method: m.title in staticDict ? 'dictionary' : 'deepl',
      title_fr: '',
    }));

    rows.sort((a, b) => {
      if (a.translation_method !== b.translation_method) {
        return a.translation_method.localeCompare(b.translation_method);
      }
      return a.title_de_raw.localeCompare(b.title_de_raw);
    });

    // Get DeepL translations for non-dictionary entries
    const deeplTexts = rows
      .filter(r => r.translation_method === 'deepl')
      .map(r => r.title_de_clean);

    const deeplDict = deeplTexts.length > 0 ? await getDeeplDictionary(deeplTexts) : {};

    for (const row of rows) {
      if (row.translation_method === 'dictionary') {
        row.title_fr = staticDict[row.title_de_raw] || '';
      } else {
        row.title_fr = deeplDict[row.title_de_clean] || '';
      }
    }

    const spreadsheetValues = rows.map(r => [
      r.id, r.type, String(r.mobile), String(r.desktop),
      r.title_de_raw, r.title_de_clean,
      r.translation_method, r.title_fr,
    ]);

    await updateSpreadsheet(spreadsheetValues);
  }

  async applyTranslations(translations: any[], targetLang: string): Promise<boolean> {
    const dwLang = targetLang === 'FR' ? 'fr-CH' : 'de-CH';

    // translations is [keys[], sources[], translations[]]
    const translatedItems: Record<string, string> = {};
    for (let i = 0; i < translations[0].length; i++) {
      translatedItems[translations[0][i]] = translations[2][i];
    }

    const metadata = await this.fetchMetadata();
    const patchPayload: any = {
      language: dwLang,
      metadata,
    };

    if (translatedItems.title) patchPayload.title = translatedItems.title;
    if (translatedItems.intro) patchPayload.metadata.describe.intro = translatedItems.intro;
    if (translatedItems['bottom-note']) patchPayload.metadata.annotate.notes = translatedItems['bottom-note'];
    if (translatedItems.source) patchPayload.metadata.describe['source-name'] = translatedItems.source;

    const resultMeta = await dw.patchChartMeta(this.mapId, patchPayload);
    if (!resultMeta) return false;

    if (!this.data.markers) await this.fetchData();
    const updatedMarkers = this.getMarkers().map(m => {
      if (translatedItems[m.id]) m.title = translatedItems[m.id];
      return m;
    });
    this.data.markers = updatedMarkers;

    console.log('Putting new data...');
    return await dw.putData(this.mapId, this.data);
  }

  async applyUkraineTranslations(targetLang = 'FR'): Promise<boolean> {
    console.log('Patching metadata...');
    await dw.patchMapMeta(this.mapId, targetLang);

    const translatedRows = await getSpreadsheetValues();

    if (!this.data.markers) await this.fetchData();
    const markers = this.getMarkers();

    const updatedMarkers = markers.map(marker => {
      const match = translatedRows.find(r => r.id === marker.id);
      if (match?.title_fr) {
        marker.title = addLineBreaks(match.title_fr);
      }
      return marker;
    });

    this.data.markers = updatedMarkers;
    console.log('Putting new data...');
    return await dw.putData(this.mapId, this.data);
  }
}
