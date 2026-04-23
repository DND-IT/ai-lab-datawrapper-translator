import React from 'react'
import fr from '../locales/fr'
import de from '../locales/de'

const localisationStrings: Record<string, Record<string, string>> = { de, fr }

interface Props {
  currentStep: number
  finalStep: number
  active?: boolean
  success?: boolean
  error?: boolean
  locale: string
}

export const ProgressBar = ({
  currentStep,
  finalStep,
  active = true,
  success = false,
  error = false,
  locale,
}: Props) => {
  const steps = [
    localisationStrings[locale].step0,
    localisationStrings[locale].step1,
    localisationStrings[locale].step2,
    localisationStrings[locale].step3,
    localisationStrings[locale].step4,
  ]

  const percentage = (currentStep / finalStep) * 100

  return (
    <div
      className={`ui progress ${active && !error ? 'active' : ''} ${
        success ? 'success' : ''
      } ${error ? 'error' : ''}`}
    >
      <div className="bar" style={{ width: percentage.toString() + '%' }}>
        <div className="progress" />
      </div>
      <div className="ui label" style={{ background: 'none' }}>
        {localisationStrings[locale].step} {currentStep}{' '}
        {localisationStrings[locale].outOf} {finalStep}: {steps[currentStep]}
      </div>
    </div>
  )
}
