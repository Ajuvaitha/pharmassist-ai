import { useEffect, useRef, useState } from 'react'
import { Editor, convertBoundingBoxMillimeterToPixel, type InkEditor, type TBox } from 'iink-ts'
import { diffSettledWords, type SettledWord } from '../lib/diffWords'

interface WhiteboardProps {
  onWordSettled: (w: { label: string; box: { x: number; y: number; width: number; height: number } }) => void
}

const APPLICATION_KEY = import.meta.env.VITE_MYSCRIPT_APPLICATION_KEY || ''
const HMAC_KEY = import.meta.env.VITE_MYSCRIPT_HMAC_KEY || ''

export default function Whiteboard({ onWordSettled }: WhiteboardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<InkEditor | null>(null)
  const previousWordsRef = useRef<SettledWord[]>([])
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
      const editor = await Editor.load(containerRef.current!, 'INKV2', {
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
            // JIIX bounding boxes are off by default, so exported words arrive
            // with only a label. Popups anchor to the word's box on the canvas,
            // and the exported-word handler skips any word without one, so this
            // must be enabled or no suggestion ever fires.
            export: {
              jiix: {
                'bounding-box': true,
                text: { chars: false, words: true },
              },
            },
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
        const jiix = exports['application/vnd.myscript.jiix'] as { words?: SettledWord[] } | undefined
        if (!jiix?.words) return

        const newWords = diffSettledWords(previousWordsRef.current, jiix.words)
        previousWordsRef.current = jiix.words

        newWords.forEach((word) => {
          if (!word.label?.trim() || !word['bounding-box']) return
          // JIIX word entries are typed as SettledWord (an index signature of `unknown`)
          // so downstream consumers stay decoupled from iink-ts's JIIX types; the
          // 'bounding-box' field is narrowed back to iink-ts's own TBox here, right
          // before handing it to iink-ts's own converter.
          const box = convertBoundingBoxMillimeterToPixel(word['bounding-box'] as TBox)
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
    <div style={{ background: '#fff', border: '1px solid #D9E8EF', borderRadius: 8, overflow: 'hidden' }}>
      {keysMissing && (
        <div
          style={{
            background: '#FFF4E5',
            color: '#8A5300',
            padding: '8px 12px',
            fontSize: 13,
            borderBottom: '1px solid #F0C987',
          }}
        >
          Add MyScript keys to <code>frontend/.env</code> to enable handwriting recognition. Drawing
          still works without them.
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: 480 }} />
    </div>
  )
}
