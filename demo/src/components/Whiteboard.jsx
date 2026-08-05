import { useEffect, useRef, useState } from 'react'
import { Editor, convertBoundingBoxMillimeterToPixel } from 'iink-ts'
import { diffSettledWords } from '../lib/diffWords.js'

const APPLICATION_KEY = import.meta.env.VITE_MYSCRIPT_APPLICATION_KEY || ''
const HMAC_KEY = import.meta.env.VITE_MYSCRIPT_HMAC_KEY || ''

export default function Whiteboard({ onWordSettled }) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const previousWordsRef = useRef([])
  const [keysMissing] = useState(!APPLICATION_KEY || !HMAC_KEY)
  // Editor.load()/destroy() both mutate the same root element's DOM wholesale
  // (destroy() isn't scoped to a single instance), so two overlapping calls on
  // that root corrupt each other. React 19 StrictMode double-mounts this
  // effect in dev, which would otherwise start a second Editor.load() before
  // the first has resolved. Chaining every setup/teardown off this ref
  // serializes them so only one is ever in flight on the container.
  const loadChainRef = useRef(Promise.resolve())

  useEffect(() => {
    let cancelled = false

    loadChainRef.current = loadChainRef.current.then(async () => {
      const editor = await Editor.load(containerRef.current, 'INKV2', {
        configuration: {
          server: {
            scheme: 'https',
            host: 'cloud.myscript.com',
            applicationKey: APPLICATION_KEY,
            hmacKey: HMAC_KEY,
          },
          recognition: {
            type: 'TEXT',
            lang: 'en_US',
          },
          triggers: {
            exportContent: 'QUIET_PERIOD',
            exportContentDelay: 800,
          },
        },
      })

      if (cancelled) {
        editor.destroy()
        return
      }

      editorRef.current = editor

      editor.event.addExportedListener((exports) => {
        const jiix = exports['application/vnd.myscript.jiix']
        if (!jiix?.words) return

        const newWords = diffSettledWords(previousWordsRef.current, jiix.words)
        previousWordsRef.current = jiix.words

        newWords.forEach((word) => {
          if (!word.label?.trim() || !word['bounding-box']) return
          const box = convertBoundingBoxMillimeterToPixel(word['bounding-box'])
          onWordSettled({ label: word.label, box })
        })
      })

      editor.event.addErrorListener((err) => {
        console.warn('iink-ts recognition error (check MyScript keys):', err)
      })
    })

    return () => {
      cancelled = true
      loadChainRef.current = loadChainRef.current.then(() => {
        editorRef.current?.destroy()
        editorRef.current = null
      })
    }
  }, [onWordSettled])

  return (
    <div className="whiteboard">
      {keysMissing && (
        <div className="whiteboard-warning">
          Add MyScript keys to <code>demo/.env</code> to enable handwriting recognition. Drawing
          still works without them.
        </div>
      )}
      <div ref={containerRef} className="whiteboard-surface" />
    </div>
  )
}
