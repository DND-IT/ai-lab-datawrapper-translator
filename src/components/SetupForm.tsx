import React, { useState, useEffect } from 'react'
import fr from '../locales/fr'
import de from '../locales/de'

const localisationStrings: Record<string, Record<string, string>> = { de, fr }

interface Props {
  baseChartId: string
  experimental: boolean
  locale: string
  translationDirection: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSelectChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  handleToggleExperimental: () => void
  handleButtonClick: () => void
}

export const SetupForm = ({
  baseChartId,
  experimental,
  locale,
  translationDirection,
  handleInputChange,
  handleSelectChange,
  handleToggleExperimental,
  handleButtonClick,
}: Props) => {
  const [chartPreview, setChartPreview] = useState<string | null>(null)

  const isValidId = (chartId: string) =>
    chartId.length === 5 && /^[A-Za-z0-9]{5}$/.test(chartId)

  const enableButton = isValidId(baseChartId)

  useEffect(() => {
    if (baseChartId && isValidId(baseChartId)) {
      const imgURL = 'https://datawrapper.dwcdn.net/' + baseChartId + '/plain-s.png'
      fetch(imgURL, { method: 'HEAD' }).then(res => {
        if (res.ok) setChartPreview(imgURL)
      })
    } else {
      setChartPreview(null)
    }
  }, [baseChartId])

  return (
    <div className="ui form">
      <div className="field">
        <label>{localisationStrings[locale].visualizationID}</label>
        <input
          type="text"
          onChange={handleInputChange}
          value={baseChartId}
          placeholder={
            locale === 'fr'
              ? 'pLQnu ou https://app.datawrapper.de/edit/pLQnu/'
              : 'yh7Oc oder https://app.datawrapper.de/edit/yh7Oc/'
          }
        />
      </div>
      <div className="field">
        <select
          className="ui dropdown"
          onChange={handleSelectChange}
          value={translationDirection}
        >
          <option value="DE-FR">{localisationStrings[locale].selectDEFR}</option>
          <option value="FR-DE">{localisationStrings[locale].selectFRDE}</option>
        </select>
      </div>
      <div className="field">
        <div className="ui checkbox">
          <input
            type="checkbox"
            onClick={handleToggleExperimental}
            checked={experimental}
            readOnly
          />
          <label onClick={handleToggleExperimental}>
            {localisationStrings[locale].useExperimentalFeatures}
          </label>
        </div>
      </div>
      <div className="ui one column centered grid">
        <div className="ui segment">
          <button
            className={`ui centered button ${enableButton ? '' : 'disabled'}`}
            onClick={handleButtonClick}
          >
            {localisationStrings[locale].start}
          </button>
        </div>
      </div>
      {chartPreview !== null && (
        <div className="chart-preview">
          <img
            className="ui image"
            src={chartPreview}
            alt={localisationStrings[locale].chartPreview}
          />
          <div>{localisationStrings[locale].chartPreview}</div>
        </div>
      )}
    </div>
  )
}
