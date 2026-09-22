import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/common/Button.tsx'
import { useObjectUrl } from '../../../hooks/useObjectUrl.ts'
import { recognizeWeight } from '../api/recognizeWeight.ts'
import type { WeightRecognitionResult } from '../types/weightRecognition.types.ts'
import './material.css'

export interface WeightPhotoRecognitionProps {
  onApply(weightGram: number): void
  onFileChange(file: File | null): void
  /**
   * DOM id 앞에 붙는 값. **한 화면에 두 개 이상 그릴 때 반드시 서로 다르게 준다.**
   *
   * 가공 결과 화면은 산출물 행마다 하나씩 그린다. 고정 id 를 쓰면 같은 id 가 여러 번
   * 나오고, `htmlFor` 는 문서에서 처음 만난 하나만 가리킨다 — 두 번째 칸의 라벨을 눌러도
   * 첫 번째 칸이 열리고, 스크린리더와 테스트 모두 칸을 구분하지 못한다.
   */
  idPrefix?: string
  /** 제목. 소재 등록 외의 화면은 무엇을 재는 사진인지 밝혀야 한다. */
  title?: string
  description?: string
  /** 파일 선택 칸의 라벨. 이것이 그 칸의 접근성 이름이라 인스턴스마다 달라야 한다. */
  fileLabel?: string
  /**
   * 적용 버튼의 글자.
   *
   * 인식한 무게가 늘 입력칸으로 가는 것은 아니다 — 가공 전 무게처럼 채울 칸이 없고
   * 대조만 하는 자리도 있다. 그런 자리에 "적용" 이라고 적으면 무엇이 어디에 적용됐는지
   * 찾게 된다.
   */
  applyLabel?: string
}

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const MIN_APPLICABLE_CONFIDENCE = 0.7
const FAILURE_FALLBACK = '무게를 인식하지 못했습니다.'

export function WeightPhotoRecognition({
  onApply,
  onFileChange,
  idPrefix = 'weight-recognition',
  title = '저울 사진으로 무게 인식',
  description = '숫자와 저울 화면이 선명하게 보이도록 촬영해 주세요.',
  fileLabel = '저울 사진',
  applyLabel = '인식 무게 적용',
}: WeightPhotoRecognitionProps) {
  const titleId = `${idPrefix}-title`
  const inputId = `${idPrefix}-image`
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<WeightRecognitionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const requestIdRef = useRef(0)
  const previewUrl = useObjectUrl(file)

  useEffect(
    () => () => {
      requestIdRef.current += 1
    },
    [],
  )

  async function selectFile(selected: File | null) {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setResult(null)
    setErrorMessage(null)

    if (!selected) {
      setFile(null)
      setIsRecognizing(false)
      onFileChange(null)
      return
    }

    if (!ACCEPTED_IMAGE_TYPES.has(selected.type)) {
      setFile(null)
      setIsRecognizing(false)
      setErrorMessage('JPG 또는 PNG 사진만 선택해 주세요.')
      onFileChange(null)
      return
    }

    if (selected.size > MAX_IMAGE_SIZE_BYTES) {
      setFile(null)
      setIsRecognizing(false)
      setErrorMessage('사진은 10MB 이하만 선택할 수 있습니다.')
      onFileChange(null)
      return
    }

    setFile(selected)
    setIsRecognizing(true)
    onFileChange(selected)

    try {
      const recognized = await recognizeWeight(selected)
      if (requestIdRef.current === requestId) setResult(recognized)
    } catch {
      if (requestIdRef.current === requestId) {
        setErrorMessage('일시적인 서비스 문제로 무게를 인식하지 못했습니다. 무게를 수동으로 입력해 주세요.')
      }
    } finally {
      if (requestIdRef.current === requestId) setIsRecognizing(false)
    }
  }

  const recognizedWeight = result?.weight ?? null
  const isCandidate =
    recognizedWeight !== null &&
    (result?.status === 'SUCCESS' || result?.status === 'LOW_CONFIDENCE')
  const canApply =
    isCandidate &&
    (result.status === 'SUCCESS' || result.confidence >= MIN_APPLICABLE_CONFIDENCE)
  const isRecognitionFailure = result !== null && !isCandidate

  return (
    <section className="weight-recognition" aria-labelledby={titleId}>
      <div className="weight-recognition__heading">
        <div>
          <h3 id={titleId}>{title}</h3>
          <p>{description}</p>
        </div>
        {file && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void selectFile(null)}
          >
            사진 제거
          </Button>
        )}
      </div>

      <label className="weight-recognition__file-label" htmlFor={inputId}>
        {fileLabel}
      </label>
      <input
        id={inputId}
        className="weight-recognition__file-input"
        type="file"
        accept="image/jpeg,image/png"
        disabled={isRecognizing}
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null
          event.target.value = ''
          void selectFile(selected)
        }}
      />
      <p className="weight-recognition__hint">JPG 또는 PNG · 최대 10MB</p>

      {previewUrl && (
        <img
          className="weight-recognition__preview"
          src={previewUrl}
          alt="선택한 저울 사진 미리보기"
        />
      )}

      {isRecognizing && (
        <div className="weight-recognition__status" role="status">
          무게를 인식하는 중입니다…
        </div>
      )}

      {errorMessage && (
        <div className="weight-recognition__alert" role="alert">
          {errorMessage}
        </div>
      )}

      {isRecognitionFailure && (
        <div className="weight-recognition__alert" role="alert">
          <p>{result.message?.trim() || FAILURE_FALLBACK}</p>
          <p>사진을 다시 촬영해 주세요.</p>
        </div>
      )}

      {isCandidate && (
        <div
          className={`weight-recognition__result${
            result.status === 'LOW_CONFIDENCE' ? ' weight-recognition__result--warning' : ''
          }`}
          role="status"
        >
          <p className="weight-recognition__weight">
            {recognizedWeight.value.toLocaleString('ko-KR')} {recognizedWeight.unit}
          </p>
          <p>신뢰도 {Math.round(result.confidence * 100)}%</p>
          {result.ocr?.rawText && <p>OCR 원문: {result.ocr.rawText}</p>}
          {result.status === 'LOW_CONFIDENCE' && (
            <p>
              {result.message?.trim() || '인식 신뢰도가 낮습니다. 숫자를 확인해 주세요.'}
              {!canApply && ' 신뢰도가 낮아 적용할 수 없습니다. 사진을 다시 촬영해 주세요.'}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            disabled={!canApply}
            onClick={() => onApply(recognizedWeight.value)}
          >
            {applyLabel}
          </Button>
        </div>
      )}
    </section>
  )
}
