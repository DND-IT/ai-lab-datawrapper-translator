import { Router, Request, Response } from 'express';
import { Chart } from '../models/chart.js';
import { DwMap } from '../models/map.js';
import { getApiUsage } from '../services/deepl.js';
import * as dw from '../services/datawrapper.js';

const router = Router();

function isValidId(dwId: string): boolean {
  return /^[A-Za-z0-9]{5}$/.test(dwId);
}

function makeResponse(res: Response, payload: Record<string, any> = {}, message = '', code = 200) {
  if (code === 400) message = 'bad request: ' + message;
  else if (code === 500) message = 'server error: ' + message;

  if (Math.floor(code / 100) === 2) {
    payload.result = 'success';
  } else {
    payload.result = 'error';
    payload.message = message;
  }

  return res.status(code).json(payload);
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    const experimentalMode = !!body.experimental_mode;
    const getUsage = !!body.get_usage;
    let pipeline: string = body.pipeline || 'default';
    const step = body.step != null ? parseInt(body.step) : -1;
    const baseChartId: string = body.base_chart_id || '';
    const newChartId: string = body.new_chart_id || '';
    const chartType: string = body.chart_type || '';
    const translations: any[] = body.translations || [];
    const sourceLang: string = body.source_lang || 'DE';
    const targetLang: string = body.target_lang || 'FR';

    if (experimentalMode) console.log('Experimental mode on!');
    if (sourceLang) console.log('Source lang is', sourceLang);
    if (targetLang) console.log('Target lang is', targetLang);
    if (chartType) console.log('Chart type:', chartType);

    // Get DeepL usage
    if (getUsage) {
      const usage = await getApiUsage();
      if (!usage) return makeResponse(res, {}, 'could not get API usage', 500);
      return makeResponse(res, usage);
    }

    if (!baseChartId && step === -1) {
      return makeResponse(res, {}, 'missing parameters', 400);
    }

    console.log('Step =', step);

    // Step 1: Duplicate chart
    if (step === 1) {
      if (!isValidId(baseChartId)) {
        return makeResponse(res, {}, 'wrong chart id', 400);
      }
      const duplicateResult = await dw.duplicateChart(baseChartId);
      if (!duplicateResult) {
        return makeResponse(res, {}, 'could not duplicate chart', 500);
      }
      return makeResponse(res, {
        step: 1,
        new_chart_id: duplicateResult.new_chart_id,
        chart_type: duplicateResult.chart_type,
        result: 'OK',
        next_step: 2,
      });
    }

    // Step 2: Translate
    if (step === 2) {
      console.log('Step 2: translate.');
      if (!newChartId) return makeResponse(res, {}, 'new_chart_id is empty', 400);

      if (pipeline === 'default' && chartType === 'locator-map') {
        console.log('Locator map detected');
        pipeline = 'locator-map';
      }

      if (pipeline === 'default') {
        const chart = new Chart(newChartId, chartType);
        const translationTable = await chart.createTranslationTable(sourceLang, targetLang);
        if (!translationTable) {
          return makeResponse(res, {}, 'could not get a translation list', 500);
        }
        return makeResponse(res, {
          step: 2, result: 'OK', next_step: 3, translations: translationTable,
        });
      }

      if (pipeline === 'locator-map') {
        console.log('Locator map pipeline');
        const map = new DwMap(newChartId);
        const translationTable = await map.translateMap(sourceLang, targetLang);
        if (!translationTable) {
          return makeResponse(res, {}, 'could not get a translation list', 500);
        }
        return makeResponse(res, {
          step: 2, result: 'OK', next_step: 3, translations: translationTable,
        });
      }

      if (pipeline === 'ukraine-map') {
        console.log('Ukraine map pipeline');
        const map = new DwMap(newChartId);
        console.log('New map has id:', newChartId);
        await map.translateUkraineMap();
        return makeResponse(res, {
          step: 2, result: 'OK', next_step: 3,
          spreadsheet_url: 'https://docs.google.com/spreadsheets/d/1I6QQPKiGjC9re668EpheiomVTjsszPJrrBVTL7J3UUE/edit#gid=807192791',
        });
      }
    }

    // Step 3: Apply translations
    if (step === 3) {
      if (!newChartId) return makeResponse(res, {}, 'new_chart_id not set', 400);

      if (pipeline === 'default') {
        if (translations.length < 1) {
          return makeResponse(res, {}, 'empty translation list', 400);
        }
        console.log('translations', translations);
        console.log('new chart id', newChartId);
        const chart = new Chart(newChartId, '', experimentalMode);
        const result = await chart.applyTranslations(translations, targetLang);
        if (result) {
          return makeResponse(res, { step: 3, result: 'OK', next_step: 4 });
        }
        return makeResponse(res, { step: 3 }, 'could not patch chart data', 500);
      }

      if (pipeline === 'locator-map') {
        const map = new DwMap(newChartId);
        const result = await map.applyTranslations(translations, targetLang);
        if (result) {
          return makeResponse(res, { step: 3, result: 'OK', next_step: 4 });
        }
        return makeResponse(res, { step: 3 }, 'API error: could not update map data', 500);
      }

      if (pipeline === 'ukraine-map') {
        const map = new DwMap(newChartId);
        const result = await map.applyUkraineTranslations(targetLang);
        if (result) {
          return makeResponse(res, { step: 3, result: 'OK', next_step: 4 });
        }
        return makeResponse(res, { step: 3 }, 'API error: could not update map data', 500);
      }
    }

    // Step 4: Return edit URL
    if (step === 4) {
      await new Promise(r => setTimeout(r, 500));
      return makeResponse(res, {
        step: 4,
        edit_url: `https://app.datawrapper.de/chart/${newChartId}/visualize#refine`,
      });
    }

    if (step > 4) {
      return res.status(400).json({ result: 'OK' });
    }

    return makeResponse(res, {}, 'wrong step', 400);
  } catch (error) {
    console.error('Translate error:', error);
    return makeResponse(res, {}, 'internal server error', 500);
  }
});

export default router;
