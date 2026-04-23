import React from 'react'

interface Props {
  translations: { key: string; source: string; translation: string }[]
  validateTranslations: (translations: any) => void
  title: string
  noTextFound: string
}

export const TranslationsTable = ({
  translations,
  validateTranslations,
  title,
  noTextFound,
}: Props) => {
  console.log('Translation dictionary:', translations)

  return (
    <form className="ui form" id="translationsForm">
      <h4 className="ui header">{title}</h4>
      {translations.length === 0 ? (
        <p>{noTextFound}</p>
      ) : (
        translations.map((item, index) => (
          <div className="field" key={index}>
            <label>{item.key}</label>
            <div className="two fields">
              <input type="hidden" name="key" value={item.key} readOnly />
              <div className="field">
                <textarea name="source" rows={2} value={item.source} readOnly />
              </div>
              <div className="field">
                <textarea name="translation" rows={2} defaultValue={item.translation} />
              </div>
            </div>
          </div>
        ))
      )}
      <div
        className="ui button"
        tabIndex={0}
        onClick={() => {
          const form = document.getElementById('translationsForm') as HTMLFormElement
          if (form) {
            const formData = new FormData(form)
            const key = formData.getAll('key')
            const source = formData.getAll('source')
            const translation = formData.getAll('translation')
            validateTranslations([key, source, translation])
          }
        }}
      >
        Continuer
      </div>
    </form>
  )
}
