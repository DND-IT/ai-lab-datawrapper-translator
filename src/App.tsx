import React, { useState, useEffect } from 'react'
import { Routes, Route, HashRouter, useParams } from 'react-router-dom'
import 'semantic-ui-css/semantic.min.css'
import './app.scss'
import { SetupForm } from './components/SetupForm'
import { ProgressBar } from './components/ProgressBar'
import { TranslationsTable } from './components/TranslationsTable'
import fr from './locales/fr'
import de from './locales/de'

const localisationStrings: Record<string, Record<string, string>> = { de, fr }

const API_ENDPOINT = '/api/translate'

export function App() {
  const [errorMessage, setErrorMessage] = useState<null | string>(null)
  const [pipeline, setPipeline] = useState('default')
  const [locale, setLocale] = useState(() => localStorage.getItem('locale') || 'fr')
  const [title, setTitle] = useState(localisationStrings[locale].title)
  const [baseChartId, setBaseChartId] = useState<null | string>(null)
  const [newChartId, setNewChartId] = useState<null | string>(null)
  const [remainingUsage, setRemainingUsage] = useState<null | number>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [gotoStep, setGotoStep] = useState(0)
  const [sourceLang, setSourceLang] = useState(locale === 'fr' ? 'DE' : 'FR')
  const [targetLang, setTargetLang] = useState(locale === 'fr' ? 'FR' : 'DE')
  const [experimental, setExperimental] = useState(false)
  const [chartType, setChartType] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [translations, setTranslations] = useState<any[]>([])
  const [chartFolder, setChartFolder] = useState(
    'https://app.datawrapper.de/archive/team/tagesanzeiger/115629',
  )
  const finalStep = 4

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale)
    localStorage.setItem('locale', newLocale)
    setTitle(localisationStrings[newLocale].title)
    setSourceLang(newLocale === 'fr' ? 'DE' : 'FR')
    setTargetLang(newLocale === 'fr' ? 'FR' : 'DE')
  }

  useEffect(() => {
    if (currentStep === 0) getUsage()
  }, [currentStep])

  useEffect(() => {
    if (gotoStep !== 0) {
      console.log('Automatically requesting step ' + gotoStep + '...')
      console.log('[useEffect] new chart id is:', newChartId)
      requestStep(gotoStep)
    }
  }, [gotoStep])

  useEffect(() => {
    console.log(chartType)
    if (pipeline !== 'ukraine-map' && chartType === 'locator-map') {
      setPipeline('locator-map')
    }
  }, [chartType])

  async function handleFetch(
    requestOptions: Record<string, unknown>,
    itemName = 'la réponse',
  ) {
    const response = await fetch(API_ENDPOINT, requestOptions).catch(error => {
      setErrorMessage(`Impossible de charger ${itemName}: «${error.message}».`)
      return null
    })
    if (response) {
      if (response.ok) {
        return await response.json()
      } else {
        console.log(response)
        let message = "Code d\u2019erreur: " + response.status
        try {
          const errorData = await response.json()
          message = "Message d\u2019erreur: «" + errorData.message + '».'
        } catch {
          console.warn('could not get error message')
        }
        setErrorMessage(message)
        throw new Error(message)
      }
    }
  }

  const getUsage = () => {
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ get_usage: true }),
    }
    handleFetch(requestOptions, 'le quota restant').then(data => {
      if (data) setRemainingUsage(data.percentage_remaining)
    })
  }

  const requestStep = (step: number, translationData: string[] | null = null) => {
    console.log('Sending request: pipeline is', pipeline)
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_chart_id: baseChartId || '',
        step,
        new_chart_id: newChartId,
        translations: translationData,
        pipeline,
        source_lang: sourceLang,
        target_lang: targetLang,
        chart_type: chartType,
        experimental_mode: experimental,
      }),
    }
    handleFetch(requestOptions).then(data => {
      console.log('data = ', data)
      if (data) {
        const nextStep = parseInt(data.next_step)
        const theCurrentStep = parseInt(data.step)
        setCurrentStep(theCurrentStep)
        if (nextStep === 2 || nextStep === 4) setGotoStep(nextStep)
        if (data.new_chart_id) {
          console.log('New chart id is:', data.new_chart_id)
          setNewChartId(data.new_chart_id)
        }
        if (data.chart_type) {
          console.log('Chart type is:', data.chart_type)
          setChartType(data.chart_type)
        }
        if (data.translations) {
          console.log('Got automated translations:', data.translations)
          setTranslations(data.translations)
        }
        if (data.edit_url) setEditUrl(data.edit_url)
      }
    })
  }

  const handleReset = () => {
    setCurrentStep(0)
    setGotoStep(0)
    setBaseChartId(null)
    setNewChartId(null)
  }

  const handleValidateTranslations = (texts: string[]) => {
    console.log(texts)
    requestStep(3, texts)
  }

  const getChartId = (url: string) => {
    if (url.includes('/')) {
      if (url.includes('datawrapper.dwcdn.net')) {
        return url.replace('https://datawrapper.dwcdn.net/', '').split('/')[0]
      } else if (url.includes('www.datawrapper.de/_')) {
        return url.replace('https://www.datawrapper.de/_/', '').split('/')[0]
      } else {
        return url.replace('https://app.datawrapper.de/chart/', '').split('/')[0]
      }
    }
    return url
  }

  function ChartParameter() {
    const { chartId } = useParams()
    useEffect(() => {
      if (baseChartId === null) setBaseChartId(chartId || '')
    }, [])
    return null
  }

  function UkraineMap() {
    const { mapId } = useParams()
    useEffect(() => {
      setTitle("Traduire une carte d\u2019Ukraine")
      if (baseChartId === null) setBaseChartId(mapId || '')
      setPipeline('ukraine-map')
      setChartFolder('https://app.datawrapper.de/archive/team/tagesanzeiger/113965')
    }, [pipeline])

    return currentStep === 0 ? (
      <>
        <p className="ui text container">
          La vérification de la traduction se fera dans une Google Spreadsheet.
        </p>
        <p className="ui text container">
          Un dictionnaire allemand-français est utilisé pour les noms de villes,
          en raison de l'orthographe choisie par la Correction. On peut éditer
          ce dictionnaire dans{' '}
          <b>
            <a
              target="_blank"
              href="https://docs.google.com/spreadsheets/d/1I6QQPKiGjC9re668EpheiomVTjsszPJrrBVTL7J3UUE/edit#gid=519331008"
              rel="noreferrer"
            >
              l'onglet «dictionnaire»
            </a>
          </b>{' '}
          de la spreadsheet.
        </p>
      </>
    ) : null
  }

  return (
    <div className="index">
      <HashRouter>
        <div className="ui vertical segment">
          <div className="ui text container header-row">
            <h2>{title}</h2>
            <div className="locale-toggle">
              <button
                className={`ui mini button ${locale === 'fr' ? 'active' : 'basic'}`}
                onClick={() => handleLocaleChange('fr')}
              >
                FR
              </button>
              <button
                className={`ui mini button ${locale === 'de' ? 'active' : 'basic'}`}
                onClick={() => handleLocaleChange('de')}
              >
                DE
              </button>
            </div>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<div />} />
          <Route path="chart/:chartId" element={<ChartParameter />} />
          <Route path="ukraine-map/:mapId" element={<UkraineMap />} />
        </Routes>

        {errorMessage && (
          <div className="ui text container">
            <div className="ui negative message">
              <i className="close icon" onClick={() => setErrorMessage(null)} />
              <div className="header">
                {localisationStrings[locale].anErrorOccurred}
              </div>
              <p>{errorMessage}</p>
              {currentStep > 0 && (
                <button
                  className="ui button"
                  onClick={() => {
                    setErrorMessage(null)
                    setCurrentStep(currentStep - 1)
                  }}
                >
                  {localisationStrings[locale].stepBack}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="ui vertical segment">
          <div className="ui text container">
            {currentStep === 0 ? (
              <>
                <div className="ta text">
                  <SetupForm
                    baseChartId={baseChartId || ''}
                    translationDirection={`${sourceLang}-${targetLang}`}
                    handleInputChange={e => setBaseChartId(getChartId(e.target.value))}
                    handleSelectChange={e => {
                      if (e.target.value.includes('-')) {
                        setSourceLang(e.target.value.split('-')[0])
                        setTargetLang(e.target.value.split('-')[1])
                      }
                    }}
                    handleToggleExperimental={() => setExperimental(!experimental)}
                    handleButtonClick={() => {
                      setCurrentStep(1)
                      requestStep(1)
                    }}
                    experimental={experimental}
                    locale={locale}
                  />
                </div>
                <div className="ui vertical segment">
                  <p>
                    {localisationStrings[locale].remainingTranslationUsage}{' '}
                    {remainingUsage ? Math.round(remainingUsage) + '%' : 'chargement\u2026'}
                  </p>
                  <div className={`ui small ${remainingUsage ? '' : 'active'} progress`}>
                    <div
                      className="bar"
                      style={{
                        width: remainingUsage ? remainingUsage.toString() + '%' : '100%',
                      }}
                    >
                      <div className="progress" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {currentStep <= finalStep && (
                  <>
                    <ProgressBar
                      currentStep={currentStep}
                      finalStep={finalStep}
                      active={currentStep !== 2 && currentStep !== finalStep}
                      success={currentStep === finalStep}
                      error={errorMessage !== null}
                      locale={locale}
                    />
                    {currentStep === 2 &&
                      (pipeline === 'ukraine-map' ? (
                        <>
                          <p>
                            Avant de cliquer sur «Continuer», vérifiez et au besoin
                            corrigez la traduction automatique dans la feuille de calcul
                            suivante:
                          </p>
                          <p>
                            <b>
                              <a
                                target="_blank"
                                href="https://docs.google.com/spreadsheets/d/1I6QQPKiGjC9re668EpheiomVTjsszPJrrBVTL7J3UUE/edit#gid=807192791"
                                rel="noreferrer"
                              >
                                Marqueurs carte de l'Ukraine – traduction
                              </a>
                            </b>
                          </p>
                          <button
                            className="ui button"
                            tabIndex={0}
                            onClick={() => requestStep(3)}
                          >
                            Continuer
                          </button>
                        </>
                      ) : (
                        <TranslationsTable
                          translations={translations}
                          validateTranslations={handleValidateTranslations}
                          title={localisationStrings[locale].editTranslations}
                          noTextFound={localisationStrings[locale].noTextFound}
                        />
                      ))}
                  </>
                )}
                {currentStep === finalStep && (
                  <div className="ui three column centered grid">
                    <div className="column">
                      {editUrl ? (
                        <a
                          href={editUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ui button success"
                        >
                          {localisationStrings[locale].editChart}
                        </a>
                      ) : (
                        <button className="ui button loading success">
                          {localisationStrings[locale].editChart}
                        </button>
                      )}
                    </div>
                    <div className="column">
                      <a
                        href={chartFolder}
                        target="_blank"
                        rel="noreferrer"
                        className="ui button"
                      >
                        {localisationStrings[locale].openFolder}
                      </a>
                    </div>
                    <div className="column">
                      <button onClick={handleReset} className="ui button">
                        {localisationStrings[locale].newTranslation}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </HashRouter>
    </div>
  )
}
